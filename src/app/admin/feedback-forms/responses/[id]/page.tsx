'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserX, Calendar, Check, X, Building2 } from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface ItemDetail {
  id: string; text: string;
  questionType: 'likert_5' | 'yes_partial_no' | 'text';
  order: number;
  answer: { score: number | null; textAnswer: string | null } | null;
}
interface CategoryDetail { id: string; name: string; order: number; items: ItemDetail[]; }
interface ResponseDetail {
  id: string; submittedAt: string; isPassed: boolean;
  overallScore: number | null;
  training: { id: string; title: string };
  form: { id: string; title: string; documentCode: string | null; categories: CategoryDetail[] };
  participant: { id: string; name: string; email: string; title: string | null; departmentName: string | null } | null;
}

const LIKERT: Record<number, string> = { 1: 'Çok Zayıf', 2: 'Zayıf', 3: 'Orta', 4: 'İyi', 5: 'Çok İyi' };
const YPN: Record<number, string> = { 1: 'Evet', 2: 'Kısmen', 3: 'Hayır' };

function scoreColor(score: number, max: number) {
  const r = score / max;
  if (r >= 0.8) return K.SUCCESS;
  if (r >= 0.6) return K.PRIMARY;
  if (r >= 0.4) return K.WARNING;
  return K.ERROR;
}

const cardStyle = { background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD };

export default function FeedbackResponseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/feedback/responses/${id}`).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoading />;
  if (!data?.form) return (
    <div className="max-w-4xl mx-auto space-y-5">
      <p className="text-[14px]" style={{ color: K.TEXT_MUTED }}>Yanıt bulunamadı.</p>
      <button onClick={() => router.back()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold"
        style={{ background: K.SURFACE, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}` }}>
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>
    </div>
  );

  const overall = data.overallScore;
  const overallCol = overall === null ? K.TEXT_MUTED : scoreColor(overall, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold"
        style={{ background: K.SURFACE, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}` }}>
        <ArrowLeft className="w-4 h-4" /> Yanıtlara Dön
      </button>

      {/* Header */}
      <div>
        <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full inline-flex mb-2"
          style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}>
          {data.form.documentCode ?? 'EY.FR.40'}
        </span>
        <h1 className="text-[22px] font-bold" style={{ fontFamily: K.FONT_DISPLAY, letterSpacing: '-0.5px', color: K.TEXT_PRIMARY }}>{data.form.title}</h1>
        <p className="text-[14px] mt-0.5" style={{ color: K.TEXT_MUTED }}>{data.training.title}</p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Date */}
        <div className="p-4" style={cardStyle}>
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" style={{ color: K.TEXT_MUTED }} />
            <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: K.TEXT_MUTED }}>Tarih</span>
          </div>
          <p className="text-[12px] font-semibold" style={{ color: K.TEXT_PRIMARY }}>{new Date(data.submittedAt).toLocaleString('tr-TR')}</p>
        </div>

        {/* Status */}
        <div className="p-4" style={cardStyle}>
          <span className="text-[11px] uppercase tracking-wider font-semibold block mb-2" style={{ color: K.TEXT_MUTED }}>Durum</span>
          {data.isPassed ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: K.SUCCESS }}>
              <Check className="w-4 h-4" /> Geçti
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: K.ERROR }}>
              <X className="w-4 h-4" /> Kaldı
            </span>
          )}
        </div>

        {/* Participant */}
        <div className="p-4" style={cardStyle}>
          <span className="text-[11px] uppercase tracking-wider font-semibold block mb-2" style={{ color: K.TEXT_MUTED }}>Katılımcı</span>
          {data.participant ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: K.PRIMARY }}>
                {data.participant.name.charAt(0)}
              </div>
              <span className="text-[12px] font-semibold truncate" style={{ color: K.TEXT_PRIMARY }}>{data.participant.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2" style={{ color: K.TEXT_MUTED }}>
              <UserX className="w-4 h-4" /><span className="text-[12px]">Anonim</span>
            </div>
          )}
        </div>

        {/* Score */}
        <div className="p-4" style={cardStyle}>
          <span className="text-[11px] uppercase tracking-wider font-semibold block mb-2" style={{ color: K.TEXT_MUTED }}>Genel Puan</span>
          <p className="text-[26px] font-bold tabular-nums" style={{ color: overallCol, fontFamily: K.FONT_DISPLAY }}>
            {overall !== null ? overall.toFixed(2) : '—'}
            {overall !== null && <span className="text-[12px] font-normal ml-1" style={{ color: K.TEXT_MUTED }}>/ 5</span>}
          </p>
        </div>
      </div>

      {/* Dept badge */}
      {data.participant?.departmentName && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}>
          <Building2 className="w-4 h-4" />
          <span className="text-[13px] font-semibold">{data.participant.departmentName}</span>
          {data.participant.title && <span className="text-[12px] opacity-60">· {data.participant.title}</span>}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        {data.form.categories.map((cat, ci) => (
          <div key={cat.id} className="overflow-hidden" style={cardStyle}>
            <div className="px-6 py-3.5 flex items-center gap-3"
              style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}>
                {ci + 1}
              </div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>{cat.name}</h3>
            </div>
            <div>
              {cat.items.map((item, ii) => {
                const ans = item.answer;
                const score = ans?.score ?? null;
                const maxVal = item.questionType === 'likert_5' ? 5 : 3;
                const col = score === null ? K.TEXT_MUTED
                  : item.questionType === 'likert_5'
                    ? scoreColor(score, 5)
                    : score === 1 ? K.SUCCESS : score === 2 ? K.WARNING : K.ERROR;
                const label = item.questionType === 'likert_5' && score !== null ? LIKERT[score]
                  : item.questionType === 'yes_partial_no' && score !== null ? YPN[score] : null;

                return (
                  <div key={item.id} className="px-6 py-3.5 flex items-center gap-4"
                    style={{ borderBottom: ii < cat.items.length - 1 ? `1px solid ${K.BORDER_LIGHT}` : 'none' }}>
                    <span className="text-[10px] font-bold w-5 text-center shrink-0 tabular-nums" style={{ color: K.TEXT_MUTED }}>{ii + 1}</span>
                    <p className="flex-1 text-[13px] leading-snug" style={{ color: K.TEXT_PRIMARY }}>{item.text}</p>
                    <div className="shrink-0 flex items-center gap-3 min-w-[180px] justify-end">
                      {ans === null ? (
                        <span className="text-[12px]" style={{ color: K.TEXT_MUTED }}>—</span>
                      ) : item.questionType === 'text' && ans.textAnswer ? (
                        <span className="text-[12px] italic max-w-[160px] text-right" style={{ color: K.TEXT_MUTED }}>
                          &quot;{ans.textAnswer}&quot;
                        </span>
                      ) : score !== null ? (
                        <>
                          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: K.BORDER_LIGHT }}>
                            <div className="h-full rounded-full" style={{ width: `${(score / maxVal) * 100}%`, background: col }} />
                          </div>
                          <span className="text-[12px] font-bold tabular-nums" style={{ color: col }}>{score}/{maxVal}</span>
                          {label && <span className="text-[11px] hidden md:block" style={{ color: K.TEXT_MUTED }}>{label}</span>}
                        </>
                      ) : (
                        <span className="text-[12px]" style={{ color: K.TEXT_MUTED }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
