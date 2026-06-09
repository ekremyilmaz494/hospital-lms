import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * generateQuestions — OpenRouter yanıt işleme regresyonu.
 *
 * Bağlam: OpenRouter, provider hatası / rate-limit / moderation / (bazı) kredi
 * durumlarında HTTP 200 + { error: {...} } döndürür ve gövdede `choices` YOKTUR.
 * `openai` SDK'sı 2xx olduğu için throw etmez. Eski kod `completion.choices[0]`'a
 * korumasız eriştiği için bu durumda "Cannot read properties of undefined
 * (reading '0')" fırlatıyor ve provider'ın GERÇEK hata mesajı maskeleniyordu
 * (Haziran 2026 soru-üretimi şikâyeti). Bu testler:
 *   1. error-envelope → anlamlı, gerçek-sebebi-içeren OpenRouterError (kriptik [0] DEĞİL)
 *   2. choices boş dizi → temiz "boş içerik" hatası, çökme yok
 *   3. mutlu yol → geçerli JSON questions dizisi döner
 */

const { createMock, s3Mock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  s3Mock: {
    getDownloadUrl: vi.fn().mockResolvedValue('https://s3.example/signed.png'),
    downloadBuffer: vi.fn().mockResolvedValue(Buffer.from('')),
  },
}));

// `new OpenAI()` → instance'ında chat.completions.create = controllable mock.
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));
vi.mock('@/lib/s3', () => s3Mock);
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { generateQuestions, OpenRouterError } from '@/lib/openrouter';

// Görsel kaynak — buildContentBlocks sadece getDownloadUrl çağırır (office extract'a gerek yok).
const IMG_SOURCE = {
  s3Key: 'sources/org-1/slide.png',
  mimeType: 'image/png',
  filename: 'slide.png',
};
const MODEL = 'anthropic/claude-sonnet-4.6';

beforeEach(() => {
  createMock.mockReset();
  process.env.OPENROUTER_API_KEY = 'test-key';
});

describe('generateQuestions — OpenRouter yanıt işleme', () => {
  it('error envelope (choices YOK) → kriptik "[0]" yerine gerçek sebebi içeren OpenRouterError', async () => {
    // OpenRouter'ın 200 + { error } davranışı — choices alanı hiç yok.
    createMock.mockResolvedValue({ error: { message: 'Rate limit exceeded', code: 429 } });

    let caught: unknown;
    try {
      await generateQuestions({ model: MODEL, sources: [IMG_SOURCE], count: 5 });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(OpenRouterError);
    const message = (caught as Error).message;
    expect(message).toContain('Rate limit exceeded');
    expect(message).toContain('429');
    // Regresyon kilidi: artık ham TypeError mesajı sızmamalı.
    expect(message).not.toContain("reading '0'");
    expect(message).not.toContain('Cannot read properties');
  });

  it('choices boş dizi → "boş içerik" OpenRouterError, çökme yok', async () => {
    createMock.mockResolvedValue({ choices: [] });

    await expect(
      generateQuestions({ model: MODEL, sources: [IMG_SOURCE], count: 5 })
    ).rejects.toThrow(/boş içerik/);
  });

  it('mutlu yol → geçerli JSON questions dizisi döner', async () => {
    const validQ = {
      questionText: 'El hijyeni hangi durumda zorunludur?',
      options: ['Hasta temasından önce', 'Mola sonrası', 'Sadece ameliyatta', 'Hiçbir zaman'],
      correctIndex: 0,
      sourceQuote: 'Her hasta temasından önce el hijyeni zorunludur.',
    };
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ questions: [validQ] }) } }],
    });

    const result = await generateQuestions({ model: MODEL, sources: [IMG_SOURCE], count: 5 });

    expect(result).toHaveLength(1);
    expect(result[0].questionText).toBe(validQ.questionText);
    expect(result[0].correctIndex).toBe(0);
  });
});
