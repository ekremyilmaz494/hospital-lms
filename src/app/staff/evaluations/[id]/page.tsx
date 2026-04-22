'use client';

/**
 * Değerlendirme Wizard — "Clinical Editorial" redesign.
 * 360° değerlendirme form sayfası. Functionality korundu — sadece görsel
 * tabaka editorial dile taşındı. Star rating GOLD dolgu + RULE outline,
 * textarea sharp border, progress bar editorial palette.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle, Star } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import {
  INK, INK_SOFT, CREAM, GOLD, RULE, OLIVE, CARD_BG,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, TONE_TOKENS,
} from '@/lib/editorial-palette';

interface EvalItem { id: string; text: string; description: string | null; order: number }
interface EvalCategory { id: string; name: string; weight: number; order: number; items: EvalItem[] }
interface EvalForm { id: string; title: string; categories: EvalCategory[] }
interface EvalSubject { firstName: string; lastName: string; title: string | null; departmentRel: { name: string } | null }
interface Evaluation {
  id: string; status: string; evaluatorType: string;
  form: EvalForm;
  subject: EvalSubject;
  answers: { itemId: string; score: number; comment: string | null }[];
}
interface EvalData { evaluation: Evaluation; totalItems: number; answeredItems: number; progress: number }

const EVALUATOR_LABELS: Record<string, string> = {
  SELF: 'Öz Değerlendirme', MANAGER: 'Yönetici', PEER: 'Akran', SUBORDINATE: 'Ast',
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => {
        const active = (hovered || value) >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${n} yıldız`}
            className="flex h-11 w-11 items-center justify-center transition-transform hover:scale-110 sm:h-10 sm:w-10"
          >
            <Star
              className="h-7 w-7 sm:h-8 sm:w-8"
              fill={active ? GOLD : 'none'}
              style={{ color: active ? GOLD : RULE }}
            />
          </button>
        );
      })}
      {value > 0 && (
        <span
          className="ml-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
        >
          {['', 'Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Mükemmel'][value]}
        </span>
      )}
    </div>
  );
}

export default function EvaluationWizardPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const evalId = params.id as string;

  const { data, isLoading } = useFetch<EvalData>(`/api/staff/evaluations/${evalId}`);

  const [currentCatIdx, setCurrentCatIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { score: number; comment: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Mevcut cevapları başlangıç state'e yükle
  useEffect(() => {
    if (data?.evaluation.answers) {
      const initial: Record<string, { score: number; comment: string }> = {};
      for (const a of data.evaluation.answers) {
        initial[a.itemId] = { score: a.score, comment: a.comment ?? '' };
      }
      setAnswers(initial);
    }
    if (data?.evaluation.status === 'COMPLETED') setCompleted(true);
  }, [data]);

  if (isLoading && !data) return <PageLoading />;
  if (!data) {
    return (
      <div
        className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
        style={{ backgroundColor: CREAM, color: INK, fontFamily: FONT_BODY }}
      >
        <div
          className="p-10 text-center text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
        >
          Değerlendirme bulunamadı.
        </div>
      </div>
    );
  }

  const { evaluation, totalItems } = data;
  const categories = evaluation.form.categories;
  const currentCat = categories[currentCatIdx];
  const isLastCat = currentCatIdx === categories.length - 1;

  // Tüm cevaplanan madde sayısı
  const answeredCount = Object.keys(answers).length;
  const progressPct = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0;

  // Mevcut kategorideki tüm maddeler cevaplandı mı?
  const currentCatComplete = currentCat.items.every(item => (answers[item.id]?.score ?? 0) > 0);

  const setItemScore = (itemId: string, score: number) =>
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], score, comment: prev[itemId]?.comment ?? '' } }));
  const setItemComment = (itemId: string, comment: string) =>
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], comment, score: prev[itemId]?.score ?? 0 } }));

  const handleNext = () => {
    if (!currentCatComplete) { toast('Bu kategorideki tüm maddeleri puanlayın.', 'error'); return; }
    setCurrentCatIdx(i => i + 1);
  };

  const handleSubmit = async () => {
    // Tüm maddeler cevaplandı mı?
    const allItems = categories.flatMap(c => c.items);
    for (const item of allItems) {
      if (!answers[item.id]?.score) { toast('Tüm maddeleri puanlamanız gerekiyor.', 'error'); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/staff/evaluations/${evalId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([itemId, a]) => ({
            itemId, score: a.score, comment: a.comment || undefined,
          })),
        }),
      });
      if (!res.ok) { const e = await res.json(); toast(e.error ?? 'Hata oluştu', 'error'); return; }
      setCompleted(true);
      toast('Değerlendirme başarıyla tamamlandı!', 'success');
    } finally { setSubmitting(false); }
  };

  if (completed) {
    return (
      <div
        className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
        style={{ backgroundColor: CREAM, color: INK, fontFamily: FONT_BODY }}
      >
        <div className="relative px-4 sm:px-10 lg:px-16 pt-5 pb-16">
          <BlurFade delay={0}>
            <div
              className="max-w-lg mx-auto mt-16 p-10 text-center"
              style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}` }}
            >
              <div
                className="w-16 h-16 flex items-center justify-center mx-auto mb-6"
                style={{
                  backgroundColor: TONE_TOKENS.success.bg,
                  border: `1px solid ${TONE_TOKENS.success.border}`,
                }}
              >
                <CheckCircle className="h-8 w-8" style={{ color: TONE_TOKENS.success.ink }} />
              </div>
              <h2
                className="text-[28px] leading-[1.05] font-semibold tracking-[-0.02em]"
                style={{ color: INK, fontFamily: FONT_DISPLAY }}
              >
                Değerlendirme <span style={{ fontStyle: 'italic', color: OLIVE }}>tamamlandı</span>
                <span style={{ color: GOLD }}>.</span>
              </h2>
              <p className="text-[13px] mt-3" style={{ color: INK_SOFT }}>
                {evaluation.subject.firstName} {evaluation.subject.lastName} için değerlendirmeniz kaydedildi.
              </p>
              <button
                onClick={() => router.push('/staff/evaluations')}
                className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] px-5 py-2.5"
                style={{
                  backgroundColor: OLIVE,
                  color: CREAM,
                  fontFamily: FONT_MONO,
                }}
              >
                Değerlendirmelerime Dön
              </button>
            </div>
          </BlurFade>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{ backgroundColor: CREAM, color: INK, fontFamily: FONT_BODY }}
    >
      <div className="relative px-4 sm:px-10 lg:px-16 pt-5 pb-16">
        {/* ───── Masthead ───── */}
        <BlurFade delay={0}>
          <header
            className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b pb-5"
            style={{ borderColor: INK }}
          >
            <div className="flex items-end gap-4">
              <h1
                className="text-[32px] sm:text-[40px] leading-[0.95] font-semibold tracking-[-0.025em]"
                style={{ fontFamily: FONT_DISPLAY }}
              >
                <span style={{ fontStyle: 'italic', color: OLIVE }}>{evaluation.subject.firstName}</span>{' '}
                {evaluation.subject.lastName}
                <span style={{ color: GOLD }}>.</span>
              </h1>
            </div>
            <div className="text-right">
              <p
                className="text-[36px] sm:text-[44px] leading-none font-semibold tabular-nums tracking-[-0.025em]"
                style={{ color: INK, fontFamily: FONT_DISPLAY }}
              >
                {progressPct}
                <span
                  className="text-[13px] ml-0.5 align-top"
                  style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                >
                  %
                </span>
              </p>
              <p
                className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] tabular-nums"
                style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
              >
                {answeredCount}/{totalItems} Madde
              </p>
            </div>
          </header>
          <p
            className="mt-3 text-[12px] uppercase tracking-[0.16em]"
            style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
          >
            {evaluation.form.title}
            {evaluation.subject.departmentRel && ` · ${evaluation.subject.departmentRel.name}`}
          </p>

          {/* Progress bar */}
          <div
            className="mt-4 h-[3px] overflow-hidden"
            style={{ backgroundColor: RULE }}
          >
            <div
              className="h-full"
              style={{
                width: `${progressPct}%`,
                backgroundColor: OLIVE,
                transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          {/* Category steps */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {categories.map((cat, i) => {
              const catComplete = cat.items.every(item => (answers[item.id]?.score ?? 0) > 0);
              const isCurrent = i === currentCatIdx;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCurrentCatIdx(i)}
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1.5"
                  style={{
                    backgroundColor: isCurrent ? OLIVE : catComplete ? TONE_TOKENS.success.bg : CARD_BG,
                    color: isCurrent ? CREAM : catComplete ? TONE_TOKENS.success.ink : INK_SOFT,
                    border: `1px solid ${isCurrent ? OLIVE : catComplete ? TONE_TOKENS.success.border : RULE}`,
                    fontFamily: FONT_MONO,
                  }}
                >
                  <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {catComplete && !isCurrent && <CheckCircle className="h-3 w-3" />}
                  <span className="normal-case" style={{ letterSpacing: 0, fontFamily: FONT_DISPLAY }}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </BlurFade>

        {/* ───── Current Category Items ───── */}
        <BlurFade delay={0.05} key={currentCatIdx}>
          <section
            className="mt-8"
            style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}` }}
          >
            <div
              className="px-5 py-4 border-b"
              style={{ borderColor: RULE, backgroundColor: CREAM }}
            >
              <h2
                className="text-[18px] font-semibold tracking-[-0.01em]"
                style={{ color: INK, fontFamily: FONT_DISPLAY }}
              >
                {currentCat.name}
              </h2>
              <p
                className="text-[10px] mt-1 font-semibold uppercase tracking-[0.16em] tabular-nums"
                style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
              >
                Ağırlık %{currentCat.weight} · {currentCat.items.length} Madde
              </p>
            </div>

            <div className="divide-y" style={{ borderColor: RULE }}>
              {currentCat.items.map((item, itemIdx) => {
                const ans = answers[item.id];
                const answered = (ans?.score ?? 0) > 0;
                return (
                  <div key={item.id} className="px-5 py-5" style={{ borderColor: RULE }}>
                    <div className="flex items-start gap-4 mb-4">
                      <span
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[11px] font-semibold tabular-nums mt-0.5"
                        style={{
                          backgroundColor: answered ? TONE_TOKENS.success.bg : CREAM,
                          color: answered ? TONE_TOKENS.success.ink : INK_SOFT,
                          border: `1px solid ${answered ? TONE_TOKENS.success.border : RULE}`,
                          fontFamily: FONT_MONO,
                        }}
                      >
                        {String(itemIdx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-[14px] font-medium leading-snug"
                          style={{ color: INK }}
                        >
                          {item.text}
                        </p>
                        {item.description && (
                          <p
                            className="text-[12px] mt-1 leading-relaxed"
                            style={{ color: INK_SOFT }}
                          >
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="ml-12 space-y-3">
                      <StarRating value={ans?.score ?? 0} onChange={score => setItemScore(item.id, score)} />
                      <textarea
                        value={ans?.comment ?? ''}
                        onChange={e => setItemComment(item.id, e.target.value)}
                        placeholder="Opsiyonel yorum..."
                        rows={2}
                        className="w-full text-[13px] px-3 py-2 resize-none outline-none focus:outline-none"
                        style={{
                          border: `1px solid ${RULE}`,
                          backgroundColor: CREAM,
                          color: INK,
                          fontFamily: FONT_BODY,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </BlurFade>

        {/* ───── Navigation ───── */}
        <BlurFade delay={0.1}>
          <div className="flex items-center justify-between gap-2 mt-6">
            <button
              type="button"
              onClick={() => setCurrentCatIdx(i => i - 1)}
              disabled={currentCatIdx === 0}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] px-4 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: CARD_BG,
                color: INK,
                border: `1px solid ${RULE}`,
                fontFamily: FONT_MONO,
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Önceki</span>
            </button>

            {!isLastCat ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] px-4 py-2.5"
                style={{
                  backgroundColor: OLIVE,
                  color: CREAM,
                  fontFamily: FONT_MONO,
                }}
              >
                <span className="sm:hidden">Devam</span>
                <span className="hidden sm:inline">Kaydet ve Devam</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] px-4 py-2.5 disabled:opacity-60"
                style={{
                  backgroundColor: TONE_TOKENS.success.border,
                  color: '#ffffff',
                  fontFamily: FONT_MONO,
                }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle className="h-4 w-4" />
                <span className="sm:hidden">Tamamla</span>
                <span className="hidden sm:inline">Değerlendirmeyi Tamamla</span>
              </button>
            )}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
