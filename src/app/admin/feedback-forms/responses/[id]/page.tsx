'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserX, Calendar, Check, X, Building2 } from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';

interface ItemDetail {
  id: string; text: string;
  questionType: 'likert_5' | 'yes_partial_no' | 'text';
  order: number;
  answer: { score: number | null; textAnswer: string | null } | null;
}
interface CategoryDetail { id: string; name: string; order: number; items: ItemDetail[]; }
interface ResponseDetail {
  id: string; submittedAt: string; isPassed: boolean;
  training: { id: string; title: string };
  form: { id: string; title: string; documentCode: string | null; categories: CategoryDetail[] };
  participant: { id: string; name: string; email: string; title: string | null; departmentName: string | null } | null;
}

const LIKERT: Record<number, string> = { 1: 'Çok Zayıf', 2: 'Zayıf', 3: 'Orta', 4: 'İyi', 5: 'Çok İyi' };
const YPN: Record<number, string> = { 1: 'Evet', 2: 'Kısmen', 3: 'Hayır' };

function scoreColor(score: number, max: number) {
  const r = score / max;
  if (r >= 0.8) return 'var(--color-success)';
  if (r >= 0.6) return 'var(--color-primary)';
  if (r >= 0.4) return '#f59e0b';
  return 'var(--color-error)';
}

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
      <p className="text-[14px]" style={{ color: 'var(--color-text-muted)' }}>Yanıt bulunamadı.</p>
      <button onClick={() => router.back()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold"
        style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>
    </div>
  );

  const allScores = data.form.categories.flatMap(c =>
    c.items.filter(i => i.questionType === 'likert_5' && i.answer?.score !== null).map(i => i.answer!.score!)
  );
  const overall = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const overallCol = overall === null ? 'var(--color-text-muted)' : scoreColor(overall, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold"
        style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
        <ArrowLeft className="w-4 h-4" /> Yanıtlara Dön
      </button>

      {/* Header */}
      <div>
        <span className="text-[10px] font-bold tracking-[3px] uppercase px-2.5 py-1 rounded-full inline-flex mb-2"
          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)30' }}>
          {data.form.documentCode ?? 'EY.FR.40'}
        </span>
        <h1 className="text-[22px] font-black" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', color: 'var(--color-text)' }}>{data.form.title}</h1>
        <p className="text-[14px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{data.training.title}</p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Date */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-[10px] uppercase tracking-[2px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Tarih</span>
          </div>
          <p className="text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>{new Date(data.submittedAt).toLocaleString('tr-TR')}</p>
        </div>

        {/* Status */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase tracking-[2px] font-bold block mb-2" style={{ color: 'var(--color-text-muted)' }}>Durum</span>
          {data.isPassed ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--color-success)' }}>
              <Check className="w-4 h-4" /> Geçti
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--color-error)' }}>
              <X className="w-4 h-4" /> Kaldı
            </span>
          )}
        </div>

        {/* Participant */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase tracking-[2px] font-bold block mb-2" style={{ color: 'var(--color-text-muted)' }}>Katılımcı</span>
          {data.participant ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: 'var(--color-primary)' }}>
                {data.participant.name.charAt(0)}
              </div>
              <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>{data.participant.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
              <UserX className="w-4 h-4" /><span className="text-[12px]">Anonim</span>
            </div>
          )}
        </div>

        {/* Score */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase tracking-[2px] font-bold block mb-2" style={{ color: 'var(--color-text-muted)' }}>Genel Puan</span>
          <p className="text-[26px] font-black tabular-nums" style={{ color: overallCol, fontFamily: 'var(--font-display)' }}>
            {overall !== null ? overall.toFixed(2) : '—'}
            {overall !== null && <span className="text-[12px] font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>/ 5</span>}
          </p>
        </div>
      </div>

      {/* Dept badge */}
      {data.participant?.departmentName && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)25' }}>
          <Building2 className="w-4 h-4" />
          <span className="text-[13px] font-semibold">{data.participant.departmentName}</span>
          {data.participant.title && <span className="text-[12px] opacity-60">· {data.participant.title}</span>}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        {data.form.categories.map((cat, ci) => (
          <div key={cat.id} className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="px-6 py-3.5 flex items-center gap-3"
              style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)30' }}>
                {ci + 1}
              </div>
              <h3 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{cat.name}</h3>
            </div>
            <div>
              {cat.items.map((item, ii) => {
                const ans = item.answer;
                const score = ans?.score ?? null;
                const maxVal = item.questionType === 'likert_5' ? 5 : 3;
                const col = score === null ? 'var(--color-text-muted)'
                  : item.questionType === 'likert_5'
                    ? scoreColor(score, 5)
                    : score === 1 ? 'var(--color-success)' : score === 2 ? '#f59e0b' : 'var(--color-error)';
                const label = item.questionType === 'likert_5' && score !== null ? LIKERT[score]
                  : item.questionType === 'yes_partial_no' && score !== null ? YPN[score] : null;

                return (
                  <div key={item.id} className="px-6 py-3.5 flex items-center gap-4"
                    style={{ borderBottom: ii < cat.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <span className="text-[10px] font-black w-5 text-center shrink-0 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{ii + 1}</span>
                    <p className="flex-1 text-[13px] leading-snug" style={{ color: 'var(--color-text)' }}>{item.text}</p>
                    <div className="shrink-0 flex items-center gap-3 min-w-[180px] justify-end">
                      {ans === null ? (
                        <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
                      ) : item.questionType === 'text' && ans.textAnswer ? (
                        <span className="text-[12px] italic max-w-[160px] text-right" style={{ color: 'var(--color-text-muted)' }}>
                          &quot;{ans.textAnswer}&quot;
                        </span>
                      ) : score !== null ? (
                        <>
                          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                            <div className="h-full rounded-full" style={{ width: `${(score / maxVal) * 100}%`, background: col }} />
                          </div>
                          <span className="text-[12px] font-bold tabular-nums" style={{ color: col }}>{score}/{maxVal}</span>
                          {label && <span className="text-[11px] hidden md:block" style={{ color: 'var(--color-text-muted)' }}>{label}</span>}
                        </>
                      ) : (
                        <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
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
