'use client';

/**
 * AI question generation queue hook — tek çağrıda 20 soru üretir.
 *
 * Initial generate(): tek HTTP isteğiyle 20 soru üretilir. İlk N tanesi
 * (displayTarget) `displayed`'a, kalan 20-N tanesi gizli `queue`'a düşer.
 * Manuel 0 → 10 göster + 10 yedek. Manuel 5 → 5 göster + 15 yedek.
 *
 * Silme davranışı (in-place):
 *  - Queue'da yedek varsa → silinen kart **aynı indekste** queue'dan gelen
 *    soruyla değiştirilir (en alta DEĞİL).
 *  - Queue boşsa → silinen indekse skeleton placeholder bırakılır;
 *    background replenish API'si döndüğünde gerçek soru o slota yerleşir.
 *  - İki yolda da display sayısı görsel olarak hep sabit kalır.
 *
 * State persistence: `initialState` prop ile parent state'ten restore
 * eder; her displayed/queue değişiminde `onStateChange` çağrılır → parent
 * state'e ve draft'a kaydedilir. Bu sayede admin Manuel ↔ AI tab geçişi
 * yapsa veya sayfa yenilese bile pending AI soruları kaybolmaz.
 *
 * sourceQuote zorunluluğu: Backend her soruda kaynaktan birebir alıntı
 * (sourceQuote) ister. Boş gelirse hook filtreler — model "kaynak dışı"
 * üretmiş demektir, hallucination koruması.
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
  /** Admin'in hedeflediği toplam soru sayısı (default 10). Hook bu sayı kadar
   * `displayed` tutar; queue ise her zaman 5 yedek. Hedef 0 veya negatifse
   * generate() error verir (UI'da disabled tutulmalı). */
  displayTarget?: number;
  /** Manuel olarak yazılmış soruların metinleri — AI'nın dedup için tekrar
   * etmemesi gereken sorular. excluded listesine her çağrıda eklenir
   * (initial generate + her replenish). */
  staticExcluded?: { text: string }[];
  /** Parent'tan restore edilecek pending state (mode geçişi/sayfa yenileme sonrası). */
  initialState?: AiPendingState;
  /** Her displayed/queue değişiminde parent'a snapshot — draft'a kaydetmek için. */
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
  /** Yedekleri (queue) hedef sayıya kadar paralel olarak doldurur.
   *  Tüm yedekler tüketildiyse veya admin manuel olarak yenilemek isterse. */
  refillQueue: () => Promise<void>;
  isGenerating: boolean;
  isReplenishing: boolean;
}

interface RawQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  sourceQuote?: string;
  sourcePage?: number;
}

/** Sunucu timeout mesajıyla aynı — 504 ve tarayıcı abort'unda gösterilir. */
const TIMEOUT_MESSAGE =
  'İşlem zaman aşımına uğradı — kaynak dosyalar çok büyük olabilir. Daha küçük veya daha az dosya ile tekrar deneyin.';

/** Tarayıcı tarafı abort süresi — sunucu bütçesinin (function maxDuration 300s)
 *  biraz altında tutuluyor ki fetch sonsuza dek asılı kalmasın. */
const CLIENT_TIMEOUT_MS = 280_000;

/** Bir hatanın fetch timeout/abort olup olmadığını söyler.
 *  AbortSignal.timeout → DOMException name 'TimeoutError'; manuel abort → 'AbortError'. */
const isAbortLike = (err: unknown): boolean =>
  err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');

const DEFAULT_DISPLAY_TARGET = 10;
/** Tek çağrıda üretilen toplam soru sayısı (display + queue). Kullanıcı kararı:
 *  "tek çağrıda 20 soru, en az yarısı yedek". PDF input'u tekrar tekrar
 *  göndermemek için tek isteğe topluyoruz (replenish'lerden ~5-7× ucuz). */
const TOTAL_GENERATE = 20;

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

/** RawQuestion → GeneratedQuestion. sourceQuote eksikse null döner (caller filtreler).
 *  Bu hallucination koruma katmanıdır; system prompt sourceQuote ister, model
 *  uymadıysa o soru gözükmesin. */
const withId = (q: RawQuestion): GeneratedQuestion | null => {
  const quote = (q.sourceQuote ?? '').trim();
  if (!quote) return null;
  return {
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    sourceQuote: quote,
    sourcePage: q.sourcePage,
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
  if (res.status === 504) return TIMEOUT_MESSAGE;
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

  // Race-safety: Refs for current state to use in fire-and-forget callbacks.
  const displayedRef = useRef<GeneratedQuestion[]>([]);
  const queueRef = useRef<GeneratedQuestion[]>([]);
  displayedRef.current = displayed;
  queueRef.current = queue;

  // onStateChange ref — her render'da dependency olmasın diye.
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // displayed/queue değiştikçe parent'a snapshot ilet (draft persistence için).
  // `initialState` ilk render'da set edilmiş olabileceği için ilk effect'te de tetiklenir;
  // sonsuz loop'tan kaçınmak için referansları aynı tuttuğumuzdan parent'ın güvenli
  // useState/useReducer kullanması yeterli.
  useEffect(() => {
    onStateChangeRef.current?.({ displayed, queue });
  }, [displayed, queue]);

  const reset = useCallback(() => {
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
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/trainings/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          model,
          // Tek çağrıda 20 soru — manuel sayısından bağımsız. Display'i
          // displayTargetSafe kadar göster, kalanı queue'da yedek tut.
          count: TOTAL_GENERATE,
          excluded: staticExcludedRef.current,
        }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });
      if (!res.ok) {
        const msg = await readError(res);
        setError(msg);
        return;
      }
      const data = (await res.json()) as { questions?: RawQuestion[] };
      const all = (Array.isArray(data.questions) ? data.questions : [])
        .map(withId)
        .filter((q): q is GeneratedQuestion => q !== null);
      if (all.length === 0) {
        setError('Hiç soru üretilemedi. Model kaynak alıntısı veremedi — farklı bir kaynak veya model deneyin.');
        return;
      }
      setDisplayed(all.slice(0, displayTargetSafe));
      setQueue(all.slice(displayTargetSafe, TOTAL_GENERATE));
    } catch (err) {
      setError(isAbortLike(err) ? TIMEOUT_MESSAGE : 'Ağ hatası — lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  }, [sources, model, displayTargetSafe]);

  /** Tek soru üretir ve hedeflenen yere yerleştirir. Internal — hem
   *  fireReplenish hem refillQueue tarafından kullanılır.
   *
   *  @param replaceClientId - verilirse displayed'da bu id'li skeleton'u
   *    gerçek soruyla değiştirir; verilmezse queue'ya ekler.
   *  @returns success boolean */
  const fetchOneToQueue = useCallback(async (replaceClientId?: string): Promise<boolean> => {
    const excluded = [
      ...staticExcludedRef.current,
      ...displayedRef.current
        .filter((q) => !q.isPlaceholder)
        .map((q) => ({ text: q.questionText })),
      ...queueRef.current.map((q) => ({ text: q.questionText })),
    ];
    const res = await fetch('/api/admin/trainings/ai/replenish-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources, model, excluded }),
      // Tek soru çok daha hızlı döner; takılı bağlantı kuyruğu kilitlemesin.
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) {
      // Replenish çağrıları arka plan; global banner panik yaratmasın.
      // Sadece manuel refillQueue tetikledi ise kullanıcıya göster — onu
      // refillQueue içinde ayrıca yakalıyoruz. In-place skeleton path için
      // sessizce false dön; caller skeleton'u kaldırır.
      return false;
    }
    const data = (await res.json()) as { question?: RawQuestion };
    if (!data.question) return false;
    const withSource = withId(data.question);
    if (!withSource) return false; // sourceQuote yoktu → atla

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
    return true;
  }, [sources, model]);

  const fireReplenish = useCallback(async (replaceClientId?: string) => {
    setReplenishCount((c) => c + 1);
    try {
      const ok = await fetchOneToQueue(replaceClientId);
      if (!ok && replaceClientId) {
        // Replenish başarısız → skeleton'ı sessizce kaldır, display sayısı
        // 1 azalır. Global error banner GÖSTERME — kullanıcı her silmede
        // panik görmemeli; havuz tamamen tükendi ise zaten manuel "yedek
        // üret" butonu var.
        setDisplayed((prev) => prev.filter((q) => q.clientId !== replaceClientId));
      }
    } catch {
      // Network/exception → yine sessiz; skeleton temizle.
      if (replaceClientId) {
        setDisplayed((prev) => prev.filter((q) => q.clientId !== replaceClientId));
      }
    } finally {
      setReplenishCount((c) => Math.max(0, c - 1));
    }
  }, [fetchOneToQueue]);

  const refillQueue = useCallback(async () => {
    // Yedek hedefi dinamik: TOTAL_GENERATE - displayTarget
    // (manuel 0 → 10 yedek, manuel 5 → 15 yedek hedefi)
    const queueTarget = Math.max(0, TOTAL_GENERATE - displayTargetSafe);
    const need = queueTarget - queueRef.current.length;
    if (need <= 0) return;
    setReplenishCount((c) => c + need);
    setError(null);
    try {
      // Paralel — N paralel API çağrısı; her biri 1 soru getirir, queue'ya eklenir.
      // Race güvenli çünkü her çağrı kendi `excluded` listesini hesaplar
      // (current displayed + queue + static); ufak bir tekrar riski vardır
      // ama tekrar gelen sorular zaten farklı clientId ile kaydedilir.
      const results = await Promise.all(
        Array.from({ length: need }, () => fetchOneToQueue()),
      );
      // Manuel buton — kullanıcı geri bildirim bekliyor. Hepsi başarısızsa
      // göster, kısmen başarılıysa sessiz (yedek arttı, kullanıcı görür).
      const successCount = results.filter(Boolean).length;
      if (successCount === 0) {
        setError('Yedek üretimi başarısız — model uygun cevap döndüremedi. Lütfen tekrar deneyin.');
      }
    } catch {
      setError('Yedek üretimi başarısız — lütfen tekrar deneyin.');
    } finally {
      setReplenishCount((c) => Math.max(0, c - need));
    }
  }, [fetchOneToQueue, displayTargetSafe]);

  const remove = useCallback(
    (clientId: string) => {
      // In-place replenish: silinen kartın yeri korunur (en alta atılmaz).
      // - Queue dolu ise: yedek aynı indekse girer (hemen görünür).
      // - Queue boş ise: skeleton placeholder bırakılır, replenish API'si
      //   döndüğünde gerçek soru o slota yerleşir.
      const currentDisplayed = displayedRef.current;
      const currentQueue = queueRef.current;
      const idx = currentDisplayed.findIndex((q) => q.clientId === clientId);
      if (idx < 0) return;

      if (currentQueue.length > 0) {
        // 20 soruluk havuzdan in-place al — ekstra API çağrısı YOK.
        // Havuz tüketilene kadar (10 silmeye kadar) yeni üretim gereksiz.
        // Kullanıcı manuel "yedek üret" butonuyla cömertçe doldurabilir.
        const pulled = currentQueue[0];
        setQueue(currentQueue.slice(1));
        setDisplayed(currentDisplayed.toSpliced(idx, 1, pulled));
      } else {
        const placeholderId = newId();
        const placeholder: GeneratedQuestion = {
          questionText: '',
          options: [],
          correctIndex: 0,
          sourceQuote: '',
          clientId: placeholderId,
          isPlaceholder: true,
        };
        setDisplayed(currentDisplayed.toSpliced(idx, 1, placeholder));
        // Replenish bittiğinde skeleton'u gerçek soruyla değiştir
        void fireReplenish(placeholderId);
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
  };
}
