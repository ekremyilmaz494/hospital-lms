'use client';

/**
 * Yetkinlik Sonuçlarım — kendi tamamlanmış yetkinlik değerlendirmeleri.
 * Clinical Editorial dil: kategori bazlı puan görünümü.
 */

import { Target, BarChart2, Inbox } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import {
  INK, INK_SOFT, CREAM, RULE, GOLD, OLIVE, CARD_BG,
  TONE_TOKENS, FONT_DISPLAY, FONT_MONO, STATUS_TOKENS,
} from '@/lib/editorial-palette';

interface CategoryResult {
  id: string;
  name: string;
  weight: number;
  avgScore: number | null;
}

interface EvaluationResult {
  id: string;
  formTitle: string;
  periodEnd: string | null;
  evaluatorType: string;
  overallScore: number | null;
  completedAt: string | null;
  categories: CategoryResult[];
}

interface CompetencyResponse {
  evaluations: EvaluationResult[];
}

const EVAL_TYPE_LABELS: Record<string, string> = {
  SELF:        'Öz Değerlendirme',
  MANAGER:     'Yönetici',
  PEER:        'Meslektaş',
  SUBORDINATE: 'Ast',
};

function ScoreBar({ score, max = 5 }: { score: number | null; max?: number }) {
  if (score === null) return <span className="text-[12px]" style={{ color: INK_SOFT }}>—</span>;
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? STATUS_TOKENS.completed.dot : pct >= 60 ? STATUS_TOKENS.in_progress.dot : STATUS_TOKENS.failed.dot;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full h-[6px]" style={{ background: RULE }}>
        <div
          className="h-[6px] rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[12px] font-semibold tabular-nums w-8 text-right" style={{ color: INK, fontFamily: FONT_MONO }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export default function CompetencyPage() {
  const { data, isLoading, error } = useFetch<CompetencyResponse>('/api/staff/competency/me');
  const evaluations = data?.evaluations ?? [];

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto" style={{ background: CREAM }}>
      <header className="mb-8">
        <p className="text-[11px] tracking-[0.18em] mb-2" style={{ color: INK_SOFT, fontFamily: FONT_MONO }}>
          YETKİNLİK
        </p>
        <h1 className="text-[28px] md:text-[34px] leading-tight font-bold" style={{ color: INK, fontFamily: FONT_DISPLAY }}>
          Yetkinlik Sonuçlarım
        </h1>
        <p className="text-[14px] mt-2" style={{ color: INK_SOFT }}>
          Tamamlanmış değerlendirmelerin kategori bazlı puan görünümü.
        </p>
      </header>

      {isLoading && (
        <div className="rounded-2xl p-8 text-center text-[14px]"
          style={{ background: CARD_BG, border: `1px solid ${RULE}`, color: INK_SOFT }}>
          Yükleniyor…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-2xl p-6 flex items-start gap-3"
          style={{ background: TONE_TOKENS.danger.bg, border: `1px solid ${TONE_TOKENS.danger.border}`, color: TONE_TOKENS.danger.ink }}>
          <p className="text-[13px] font-semibold">Sonuçlar alınamadı. Lütfen sayfayı yenileyin.</p>
        </div>
      )}

      {!isLoading && !error && evaluations.length === 0 && (
        <div className="rounded-2xl p-10 text-center" style={{ background: CARD_BG, border: `1px solid ${RULE}` }}>
          <Inbox className="h-10 w-10 mx-auto mb-3" style={{ color: GOLD }} />
          <p className="text-[15px] font-semibold" style={{ color: INK }}>Henüz tamamlanmış değerlendirme yok</p>
          <p className="text-[13px] mt-2" style={{ color: INK_SOFT }}>
            Değerlendirme formları tamamlandıkça sonuçlarınız burada listelenir.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {evaluations.map(ev => (
          <div key={ev.id} className="rounded-2xl overflow-hidden"
            style={{ background: CARD_BG, border: `1px solid ${RULE}` }}>
            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap"
              style={{ borderBottom: `1px solid ${RULE}` }}>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: INK, fontFamily: FONT_DISPLAY }}>
                  {ev.formTitle}
                </p>
                <p className="text-[12px] mt-1 tracking-[0.06em]" style={{ color: INK_SOFT, fontFamily: FONT_MONO }}>
                  {EVAL_TYPE_LABELS[ev.evaluatorType] ?? ev.evaluatorType}
                  {ev.completedAt && ` · ${new Date(ev.completedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              {ev.overallScore !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: `${GOLD}18` }}>
                  <Target className="h-4 w-4" style={{ color: OLIVE }} />
                  <span className="text-[18px] font-bold tabular-nums" style={{ color: OLIVE, fontFamily: FONT_MONO }}>
                    {ev.overallScore.toFixed(0)}
                  </span>
                  <span className="text-[11px]" style={{ color: INK_SOFT }}>/100</span>
                </div>
              )}
            </div>

            {ev.categories.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-[11px] tracking-[0.14em] mb-3 flex items-center gap-2"
                  style={{ color: INK_SOFT, fontFamily: FONT_MONO }}>
                  <BarChart2 className="h-3.5 w-3.5" />
                  KATEGORİ BAZLI PUANLAR (1–5)
                </p>
                <div className="flex flex-col gap-3">
                  {ev.categories.map(cat => (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px]" style={{ color: INK }}>{cat.name}</p>
                        <span className="text-[11px]" style={{ color: INK_SOFT, fontFamily: FONT_MONO }}>
                          ağırlık {cat.weight}%
                        </span>
                      </div>
                      <ScoreBar score={cat.avgScore} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
