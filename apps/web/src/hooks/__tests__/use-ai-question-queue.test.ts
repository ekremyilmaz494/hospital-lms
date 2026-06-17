import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * AI question queue — kaynak-başına dengeli üretim regresyon kilidi.
 *
 * **KÖK NEDEN:** Tek sorguda birden çok kaynak verildiğinde model soruları tek
 * belgeye yığıp diğerini atlıyordu. Çözüm: her kaynağa AYRI sorgu; toplam 20 üretim
 * ve toplam 10 gösterim kaynaklara EŞİT bölünür (2 kaynak → her biri 10 üret, 5 göster,
 * 5 yedek). Tek kaynak davranışı korunur (20 üret / 10 göster).
 *
 * Test ortamı `node` + jsdom/renderHook yok → React hook'ları mock'lanır
 * (use-fetch.test.ts ile aynı desen); ayrıca saf dağıtım fonksiyonları doğrudan test edilir.
 */

// vi.hoisted — vi.mock factory hoist edildiğinde bu değişkenlere erişebilsin
// (static import ile mock factory erken çalışır; top-level const'lar henüz init olmaz).
const { mockSetState, mockUseState, mockUseEffect, mockUseCallback, mockUseRef } = vi.hoisted(() => {
  const setState = vi.fn();
  return {
    mockSetState: setState,
    mockUseState: vi.fn((init: unknown) => [init, setState]),
    mockUseEffect: vi.fn((cb: () => void) => cb()),
    mockUseCallback: vi.fn((cb: unknown) => cb),
    mockUseRef: vi.fn((init: unknown) => ({ current: init })),
  };
});

vi.mock('react', () => ({
  useState: mockUseState,
  useEffect: mockUseEffect,
  useCallback: mockUseCallback,
  useRef: mockUseRef,
}));

import { distributeEven, interleave, useAiQuestionQueue, type GeneratedQuestion } from '@/hooks/use-ai-question-queue';

// ── Saf dağıtım fonksiyonları ──
describe('distributeEven — toplamı n kaynağa eşit böler', () => {
  it('20 → 2 kaynak: [10,10]', () => {
    expect(distributeEven(20, 2)).toEqual([10, 10]);
  });
  it('10 → 2 kaynak: [5,5]', () => {
    expect(distributeEven(10, 2)).toEqual([5, 5]);
  });
  it('tek kaynak davranışı korunur — 20→[20], 10→[10]', () => {
    expect(distributeEven(20, 1)).toEqual([20]);
    expect(distributeEven(10, 1)).toEqual([10]);
  });
  it('tek sayı kalanı ilk parçalara dağıtır — 7→[4,3], 10/3→[4,3,3]', () => {
    expect(distributeEven(7, 2)).toEqual([4, 3]);
    expect(distributeEven(10, 3)).toEqual([4, 3, 3]);
  });
  it('toplam her zaman korunur', () => {
    for (const [t, n] of [[20, 2], [10, 2], [13, 3], [10, 1]] as const) {
      expect(distributeEven(t, n).reduce((a, b) => a + b, 0)).toBe(t);
    }
  });
  it('n<=0 → boş dizi', () => {
    expect(distributeEven(10, 0)).toEqual([]);
  });
});

describe('interleave — kaynak gruplarını round-robin harmanlar', () => {
  const q = (id: string, sourceKey: string): GeneratedQuestion => ({
    questionText: id, options: [], correctIndex: 0, sourceQuote: 'x', sourceKey, clientId: id,
  });
  it('iki kaynağı dönüşümlü dizer (A,B,A,B,…)', () => {
    const a = [q('a1', 'a'), q('a2', 'a')];
    const b = [q('b1', 'b'), q('b2', 'b')];
    expect(interleave([a, b]).map((x) => x.clientId)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
  it('dengesiz gruplarda kalanı sona ekler', () => {
    const a = [q('a1', 'a'), q('a2', 'a'), q('a3', 'a')];
    const b = [q('b1', 'b')];
    expect(interleave([a, b]).map((x) => x.clientId)).toEqual(['a1', 'b1', 'a2', 'a3']);
  });
  it('her kaynaktan eşit sayı → gösterilen denge korunur', () => {
    const a = Array.from({ length: 5 }, (_, i) => q(`a${i}`, 'a'));
    const b = Array.from({ length: 5 }, (_, i) => q(`b${i}`, 'b'));
    const result = interleave([a, b]);
    expect(result).toHaveLength(10);
    expect(result.filter((x) => x.sourceKey === 'a')).toHaveLength(5);
    expect(result.filter((x) => x.sourceKey === 'b')).toHaveLength(5);
  });
});

// ── generate(): kaynak-başına AYRI sorgu ──
describe('useAiQuestionQueue.generate — kaynak-başına ayrı sorgu', () => {
  const mockFetch = vi.fn();

  const okQuestions = (n: number) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      questions: Array.from({ length: n }, (_, i) => ({
        questionText: `s${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0, sourceQuote: 'alıntı',
      })),
    }),
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    mockSetState.mockReset();
    mockUseState.mockImplementation((init: unknown) => [init, mockSetState]);
    mockUseEffect.mockImplementation((cb: () => void) => { cb(); });
    mockUseCallback.mockImplementation((cb: unknown) => cb);
    mockUseRef.mockImplementation((init: unknown) => ({ current: init }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('2 kaynak → 2 ayrı çağrı, her biri TEK kaynak + count 10', async () => {
    mockFetch.mockResolvedValue(okQuestions(10));
    const sources = [
      { s3Key: 'a', filename: 'A.pdf' },
      { s3Key: 'b', filename: 'B.pdf' },
    ];
    const { generate } = useAiQuestionQueue({ sources, model: 'test-model', displayTarget: 10 });
    await generate();

    const genCalls = mockFetch.mock.calls.filter((c) => String(c[0]).includes('/generate-questions'));
    expect(genCalls).toHaveLength(2);
    const bodies = genCalls.map((c) => JSON.parse((c[1] as { body: string }).body));
    // Her çağrı TEK kaynak içerir (yığılma bug'ının çözümü) ve count=10 (20/2).
    expect(bodies[0].sources).toEqual([sources[0]]);
    expect(bodies[0].count).toBe(10);
    expect(bodies[1].sources).toEqual([sources[1]]);
    expect(bodies[1].count).toBe(10);
  });

  it('tek kaynak → 1 çağrı, count 20 (mevcut davranış korunur)', async () => {
    mockFetch.mockResolvedValue(okQuestions(20));
    const sources = [{ s3Key: 'a', filename: 'A.pdf' }];
    const { generate } = useAiQuestionQueue({ sources, model: 'test-model', displayTarget: 10 });
    await generate();

    const genCalls = mockFetch.mock.calls.filter((c) => String(c[0]).includes('/generate-questions'));
    expect(genCalls).toHaveLength(1);
    const body = JSON.parse((genCalls[0][1] as { body: string }).body);
    expect(body.sources).toEqual([sources[0]]);
    expect(body.count).toBe(20);
  });

  it('kaynak yokken fetch çağrılmaz', async () => {
    const { generate } = useAiQuestionQueue({ sources: [], model: 'test-model', displayTarget: 10 });
    await generate();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── refillNeed: dondurulmuş hedefe göre yedek ihtiyacı ──
describe('useAiQuestionQueue.refillNeed — dondurulmuş hedef', () => {
  beforeEach(() => {
    mockSetState.mockReset();
    mockUseState.mockImplementation((init: unknown) => [init, mockSetState]);
    mockUseEffect.mockImplementation((cb: () => void) => { cb(); });
    mockUseCallback.mockImplementation((cb: unknown) => cb);
    mockUseRef.mockImplementation((init: unknown) => ({ current: init }));
  });

  it('queue boş + displayTarget 10 → refillNeed = 20-10 = 10', () => {
    const { refillNeed } = useAiQuestionQueue({
      sources: [{ s3Key: 'a' }], model: 'm', displayTarget: 10,
    });
    expect(refillNeed).toBe(10);
  });

  it('displayTarget 7 → refillNeed = 20-7 = 13 (yedek hedefi dondurulmuş targete göre)', () => {
    const { refillNeed } = useAiQuestionQueue({
      sources: [{ s3Key: 'a' }, { s3Key: 'b' }], model: 'm', displayTarget: 7,
    });
    expect(refillNeed).toBe(13);
  });
});
