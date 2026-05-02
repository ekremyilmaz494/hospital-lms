'use client';

/**
 * AI question generation queue hook — 10+5 hybrid strategy.
 *
 * Initial generate() istekte 15 soru üretilir: 10 tanesi `displayed`'a,
 * 5 tanesi gizli `queue`'a düşer. Admin bir soru silince queue'dan biri
 * displayed slot'una çekilir ve arka planda yeni bir soru üretmek için
 * replenish endpoint'i fire-and-forget çağrılır. Birden fazla silme aynı
 * anda olursa her biri kendi replenish çağrısını başlatır — yarış güvenli.
 */

import { useCallback, useRef, useState } from 'react';

export interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  /** Stable client-side id for React keys. */
  clientId: string;
}

export interface UseAiQuestionQueueOptions {
  sourceS3Keys: string[];
  model: string;
  /** Admin'in hedeflediği toplam soru sayısı (default 10). Hook bu sayı kadar
   * `displayed` tutar; queue ise her zaman 5 yedek. Hedef 0 veya negatifse
   * generate() error verir (UI'da disabled tutulmalı). */
  displayTarget?: number;
  /** Manuel olarak yazılmış soruların metinleri — AI'nın dedup için tekrar
   * etmemesi gereken sorular. excluded listesine her çağrıda eklenir
   * (initial generate + her replenish). */
  staticExcluded?: { text: string }[];
}

export interface UseAiQuestionQueueReturn {
  displayed: GeneratedQuestion[];
  queue: GeneratedQuestion[];
  loading: boolean;
  error: string | null;
  generate: () => Promise<void>;
  remove: (clientId: string) => void;
  reset: () => void;
  isGenerating: boolean;
  isReplenishing: boolean;
}

interface RawQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
}

const DEFAULT_DISPLAY_TARGET = 10;
const QUEUE_TARGET = 5;

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const withId = (q: RawQuestion): GeneratedQuestion => ({
  questionText: q.questionText,
  options: q.options,
  correctIndex: q.correctIndex,
  clientId: newId(),
});

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
  const { sourceS3Keys, model, displayTarget = DEFAULT_DISPLAY_TARGET, staticExcluded = [] } = options;
  // Sınırla: 0-20 arası int. 0 → generate disabled.
  const displayTargetSafe = Math.max(0, Math.min(20, Math.floor(displayTarget)));

  // Static excluded'ı ref'e koy ki async callback'ler güncel manueli görsün.
  const staticExcludedRef = useRef<{ text: string }[]>([]);
  staticExcludedRef.current = staticExcluded;

  const [displayed, setDisplayed] = useState<GeneratedQuestion[]>([]);
  const [queue, setQueue] = useState<GeneratedQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [replenishCount, setReplenishCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Race-safety: Refs for current state to use in fire-and-forget callbacks.
  const displayedRef = useRef<GeneratedQuestion[]>([]);
  const queueRef = useRef<GeneratedQuestion[]>([]);
  displayedRef.current = displayed;
  queueRef.current = queue;

  const reset = useCallback(() => {
    setDisplayed([]);
    setQueue([]);
    setError(null);
    setIsGenerating(false);
    setReplenishCount(0);
  }, []);

  const generate = useCallback(async () => {
    if (sourceS3Keys.length === 0) {
      setError('Önce en az bir kaynak (PDF) seçin.');
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
          sourceS3Keys,
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
      const all = Array.isArray(data.questions) ? data.questions.map(withId) : [];
      if (all.length === 0) {
        setError('Hiç soru üretilemedi. Lütfen farklı bir kaynak veya model deneyin.');
        return;
      }
      setDisplayed(all.slice(0, displayTargetSafe));
      setQueue(all.slice(displayTargetSafe, displayTargetSafe + QUEUE_TARGET));
    } catch {
      setError('Ağ hatası — lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  }, [sourceS3Keys, model, displayTargetSafe]);

  const fireReplenish = useCallback(async () => {
    setReplenishCount((c) => c + 1);
    try {
      const excluded = [
        ...staticExcludedRef.current,
        ...displayedRef.current.map((q) => ({ text: q.questionText })),
        ...queueRef.current.map((q) => ({ text: q.questionText })),
      ];
      const res = await fetch('/api/admin/trainings/ai/replenish-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceS3Keys, model, excluded }),
      });
      if (!res.ok) {
        const msg = await readError(res);
        setError(msg);
        return;
      }
      const data = (await res.json()) as { question?: RawQuestion };
      if (!data.question) return;
      setQueue((prev) => [...prev, withId(data.question as RawQuestion)]);
    } catch {
      setError('Yenileme başarısız — yeni soru eklenemedi.');
    } finally {
      setReplenishCount((c) => Math.max(0, c - 1));
    }
  }, [sourceS3Keys, model]);

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
    isGenerating,
    isReplenishing: replenishCount > 0,
  };
}
