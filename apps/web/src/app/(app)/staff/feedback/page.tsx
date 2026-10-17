'use client';

/**
 * Staff Geri Bildirim Listesi — Clinical Editorial dil.
 *
 * Bekleyen tüm geri bildirimleri (zorunlu + opsiyonel) listeler. Banner
 * (`MandatoryFeedbackBanner`) yalnızca tek bir mandatory pending olduğunu
 * söyler; bu sayfa hepsini görmek için tasarlandı.
 */

import Link from 'next/link';
import { MessageSquare, ChevronRight, Inbox, AlertCircle, ClipboardCheck } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import {
  INK, INK_SOFT, CREAM, RULE, GOLD, OLIVE, CARD_BG,
  TONE_TOKENS, FONT_DISPLAY, FONT_MONO,
} from '@/lib/editorial-palette';

interface PendingItem {
  trainingId: string;
  trainingTitle: string;
  attemptId: string;
  isMandatory: boolean;
  postExamCompletedAt: string | null;
}

interface PendingResponse {
  items: PendingItem[];
  formActive: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StaffFeedbackPage() {
  const { data, isLoading, error } = useFetch<PendingResponse>('/api/staff/feedback/pending');

  const items = data?.items ?? [];
  const formActive = data?.formActive ?? false;
  const mandatory = items.filter(i => i.isMandatory);
  const optional = items.filter(i => !i.isMandatory);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto" style={{ background: CREAM }}>
      <header className="mb-8">
        <p
          className="text-[11px] tracking-[0.18em] mb-2"
          style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
        >
          GERİ BİLDİRİM
        </p>
        <h1
          className="text-[28px] md:text-[34px] leading-tight font-bold"
          style={{ color: INK, fontFamily: FONT_DISPLAY }}
        >
          Bekleyen Geri Bildirimler
        </h1>
        <p className="text-[14px] mt-2" style={{ color: INK_SOFT }}>
          Tamamladığınız eğitimlerin değerlendirme formlarını burada doldurabilirsiniz.
        </p>
      </header>

      {isLoading && (
        <div
          className="rounded-2xl p-8 text-center text-[14px]"
          style={{ background: CARD_BG, border: `1px solid ${RULE}`, color: INK_SOFT }}
        >
          Yükleniyor…
        </div>
      )}

      {error && !isLoading && (
        <div
          className="rounded-2xl p-6 flex items-start gap-3"
          style={{
            background: TONE_TOKENS.danger.bg,
            border: `1px solid ${TONE_TOKENS.danger.border}`,
            color: TONE_TOKENS.danger.ink,
          }}
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-[2px]" />
          <div>
            <p className="text-[13px] font-semibold">Liste alınamadı</p>
            <p className="text-[13px] mt-1">Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.</p>
          </div>
        </div>
      )}

      {!isLoading && !error && !formActive && (
        <div
          className="rounded-2xl p-6 flex items-start gap-3"
          style={{
            background: TONE_TOKENS.info.bg,
            border: `1px solid ${TONE_TOKENS.info.border}`,
            color: TONE_TOKENS.info.ink,
          }}
        >
          <MessageSquare className="h-5 w-5 shrink-0 mt-[2px]" />
          <div>
            <p className="text-[13px] font-semibold">Geri bildirim formu yapılandırılmamış</p>
            <p className="text-[13px] mt-1">
              Hastane yönetimi henüz EY.FR.40 değerlendirme formunu aktif etmemiş.
              Form aktif olduğunda tamamladığınız eğitimler için burada listelenir.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && formActive && items.length === 0 && (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: CARD_BG, border: `1px solid ${RULE}` }}
        >
          <Inbox className="h-10 w-10 mx-auto mb-3" style={{ color: GOLD }} />
          <p className="text-[15px] font-semibold" style={{ color: INK }}>
            Bekleyen geri bildiriminiz yok
          </p>
          <p className="text-[13px] mt-2" style={{ color: INK_SOFT }}>
            Tüm değerlendirme formlarını tamamladınız.
          </p>
        </div>
      )}

      {!isLoading && !error && formActive && mandatory.length > 0 && (
        <FeedbackSection
          label="ZORUNLU"
          tone="danger"
          items={mandatory}
        />
      )}

      {!isLoading && !error && formActive && optional.length > 0 && (
        <FeedbackSection
          label="ÖNERİLEN"
          tone="neutral"
          items={optional}
        />
      )}
    </div>
  );
}

function FeedbackSection({
  label, tone, items,
}: {
  label: string;
  tone: 'danger' | 'neutral';
  items: PendingItem[];
}) {
  return (
    <section className="mb-8">
      <p
        className="text-[11px] tracking-[0.18em] mb-3"
        style={{
          color: tone === 'danger' ? TONE_TOKENS.danger.border : INK_SOFT,
          fontFamily: FONT_MONO,
        }}
      >
        {label} · {items.length}
      </p>
      <ul className="flex flex-col gap-3">
        {items.map(item => (
          <li key={item.attemptId}>
            <Link
              href={`/exam/${item.trainingId}/feedback?attemptId=${item.attemptId}`}
              className="block rounded-2xl p-4 md:p-5 hover:opacity-90"
              style={{
                background: CARD_BG,
                border: `1px solid ${RULE}`,
                color: INK,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: tone === 'danger' ? TONE_TOKENS.danger.bg : `${GOLD}20`,
                    color: tone === 'danger' ? TONE_TOKENS.danger.border : OLIVE,
                  }}
                >
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[15px] font-semibold leading-tight truncate"
                    style={{ color: INK, fontFamily: FONT_DISPLAY }}
                  >
                    {item.trainingTitle}
                  </p>
                  <p
                    className="text-[12px] mt-1 tracking-[0.06em]"
                    style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                  >
                    Tamamlandı: {formatDate(item.postExamCompletedAt)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0" style={{ color: INK_SOFT }} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
