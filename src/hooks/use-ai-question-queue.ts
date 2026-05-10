'use client';

/**
 * AI question generation queue hook — 10+5 hybrid strategy.
 *
 * Initial generate() istekte 15 soru üretilir: 10 tanesi `displayed`'a,
 * 5 tanesi gizli `queue`'a düşer. Admin bir soru silince queue'dan biri
 * displayed slot'una çekilir ve arka planda yeni bir soru üretmek için
 * replenish endpoint'i fire-and-forget çağrılır. Birden fazla silme aynı
 * anda olursa her biri kendi replenish çağrısını başlatır — yarış güvenli.
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

const DEFAULT_DISPLAY_TARGET = 10;
const QUEUE_TARGET = 5;

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
          count: displayTargetSafe + QUEUE_TARGET,
          excluded: staticExcludedRef.current,
        }),
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
      setQueue(all.slice(displayTargetSafe, displayTargetSafe + QUEUE_TARGET));
    } catch {
      setError('Ağ hatası — lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  }, [sources, model, displayTargetSafe]);

  /** Tek soru üretir ve queue'ya ekler. Internal — hem fireReplenish hem
   *  refillQueue tarafından kullanılır. Hata durumunda false döner. */
  const fetchOneToQueue = useCallback(async (): Promise<boolean> => {
    const excluded = [
      ...staticExcludedRef.current,
      ...displayedRef.current.map((q) => ({ text: q.questionText })),
      ...queueRef.current.map((q) => ({ text: q.questionText })),
    ];
    const res = await fetch('/api/admin/trainings/ai/replenish-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources, model, excluded }),
    });
    if (!res.ok) {
      const msg = await readError(res);
      setError(msg);
      return false;
    }
    const data = (await res.json()) as { question?: RawQuestion };
    if (!data.question) return false;
    const withSource = withId(data.question);
    if (!withSource) return false; // sourceQuote yoktu → atla
    setQueue((prev) => [...prev, withSource]);
    return true;
  }, [sources, model]);

  const fireReplenish = useCallback(async () => {
    setReplenishCount((c) => c + 1);
    try {
      await fetchOneToQueue();
    } catch {
      setError('Yenileme başarısız — yeni soru eklenemedi.');
    } finally {
      setReplenishCount((c) => Math.max(0, c - 1));
    }
  }, [fetchOneToQueue]);

  const refillQueue = useCallback(async () => {
    const need = QUEUE_TARGET - queueRef.current.length;
    if (need <= 0) return;
    setReplenishCount((c) => c + need);
    try {
      // Paralel — N paralel API çağrısı; her biri 1 soru getirir, queue'ya eklenir.
      // Race güvenli çünkü her çağrı kendi `excluded` listesini hesaplar
      // (current displayed + queue + static); ufak bir tekrar riski vardır
      // ama tekrar gelen sorular zaten farklı clientId ile kaydedilir.
      await Promise.all(Array.from({ length: need }, () => fetchOneToQueue()));
    } catch {
      setError('Yedek üretimi başarısız — lütfen tekrar deneyin.');
    } finally {
      setReplenishCount((c) => Math.max(0, c - need));
    }
  }, [fetchOneToQueue]);

  const remove = useCallback(
    (clientId: string) => {
      // Optimistic: remove from displayed and pull one from queue.
      let pulled: GeneratedQuestion | undefined;
      setQueue((prevQ) => {
        if (prevQ.length === 0) return prevQ;
        pulled = prevQ[0];
        return prevQ.slice(1);
      });
      setDisplayed((prev) => {
        const filtered = prev.filter((q) => q.clientId !== clientId);
        if (pulled) {
          return [...filtered, pulled];
        }
        return filtered;
      });
      // Fire-and-forget replenish.
      void fireReplenish();
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
