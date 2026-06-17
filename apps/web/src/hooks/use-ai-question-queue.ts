'use client';

/**
 * AI question generation queue hook — KAYNAK-BAŞINA dengeli üretim.
 *
 * Çoklu kaynak (max 2): her kaynak için AYRI sorgu gönderilir. Tek bir sorguda
 * birden çok belge verildiğinde model soruları son/tek belgeye yığıp diğerini
 * atlıyordu → her kaynağa kendi çağrısı yapılır, böylece her konu temsil edilir.
 *
 * Dağıtım (toplam invariant'ları korunur):
 *  - Toplam üretim her zaman TOTAL_GENERATE(20); kaynaklara EŞİT bölünür
 *    (distributeEven) → 1 kaynak [20], 2 kaynak [10,10].
 *  - Gösterilen toplam = displayTarget (varsayılan 10); kaynaklara EŞİT bölünür
 *    → 1 kaynak [10], 2 kaynak [5,5]. displayed liste kaynaklar arası round-robin
 *    harmanlanır (admin ilk birkaçına baksa bile her konuyu görür).
 *  - Yedek (queue) = üretim − gösterilen, kaynak başına. 2 kaynak D=10 → 5+5 yedek.
 *  - Tek kaynakta davranış birebir korunur (20 üret / 10 göster / 10 yedek).
 *
 * Silme davranışı KAYNAK-BAŞINA (in-place, dengeyi korur):
 *  - Silinen kartın kaynağından (sourceKey) bir yedek varsa → aynı indekse onunla
 *    değiştirilir. Böylece "5 A + 5 B" dengesi bozulmaz (A silinince A gelir).
 *  - O kaynağın yedeği boşsa → skeleton placeholder; background replenish O KAYNAKTAN
 *    soru getirir ve slota yerleştirir.
 *
 * Sağlamlık katmanları:
 *  - Placeholder'lar snapshot'a (onStateChange) DAHİL EDİLMEZ — draft'a sızıp
 *    restore'da "yapışık" placeholder yaratıp admin'i kilitlemesin.
 *  - generationRef (epoch): reset()/generate() epoch'u artırır; in-flight replenish
 *    eski epoch'tan geldiyse state'e YAZMAZ (regenerate sonrası stale enjeksiyon yok).
 *  - Aynı kaynağa giden replenish'ler SERİ + accumulator ile çalışır (duplicate yedek
 *    önlenir); kaynaklar arası paralel kalır.
 *
 * sourceQuote zorunluluğu: boş gelirse hook filtreler (hallucination koruması).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SourceFile } from '@/types/ai';

export interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  /** Kaynaktan birebir alıntı — hallucination koruması, UI'da göster. */
  sourceQuote: string;
  /** Opsiyonel sayfa numarası (PDF için). */
  sourcePage?: number;
  /** Bu sorunun üretildiği kaynağın s3Key'i — kaynak-başına denge/silme/replenish için.
   *  Opsiyonel: bu özellikten ÖNCE kaydedilmiş draft'larda (tek kaynak) bulunmaz;
   *  o durumda replenish tek/ilk kaynağa düşer (geriye dönük uyum). */
  sourceKey?: string;
  /** Stable client-side id for React keys. */
  clientId: string;
  /** Skeleton/loading slot — queue boşken silinen indekse bırakılır,
   *  replenish döndüğünde gerçek soruyla değiştirilir. */
  isPlaceholder?: boolean;
}

/** Parent'a snapshot için pending state — manuel ↔ AI geçişi ve sayfa yenilemede restore. */
export interface AiPendingState {
  displayed: GeneratedQuestion[];
  queue: GeneratedQuestion[];
}

export interface UseAiQuestionQueueOptions {
  sources: SourceFile[];
  model: string;
  /** Admin'in hedeflediği toplam gösterilen soru sayısı (default 10). Kaynaklara
   * eşit bölünür. Hedef 0 veya negatifse generate() error verir (UI disabled tutmalı). */
  displayTarget?: number;
  /** Manuel olarak yazılmış soruların metinleri — AI'nın dedup için tekrar
   * etmemesi gereken sorular. excluded listesine her çağrıda eklenir. */
  staticExcluded?: { text: string }[];
  /** Parent'tan restore edilecek pending state (mode geçişi/sayfa yenileme sonrası). */
  initialState?: AiPendingState;
  /** Her displayed/queue değişiminde parent'a snapshot — draft'a kaydetmek için.
   *  NOT: placeholder'lar bu snapshot'a dahil edilmez (kalıcılaşmamalı). */
  onStateChange?: (state: AiPendingState) => void;
}

export interface UseAiQuestionQueueReturn {
  displayed: GeneratedQuestion[];
  queue: GeneratedQuestion[];
  loading: boolean;
  error: string | null;
  generate: () => Promise<void>;
  remove: (clientId: string) => void;
  reset: () => void;
  /** Yedekleri (queue) kaynak-başına hedefe kadar doldurur (kaynak-içi seri, kaynaklar-arası paralel). */
  refillQueue: () => Promise<void>;
  isGenerating: boolean;
  isReplenishing: boolean;
  /** Dondurulmuş hedefe göre üretilebilecek yedek sayısı (component refill butonu için). */
  refillNeed: number;
}

interface RawQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  sourceQuote?: string;
  sourcePage?: number;
}

const DEFAULT_DISPLAY_TARGET = 10;
/** Toplam üretilen soru sayısı (display + queue). Kullanıcı kararı: "toplam 20 soru,
 *  en az yarısı yedek". Çoklu kaynakta bu toplam kaynaklara eşit bölünür. */
const TOTAL_GENERATE = 20;

/** total'i n parçaya olabildiğince eşit böler; kalan ilk parçalara +1 olarak dağılır.
 *  distributeEven(20,2)=[10,10]; distributeEven(10,2)=[5,5]; distributeEven(7,2)=[4,3].
 *  (Test edilebilirlik için export edilir.) */
export function distributeEven(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const rem = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Kaynak-başına displayed gruplarını round-robin harmanlar (A,B,A,B,…).
 *  (Test edilebilirlik için export edilir.) */
export function interleave(groups: GeneratedQuestion[][]): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  const max = groups.reduce((m, g) => Math.max(m, g.length), 0);
  for (let r = 0; r < max; r++) {
    for (const g of groups) {
      const item = g[r];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

/** RawQuestion → GeneratedQuestion. sourceQuote eksikse null döner (caller filtreler).
 *  Bu hallucination koruma katmanıdır; system prompt sourceQuote ister, model
 *  uymadıysa o soru gözükmesin. sourceKey üretildiği kaynağı etiketler. */
const withId = (q: RawQuestion, sourceKey: string): GeneratedQuestion | null => {
  const quote = (q.sourceQuote ?? '').trim();
  if (!quote) return null;
  return {
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    sourceQuote: quote,
    sourcePage: q.sourcePage,
    sourceKey,
    clientId: newId(),
  };
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body && typeof body.error === 'string' && body.error.length > 0) return body.error;
  } catch {
    /* ignore */
  }
  if (res.status === 429) return 'Çok fazla istek — lütfen biraz sonra tekrar deneyin.';
  if (res.status === 502) return 'AI sağlayıcısına ulaşılamadı. Lütfen tekrar deneyin.';
  if (res.status === 504)
    return 'İşlem zaman aşımına uğradı — kaynak dosyalar çok büyük olabilir. Daha küçük veya daha az dosya ile deneyin.';
  if (res.status === 400) return 'Geçersiz istek.';
  return 'Soru üretimi başarısız oldu.';
}

export function useAiQuestionQueue(options: UseAiQuestionQueueOptions): UseAiQuestionQueueReturn {
  const {
    sources,
    model,
    displayTarget = DEFAULT_DISPLAY_TARGET,
    staticExcluded = [],
    initialState,
    onStateChange,
  } = options;
  // Sınırla: 0-20 arası int. 0 → generate disabled.
  const displayTargetSafe = Math.max(0, Math.min(20, Math.floor(displayTarget)));

  // Static excluded'ı ref'e koy ki async callback'ler güncel manueli görsün.
  const staticExcludedRef = useRef<{ text: string }[]>([]);
  staticExcludedRef.current = staticExcluded;

  const [displayed, setDisplayed] = useState<GeneratedQuestion[]>(initialState?.displayed ?? []);
  const [queue, setQueue] = useState<GeneratedQuestion[]>(initialState?.queue ?? []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [replenishCount, setReplenishCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // ÜRETİM ANINDAKİ hedef — generate() ile DONDURULUR. Üretimden sonra manuel soru
  // eklenip displayTarget (canlı) değişse bile refill hedefleri kaymaz; üretilmiş set
  // neyse yedek dengesi de ona göre kalır. (Regenerate yeni hedefle yeniden dondurur.)
  const [effectiveDisplayTarget, setEffectiveDisplayTarget] = useState(displayTargetSafe);

  // Race-safety: Refs for current state to use in fire-and-forget callbacks.
  const displayedRef = useRef<GeneratedQuestion[]>([]);
  const queueRef = useRef<GeneratedQuestion[]>([]);
  displayedRef.current = displayed;
  queueRef.current = queue;

  // Generation epoch — reset()/generate() artırır. In-flight replenish eski epoch'tan
  // geldiyse state'e yazmaz (regenerate/abandon sonrası stale soru enjeksiyonu önlenir).
  const generationRef = useRef(0);

  // onStateChange ref — her render'da dependency olmasın diye.
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // displayed/queue değiştikçe parent'a snapshot ilet (draft persistence için).
  // Placeholder'lar (skeleton) snapshot'a DAHİL EDİLMEZ — draft'a sızıp restore'da
  // kalıcı "yapışık" placeholder yaratıp "Soruları Ekle"yi kalıcı disabled bırakmasın.
  useEffect(() => {
    onStateChangeRef.current?.({
      displayed: displayed.filter((q) => !q.isPlaceholder),
      queue,
    });
  }, [displayed, queue]);

  const reset = useCallback(() => {
    generationRef.current += 1; // in-flight replenish'leri geçersiz kıl
    setDisplayed([]);
    setQueue([]);
    setError(null);
    setIsGenerating(false);
    setReplenishCount(0);
  }, []);

  const generate = useCallback(async () => {
    if (sources.length === 0) {
      setError('Önce en az bir kaynak (PDF, DOCX, PPTX, XLSX) seçin.');
      return;
    }
    if (displayTargetSafe === 0) {
      setError('Üretilecek soru sayısı 0. Hedef toplamı manuel sorulardan büyük belirleyin.');
      return;
    }
    const gen = (generationRef.current += 1); // yeni nesil; eski in-flight'lar geçersiz
    setIsGenerating(true);
    setError(null);
    // Bu üretimin hedefini dondur — sonraki manuel-soru değişimleri refill'i kaydırmasın.
    setEffectiveDisplayTarget(displayTargetSafe);
    try {
      const n = sources.length;
      // Toplam 20 üretim + toplam displayTarget gösterim, kaynaklara eşit bölünür.
      const genPer = distributeEven(TOTAL_GENERATE, n);
      const shownPer = distributeEven(displayTargetSafe, n);

      // Her kaynak için AYRI çağrı (paralel) — tek sorguda yığılma sorununun çözümü.
      const perSource = await Promise.all(
        sources.map(async (src, i) => {
          try {
            const res = await fetch('/api/admin/trainings/ai/generate-questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sources: [src],
                model,
                count: genPer[i],
                excluded: staticExcludedRef.current,
              }),
            });
            if (!res.ok) return { i, ok: false, questions: [] as GeneratedQuestion[], errorMsg: await readError(res) };
            const data = (await res.json()) as { questions?: RawQuestion[] };
            const qs = (Array.isArray(data.questions) ? data.questions : [])
              .map((q) => withId(q, src.s3Key))
              .filter((q): q is GeneratedQuestion => q !== null);
            return { i, ok: true, questions: qs, errorMsg: undefined };
          } catch {
            return { i, ok: false, questions: [] as GeneratedQuestion[], errorMsg: undefined };
          }
        }),
      );

      // Eski nesil (regenerate/abandon araya girdiyse) sonucu yazma.
      if (generationRef.current !== gen) return;

      // Kaynak-başına: ilk shownPer[i] → displayed grubu, kalan → queue.
      const displayedGroups: GeneratedQuestion[][] = sources.map(() => []);
      const newQueue: GeneratedQuestion[] = [];
      for (const r of perSource) {
        const shown = shownPer[r.i] ?? 0;
        displayedGroups[r.i] = r.questions.slice(0, shown);
        newQueue.push(...r.questions.slice(shown));
      }

      // Bir kaynak HTTP hatası döndürdüyse (429/502/504 vb.) spesifik mesajı koru.
      const specificError = perSource.find((r) => r.errorMsg)?.errorMsg;

      const interleaved = interleave(displayedGroups);
      if (interleaved.length === 0) {
        setError(specificError ?? 'Hiç soru üretilemedi. Model kaynak alıntısı veremedi — farklı bir kaynak veya model deneyin.');
        return;
      }
      setDisplayed(interleaved);
      setQueue(newQueue);
      // Gösterilen hedefin altında kaldıysa (bir kaynak kotasından az/hata döndü) admin'i uyar.
      if (interleaved.length < displayTargetSafe) {
        setError(
          specificError ??
            `Hedeflenen ${displayTargetSafe} sorudan ${interleaved.length} tanesi üretilebildi — bazı kaynaklardan yeterli soru çıkmadı. ` +
              'Eksikler için "Tümünü Yeniden Üret" veya yedek üretmeyi deneyin.',
        );
      }
    } catch {
      setError('Ağ hatası — lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  }, [sources, model, displayTargetSafe]);

  /** Belirli BİR kaynaktan tek soru üretir ve yerleştirir. Internal.
   *
   *  @param sourceKey - hangi kaynaktan üretilecek (kaynak-başına denge korunur)
   *  @param replaceClientId - verilirse displayed'da bu id'li skeleton'u gerçek
   *    soruyla değiştirir; verilmezse queue'ya ekler.
   *  @param extraExcluded - aynı seri içinde önceki çağrıların ürettiği metinler
   *    (paralel/ardışık üretimde duplicate önlemek için).
   *  @returns üretilen soru veya null (başarısız/atlandı) */
  const fetchOneToQueue = useCallback(
    async (
      sourceKey: string | undefined,
      replaceClientId?: string,
      extraExcluded: { text: string }[] = [],
    ): Promise<GeneratedQuestion | null> => {
      // Eski draft'larda sourceKey olmayabilir → tek/ilk kaynağa düş (geriye dönük uyum).
      const src = sources.find((s) => s.s3Key === sourceKey) ?? sources[0];
      if (!src) return null;
      const gen = generationRef.current;
      const excluded = [
        ...staticExcludedRef.current,
        ...displayedRef.current
          .filter((q) => !q.isPlaceholder)
          .map((q) => ({ text: q.questionText })),
        ...queueRef.current.map((q) => ({ text: q.questionText })),
        ...extraExcluded,
      ];
      // Replenish route excluded'ı zorunlu (min 1) ister — boşsa çağrı yapma.
      if (excluded.length === 0) return null;
      const res = await fetch('/api/admin/trainings/ai/replenish-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: [src], model, excluded }),
      });
      if (!res.ok) {
        // Replenish çağrıları arka plan; global banner panik yaratmasın.
        return null;
      }
      const data = (await res.json()) as { question?: RawQuestion };
      if (!data.question) return null;
      // Çözülen kaynağın key'iyle etiketle (fallback durumunda da tutarlı sourceKey).
      const withSource = withId(data.question, src.s3Key);
      if (!withSource) return null; // sourceQuote yoktu → atla

      // Bu çağrı başladıktan sonra reset/regenerate olduysa state'e yazma (stale).
      if (generationRef.current !== gen) return null;

      if (replaceClientId) {
        // Skeleton slotunu gerçek soruyla in-place değiştir
        let placed = false;
        setDisplayed((prev) => {
          const idx = prev.findIndex((q) => q.clientId === replaceClientId);
          if (idx < 0) return prev; // slot artık yok (reset/regenerate edildi)
          placed = true;
          return prev.toSpliced(idx, 1, withSource);
        });
        // Slot bulunamadıysa kaybetmeyelim — queue'ya at
        if (!placed) {
          setQueue((prev) => [...prev, withSource]);
        }
      } else {
        // Normal yedek doldurma → queue'ya ekle
        setQueue((prev) => [...prev, withSource]);
      }
      return withSource;
    },
    [sources, model],
  );

  const fireReplenish = useCallback(
    async (sourceKey: string | undefined, replaceClientId?: string) => {
      setReplenishCount((c) => c + 1);
      try {
        const result = await fetchOneToQueue(sourceKey, replaceClientId);
        if (!result && replaceClientId) {
          // Replenish başarısız → skeleton'ı sessizce kaldır (display 1 azalır).
          setDisplayed((prev) => prev.filter((q) => q.clientId !== replaceClientId));
        }
      } catch {
        if (replaceClientId) {
          setDisplayed((prev) => prev.filter((q) => q.clientId !== replaceClientId));
        }
      } finally {
        setReplenishCount((c) => Math.max(0, c - 1));
      }
    },
    [fetchOneToQueue],
  );

  const refillQueue = useCallback(async () => {
    const n = sources.length;
    if (n === 0) return;
    // Kaynak-başına yedek hedefi = genPer - shownPer. Eksik kadar üret.
    const genPer = distributeEven(TOTAL_GENERATE, n);
    // DONDURULMUŞ hedefi kullan — canlı displayTargetSafe değil (üretim sonrası manuel
    // ekleme refill hedefini kaydırmasın).
    const shownPer = distributeEven(effectiveDisplayTarget, n);
    const perSourceNeed = sources.map((s, i) => {
      const sourceKey = s.s3Key;
      const target = Math.max(0, (genPer[i] ?? 0) - (shownPer[i] ?? 0));
      // Geriye dönük uyum: sourceKey'i olmayan (eski draft) yedekleri ilk kaynağa say.
      const have = queueRef.current.filter(
        (q) => (q.sourceKey ?? sources[0]?.s3Key) === sourceKey,
      ).length;
      return { sourceKey, need: Math.max(0, target - have) };
    });
    const totalNeed = perSourceNeed.reduce((sum, p) => sum + p.need, 0);
    if (totalNeed === 0) return;
    setReplenishCount((c) => c + totalNeed);
    setError(null);
    try {
      // Kaynaklar arası PARALEL, kaynak içi SERİ + accumulator: aynı kaynaktan
      // ardışık üretilen sorular birbirinin excluded'ına girer (duplicate yedek önlenir).
      const perSourceSuccess = await Promise.all(
        perSourceNeed.map(async ({ sourceKey, need }) => {
          const produced: { text: string }[] = [];
          for (let k = 0; k < need; k++) {
            const q = await fetchOneToQueue(sourceKey, undefined, produced);
            if (q) produced.push({ text: q.questionText });
          }
          return produced.length;
        }),
      );
      const successCount = perSourceSuccess.reduce((sum, c) => sum + c, 0);
      if (successCount === 0) {
        setError('Yedek üretimi başarısız — model uygun cevap döndüremedi. Lütfen tekrar deneyin.');
      }
    } catch {
      setError('Yedek üretimi başarısız — lütfen tekrar deneyin.');
    } finally {
      setReplenishCount((c) => Math.max(0, c - totalNeed));
    }
  }, [fetchOneToQueue, effectiveDisplayTarget, sources]);

  // Yedek üretilebilecek miktar — dondurulmuş hedefe göre (component refill butonu bunu
  // gösterir; refillQueue ile birebir tutarlı kalır).
  const refillNeed = Math.max(0, Math.max(0, TOTAL_GENERATE - effectiveDisplayTarget) - queue.length);

  const remove = useCallback(
    (clientId: string) => {
      // In-place + KAYNAK-BAŞINA: silinen kartın kaynağından yedek gelir (denge korunur).
      const currentDisplayed = displayedRef.current;
      const currentQueue = queueRef.current;
      const idx = currentDisplayed.findIndex((q) => q.clientId === clientId);
      if (idx < 0) return;
      const removed = currentDisplayed[idx];
      const sourceKey = removed.sourceKey;

      // Aynı kaynaktan ilk yedeği bul.
      const qIdx = currentQueue.findIndex((q) => q.sourceKey === sourceKey);
      if (qIdx >= 0) {
        const pulled = currentQueue[qIdx];
        setQueue(currentQueue.filter((_, i) => i !== qIdx));
        setDisplayed(currentDisplayed.toSpliced(idx, 1, pulled));
      } else {
        // O kaynağın yedeği yok → skeleton bırak, aynı kaynaktan replenish et.
        const placeholderId = newId();
        const placeholder: GeneratedQuestion = {
          questionText: '',
          options: [],
          correctIndex: 0,
          sourceQuote: '',
          sourceKey,
          clientId: placeholderId,
          isPlaceholder: true,
        };
        setDisplayed(currentDisplayed.toSpliced(idx, 1, placeholder));
        void fireReplenish(sourceKey, placeholderId);
      }
    },
    [fireReplenish],
  );

  return {
    displayed,
    queue,
    loading: isGenerating,
    error,
    generate,
    remove,
    reset,
    refillQueue,
    isGenerating,
    isReplenishing: replenishCount > 0,
    refillNeed,
  };
}
