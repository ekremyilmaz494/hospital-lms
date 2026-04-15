'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';

interface PendingFeedback {
  trainingId: string;
  trainingTitle: string;
  attemptId: string;
}

/**
 * Staff dashboard + my-trainings sayfalarının üstünde gösterilir.
 * Kullanıcının bekleyen ZORUNLU geri bildirimi varsa kırmızı uyarı çıkar.
 * Yoksa render etmez (null). 30s cache'li, re-render'da server'a gitmez.
 */
export function MandatoryFeedbackBanner() {
  const { data, isLoading } = useFetch<{ pending: PendingFeedback | null }>(
    '/api/staff/pending-mandatory-feedback',
  );

  if (isLoading || !data?.pending) return null;
  const { trainingId, trainingTitle, attemptId } = data.pending;

  return (
    <div
      className="mb-5 rounded-2xl p-5 flex items-start gap-4"
      style={{
        background: 'var(--color-error-bg)',
        border: '1px solid color-mix(in srgb, var(--color-error) 30%, transparent)',
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--color-error)', color: 'white' }}
      >
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[14px] font-bold mb-1" style={{ color: 'var(--color-error)' }}>
          Zorunlu geri bildirim bekleniyor
        </h3>
        <p className="text-[13px] mb-3" style={{ color: 'var(--color-text)' }}>
          <span className="font-semibold">&quot;{trainingTitle}&quot;</span> eğitimi için
          geri bildirim formunu doldurmalısınız. Bu form doldurulmadan başka bir
          eğitime başlayamazsınız.
        </p>
        <Link
          href={`/exam/${trainingId}/feedback?attemptId=${attemptId}`}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: 'var(--color-error)' }}
        >
          Geri Bildirimi Doldur
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
