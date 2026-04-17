'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Shield,
  Sparkles,
  MessageSquareQuote,
  ChevronRight,
  EyeOff,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

/**
 * EY.FR.40 Eğitim Değerlendirme Anket Formu — staff doldurma sayfası.
 * Akış: post-exam → transition → BU SAYFA → my-trainings
 */

type QuestionType = 'likert_5' | 'yes_partial_no' | 'text';

interface Item {
  id: string;
  text: string;
  questionType: QuestionType;
  isRequired: boolean;
  order: number;
}

interface Category {
  id: string;
  name: string;
  order: number;
  items: Item[];
}

interface FormData {
  id: string;
  title: string;
  description?: string | null;
  documentCode?: string | null;
  categories: Category[];
}

const LIKERT_OPTIONS = [
  { value: 1, label: 'Çok Zayıf', shortLabel: 'Zayıf' },
  { value: 2, label: 'Zayıf', shortLabel: 'Zayıf' },
  { value: 3, label: 'Orta', shortLabel: 'Orta' },
  { value: 4, label: 'İyi', shortLabel: 'İyi' },
  { value: 5, label: 'Çok İyi', shortLabel: 'Çok İyi' },
];

const YPN_OPTIONS = [
  { value: 1, label: 'Evet' },
  { value: 2, label: 'Kısmen' },
  { value: 3, label: 'Hayır' },
];

const LIKERT_GRADIENT: Record<number, string> = {
  1: 'linear-gradient(135deg, var(--brand-300), var(--brand-400))',
  2: 'linear-gradient(135deg, var(--brand-400), var(--brand-500))',
  3: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))',
  4: 'linear-gradient(135deg, var(--brand-600), var(--brand-700))',
  5: 'linear-gradient(135deg, var(--brand-700), var(--brand-800))',
};

function FeedbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const { toast } = useToast();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [includeName, setIncludeName] = useState(false);
  const [trainingTitle, setTrainingTitle] = useState<string | null>(null);
  const [isMandatory, setIsMandatory] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { score?: number; textAnswer?: string }>>({});

  useEffect(() => {
    if (!attemptId) {
      toast('attemptId parametresi eksik', 'error');
      router.replace('/staff/my-trainings');
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const [statusRes, formRes] = await Promise.all([
          fetch(`/api/feedback/status?attemptId=${attemptId}`),
          fetch('/api/feedback/form'),
        ]);
        const status = await statusRes.json();
        const formData = await formRes.json();

        if (cancelled) return;

        if (status.hasSubmittedFeedback) setAlreadySubmitted(true);
        if (status.trainingTitle) setTrainingTitle(status.trainingTitle as string);
        if (status.feedbackMandatory) setIsMandatory(true);

        if (!formData.form) {
          toast('Aktif geri bildirim formu bulunamadı', 'error');
          router.replace('/staff/my-trainings');
          return;
        }
        setForm(formData.form as FormData);
      } catch {
        toast('Form yüklenemedi', 'error');
        router.replace('/staff/my-trainings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attemptId, router, toast]);

  const allItems = useMemo(() => form?.categories.flatMap((c) => c.items) ?? [], [form]);

  const requiredItems = useMemo(() => allItems.filter((i) => i.isRequired), [allItems]);

  const missingRequired = useMemo(() => {
    return requiredItems.filter((item) => {
      const a = answers[item.id];
      if (!a) return true;
      if (item.questionType === 'text') return !a.textAnswer || a.textAnswer.trim().length === 0;
      return typeof a.score !== 'number';
    });
  }, [requiredItems, answers]);

  const answeredCount = useMemo(() => {
    return allItems.filter((item) => {
      const a = answers[item.id];
      if (!a) return false;
      if (item.questionType === 'text') return !!a.textAnswer && a.textAnswer.trim().length > 0;
      return typeof a.score === 'number';
    }).length;
  }, [allItems, answers]);

  const totalCount = allItems.length;
  const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const setScore = (itemId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [itemId]: { ...prev[itemId], score } }));
  };

  const setText = (itemId: string, textAnswer: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: { ...prev[itemId], textAnswer } }));
  };

  const isAnswered = (item: Item) => {
    const a = answers[item.id];
    if (!a) return false;
    if (item.questionType === 'text') return !!a.textAnswer && a.textAnswer.trim().length > 0;
    return typeof a.score === 'number';
  };

  const handleSubmit = async () => {
    if (!form || !attemptId) return;
    if (missingRequired.length > 0) {
      toast(`${missingRequired.length} zorunlu soru cevaplanmadı`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        attemptId,
        includeName,
        answers: Object.entries(answers)
          .map(([itemId, a]) => ({ itemId, score: a.score, textAnswer: a.textAnswer }))
          .filter((a) => typeof a.score === 'number' || (a.textAnswer && a.textAnswer.length > 0)),
      };
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Gönderim başarısız', 'error');
        setSubmitting(false);
        return;
      }
      toast('Teşekkürler! Geri bildiriminiz kaydedildi.', 'success');
      router.push('/staff/my-trainings');
    } catch {
      toast('Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoading />;

  if (alreadySubmitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{ background: 'var(--color-bg)' }}
      >
        <div
          aria-hidden
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--brand-300), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--brand-500), transparent 70%)' }}
        />

        <div
          className="max-w-md w-full rounded-3xl p-8 md:p-10 text-center relative z-10"
          style={{
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-card-hover)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--brand-100), var(--brand-50))',
              border: '1px solid var(--brand-200)',
            }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: 'var(--color-primary)' }} strokeWidth={2.2} />
          </div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3"
            style={{ color: 'var(--color-primary)' }}
          >
            Teşekkürler
          </p>
          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            Geri bildiriminiz alındı
          </h2>
          <p className="text-[14px] leading-relaxed mb-8" style={{ color: 'var(--color-text-secondary)' }}>
            Bu eğitim için geri bildirim formunu daha önce tamamladınız. Görüşleriniz eğitim kalitemizi
            geliştirmemize yardımcı oluyor.
          </p>
          <Button
            onClick={() => router.push('/staff/my-trainings')}
            className="w-full h-12 text-[14px] font-semibold gap-2"
          >
            Eğitimlerime Dön
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Atmospheric background blobs */}
      <div
        aria-hidden
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--brand-400), transparent 60%)',
          transform: 'translate(30%, -30%)',
        }}
      />
      <div
        aria-hidden
        className="absolute top-[40%] left-0 w-[400px] h-[400px] rounded-full blur-3xl opacity-[0.12] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--brand-600), transparent 60%)',
          transform: 'translate(-40%, 0)',
        }}
      />

      {/* Sticky progress bar */}
      <div
        className="sticky top-0 z-30 backdrop-blur-xl border-b"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span
                className="text-[11px] font-semibold uppercase tracking-wider truncate"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {trainingTitle || 'Eğitim Değerlendirmesi'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span
                className="text-[14px] font-bold tabular-nums"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}
              >
                {answeredCount}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                / {totalCount}
              </span>
            </div>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--color-surface-hover)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--brand-500), var(--brand-700))',
                transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 12px color-mix(in srgb, var(--brand-500) 50%, transparent)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-32 md:pb-12 relative z-10">
        {/* Mandatory banner */}
        {isMandatory && (
          <div
            className="mb-6 rounded-2xl p-4 md:p-5 flex items-start gap-3"
            style={{
              background: 'color-mix(in srgb, var(--color-error-bg) 60%, var(--color-surface))',
              border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)',
            }}
          >
            <div
              className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-error-bg)' }}
            >
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-error)' }} />
            </div>
            <div className="pt-1">
              <p className="text-[13px] font-bold mb-0.5" style={{ color: 'var(--color-error)' }}>
                Bu değerlendirme zorunludur
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                Formu tamamlamadan yeni bir eğitime başlayamazsınız.
              </p>
            </div>
          </div>
        )}

        {/* Editorial hero */}
        <header className="mb-10 md:mb-14 relative">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="h-px flex-1 max-w-[60px]"
              style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary))' }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ color: 'var(--color-primary)' }}
            >
              {form.documentCode || 'Geri Bildirim'}
            </span>
            <div
              className="h-px flex-1"
              style={{ background: 'linear-gradient(90deg, var(--color-primary), transparent)' }}
            />
          </div>

          <h1
            className="text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight mb-5 text-center"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            {form.title}
          </h1>

          {form.description && (
            <p
              className="text-[15px] md:text-[16px] leading-relaxed text-center max-w-xl mx-auto"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {form.description}
            </p>
          )}

          <div className="flex items-center justify-center gap-2 mt-6">
            <MessageSquareQuote className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[12px] italic text-center" style={{ color: 'var(--color-text-muted)' }}>
              Görüşleriniz eğitim kalitemizi doğrudan şekillendirir.
            </p>
          </div>
        </header>

        {/* Categories */}
        <div className="space-y-6 md:space-y-8">
          {form.categories.map((category, catIdx) => (
            <section
              key={category.id}
              className="rounded-3xl overflow-hidden relative"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)',
              }}
            >
              {/* Category header with editorial number */}
              <div
                className="px-5 md:px-8 py-5 md:py-6 flex items-center gap-4 md:gap-5 border-b relative"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'linear-gradient(90deg, var(--brand-50) 0%, transparent 60%)',
                }}
              >
                <span
                  className="text-4xl md:text-5xl font-bold leading-none tabular-nums shrink-0"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'transparent',
                    WebkitTextStroke: '1.5px var(--color-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {String(catIdx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Bölüm {catIdx + 1}
                  </p>
                  <h2
                    className="text-lg md:text-xl font-bold leading-tight"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                  >
                    {category.name}
                  </h2>
                </div>
              </div>

              {/* Items */}
              <div>
                {category.items.map((item, itemIdx) => {
                  const answered = isAnswered(item);
                  return (
                    <div
                      key={item.id}
                      className="px-5 md:px-8 py-5 md:py-6 relative"
                      style={{
                        borderTop: itemIdx === 0 ? 'none' : '1px solid var(--color-border)',
                        background: answered
                          ? 'linear-gradient(90deg, color-mix(in srgb, var(--brand-50) 40%, transparent), transparent 80%)'
                          : 'transparent',
                        transition: 'background 300ms ease',
                      }}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 transition-[background,color] duration-300"
                          style={{
                            background: answered ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                            color: answered ? '#fff' : 'var(--color-text-muted)',
                            border: answered
                              ? '1px solid var(--color-primary)'
                              : '1px solid var(--color-border)',
                          }}
                        >
                          {answered ? (
                            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                          ) : (
                            <span className="text-[10px] font-bold tabular-nums">{itemIdx + 1}</span>
                          )}
                        </div>
                        <label
                          className="block text-[14px] md:text-[15px] leading-relaxed flex-1 pt-0.5"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {item.text}
                          {item.isRequired && (
                            <span
                              className="ml-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{
                                color: 'var(--color-error)',
                                background: 'var(--color-error-bg)',
                              }}
                            >
                              Zorunlu
                            </span>
                          )}
                        </label>
                      </div>

                      {/* Likert 5 — monochromatic emerald depth scale */}
                      {item.questionType === 'likert_5' && (
                        <div className="md:pl-9">
                          <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                            {LIKERT_OPTIONS.map((opt) => {
                              const selected = answers[item.id]?.score === opt.value;
                              const intensity = opt.value / 5;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setScore(item.id, opt.value)}
                                  className="group relative rounded-xl md:rounded-2xl py-3 md:py-4 px-1 md:px-2 flex flex-col items-center justify-center min-h-[72px] md:min-h-[84px] transition-[transform,box-shadow] duration-200 active:scale-95"
                                  style={{
                                    background: selected
                                      ? LIKERT_GRADIENT[opt.value]
                                      : 'var(--color-surface-hover)',
                                    border: selected
                                      ? '1px solid transparent'
                                      : '1px solid var(--color-border)',
                                    boxShadow: selected
                                      ? `0 8px 24px color-mix(in srgb, var(--brand-${opt.value >= 4 ? '600' : '400'}) ${Math.round(intensity * 40)}%, transparent)`
                                      : 'none',
                                    transform: selected ? 'translateY(-2px)' : 'translateY(0)',
                                  }}
                                >
                                  <span
                                    className="text-lg md:text-2xl font-bold leading-none tabular-nums mb-1 md:mb-1.5"
                                    style={{
                                      fontFamily: 'var(--font-display)',
                                      color: selected ? '#fff' : 'var(--color-text-primary)',
                                    }}
                                  >
                                    {opt.value}
                                  </span>
                                  <span
                                    className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider leading-tight text-center"
                                    style={{
                                      color: selected
                                        ? 'rgba(255,255,255,0.9)'
                                        : 'var(--color-text-muted)',
                                    }}
                                  >
                                    {opt.shortLabel}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between mt-2 px-1">
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              Çok Zayıf
                            </span>
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              Çok İyi
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Yes / Partial / No */}
                      {item.questionType === 'yes_partial_no' && (
                        <div className="md:pl-9">
                          <div className="grid grid-cols-3 gap-2">
                            {YPN_OPTIONS.map((opt) => {
                              const selected = answers[item.id]?.score === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setScore(item.id, opt.value)}
                                  className="rounded-xl md:rounded-2xl py-3 md:py-3.5 px-3 text-[13px] md:text-[14px] font-semibold transition-[transform,box-shadow] duration-200 active:scale-95"
                                  style={{
                                    background: selected
                                      ? 'linear-gradient(135deg, var(--brand-600), var(--brand-700))'
                                      : 'var(--color-surface-hover)',
                                    color: selected ? '#fff' : 'var(--color-text-primary)',
                                    border: selected
                                      ? '1px solid transparent'
                                      : '1px solid var(--color-border)',
                                    boxShadow: selected
                                      ? '0 8px 24px color-mix(in srgb, var(--brand-600) 30%, transparent)'
                                      : 'none',
                                    transform: selected ? 'translateY(-2px)' : 'translateY(0)',
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Text */}
                      {item.questionType === 'text' && (
                        <div className="md:pl-9">
                          <div className="relative">
                            <textarea
                              value={answers[item.id]?.textAnswer ?? ''}
                              onChange={(e) => setText(item.id, e.target.value)}
                              rows={4}
                              maxLength={2000}
                              placeholder="Görüşlerinizi paylaşın..."
                              className="w-full rounded-2xl px-4 py-3 pb-8 text-[14px] outline-none resize-none transition-[border-color,box-shadow]"
                              style={{
                                background: 'var(--color-surface-hover)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                                fontFamily: 'var(--font-body)',
                                lineHeight: 1.6,
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.boxShadow =
                                  '0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)';
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            />
                            <div
                              className="absolute bottom-3 right-4 text-[11px] tabular-nums font-medium pointer-events-none"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {(answers[item.id]?.textAnswer ?? '').length} / 2000
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Identity card — premium switch */}
        <section
          className="mt-6 md:mt-8 rounded-3xl p-5 md:p-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center"
              style={{
                background: includeName ? 'var(--brand-100)' : 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                transition: 'background 200ms ease',
              }}
            >
              {includeName ? (
                <Eye className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              ) : (
                <EyeOff className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="text-[14px] font-semibold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {includeName ? 'Adınız görünecek' : 'Anonim gönderim'}
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {includeName
                  ? 'Yöneticiler yanıtlarınızı adınızla birlikte görecek.'
                  : 'Yanıtlarınız EY.FR.40 standardı gereği anonim değerlendirilir. İsterseniz adınızın görünmesine izin verebilirsiniz.'}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={includeName}
              onClick={() => setIncludeName((v) => !v)}
              className="relative shrink-0 w-12 h-7 rounded-full transition-colors duration-200"
              style={{
                background: includeName ? 'var(--color-primary)' : 'var(--color-border-hover)',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200"
                style={{
                  transform: includeName ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>
        </section>

        {/* KVKK footnote */}
        <div className="mt-6 flex items-start gap-2.5 px-1">
          <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Yanıtlarınız KVKK kapsamında güvenli olarak saklanır ve yalnızca eğitim iyileştirme amacıyla
            kullanılır.
          </p>
        </div>

        {/* Desktop inline submit */}
        <div className="hidden md:block mt-8">
          {missingRequired.length > 0 && (
            <div
              className="mb-4 rounded-2xl p-3.5 flex items-center gap-3"
              style={{
                background: 'var(--color-warning-bg)',
                border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-warning)' }} />
              <span className="text-[12px] font-medium" style={{ color: 'var(--color-warning)' }}>
                {missingRequired.length} zorunlu soru cevaplanmayı bekliyor
              </span>
            </div>
          )}
          <div className="flex gap-3">
            {!isMandatory && (
              <button
                type="button"
                onClick={() => router.push('/staff/my-trainings')}
                className="flex-1 rounded-2xl h-14 text-[14px] font-semibold transition-[background,border-color]"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Daha Sonra
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || missingRequired.length > 0}
              className={`${isMandatory ? 'flex-1' : 'flex-[2]'} rounded-2xl h-14 text-[15px] font-semibold text-white flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,box-shadow] hover:enabled:-translate-y-0.5`}
              style={{
                background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))',
                boxShadow:
                  submitting || missingRequired.length > 0
                    ? 'none'
                    : '0 12px 32px color-mix(in srgb, var(--brand-600) 35%, transparent)',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  Geri Bildirimi Gönder
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sticky submit bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
          borderColor: 'var(--color-border)',
          boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.06)',
        }}
      >
        {missingRequired.length > 0 && (
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-warning)' }}>
              {missingRequired.length} zorunlu soru eksik
            </span>
          </div>
        )}
        <div className="flex gap-2">
          {!isMandatory && (
            <button
              type="button"
              onClick={() => router.push('/staff/my-trainings')}
              className="rounded-xl h-12 px-4 text-[13px] font-semibold"
              style={{
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              Sonra
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || missingRequired.length > 0}
            className="flex-1 rounded-xl h-12 text-[14px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))',
              boxShadow:
                submitting || missingRequired.length > 0
                  ? 'none'
                  : '0 8px 20px color-mix(in srgb, var(--brand-600) 35%, transparent)',
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gönderiliyor
              </>
            ) : (
              <>
                Gönder
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FeedbackContent />
    </Suspense>
  );
}
