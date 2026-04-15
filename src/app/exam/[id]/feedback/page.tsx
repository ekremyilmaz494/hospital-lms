'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

/**
 * EY.FR.40 Eğitim Değerlendirme Anket Formu — staff doldurma sayfası.
 *
 * Akış: post-exam → transition (sonuç ekranı) → BU SAYFA → my-trainings
 * Form gönderilmeden my-trainings'e geri dönüş yönlendirmesi var (zorunlu değil).
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
  { value: 1, label: 'Çok Zayıf' },
  { value: 2, label: 'Zayıf' },
  { value: 3, label: 'Orta' },
  { value: 4, label: 'İyi' },
  { value: 5, label: 'Çok İyi' },
];

const YPN_OPTIONS = [
  { value: 1, label: 'Evet' },
  { value: 2, label: 'Kısmen' },
  { value: 3, label: 'Hayır' },
];

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
  // answers: itemId → { score?, textAnswer? }
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

        if (status.hasSubmittedFeedback) {
          setAlreadySubmitted(true);
        }
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
    return () => { cancelled = true; };
  }, [attemptId, router, toast]);

  const requiredItems = useMemo(
    () => form?.categories.flatMap(c => c.items.filter(i => i.isRequired)) ?? [],
    [form],
  );

  const missingRequired = useMemo(() => {
    return requiredItems.filter(item => {
      const a = answers[item.id];
      if (!a) return true;
      if (item.questionType === 'text') return !a.textAnswer || a.textAnswer.trim().length === 0;
      return typeof a.score !== 'number';
    });
  }, [requiredItems, answers]);

  const setScore = (itemId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], score } }));
  };

  const setText = (itemId: string, textAnswer: string) => {
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], textAnswer } }));
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
        answers: Object.entries(answers).map(([itemId, a]) => ({
          itemId,
          score: a.score,
          textAnswer: a.textAnswer,
        })).filter(a => typeof a.score === 'number' || (a.textAnswer && a.textAnswer.length > 0)),
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
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-md w-full rounded-2xl p-8 text-center" style={{ background: 'var(--color-surface)' }}>
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Geri bildiriminiz zaten alındı
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Bu eğitim için geri bildirim formunu daha önce doldurdunuz.
          </p>
          <Button onClick={() => router.push('/staff/my-trainings')}>Eğitimlerime Dön</Button>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Zorunlu uyarısı */}
        {isMandatory && (
          <div
            className="mb-4 rounded-2xl p-4 flex items-start gap-3"
            style={{
              background: 'var(--color-error-bg)',
              border: '1px solid color-mix(in srgb, var(--color-error) 30%, transparent)',
            }}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
            <div>
              <p className="text-[13px] font-bold" style={{ color: 'var(--color-error)' }}>
                Bu geri bildirim zorunludur
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--color-text)' }}>
                Formu doldurmadan başka bir eğitime başlayamazsınız.
              </p>
            </div>
          </div>
        )}

        {/* Başlık */}
        <div className="mb-6 rounded-2xl p-6" style={{ background: 'var(--color-surface)' }}>
          {trainingTitle && (
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-primary)' }}>
              {trainingTitle}
            </p>
          )}
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {form.title}
            </h1>
            {form.documentCode && (
              <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                {form.documentCode}
              </span>
            )}
          </div>
          {form.description && (
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{form.description}</p>
          )}
          <p className="text-[12px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
            Değerli katılımcı, eğitim hakkındaki görüşleriniz eğitim kalitemizi iyileştirmemize yardımcı olur.
          </p>
        </div>

        {/* Kategoriler */}
        {form.categories.map(category => (
          <div key={category.id} className="mb-5 rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)' }}>
            <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
              <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                {category.name}
              </h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {category.items.map(item => (
                <div key={item.id} className="px-6 py-4" style={{ borderColor: 'var(--color-border)' }}>
                  <label className="block text-[14px] mb-3">
                    {item.text}
                    {item.isRequired && <span style={{ color: 'var(--color-error)' }}> *</span>}
                  </label>

                  {item.questionType === 'likert_5' && (
                    <div className="grid grid-cols-5 gap-2">
                      {LIKERT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setScore(item.id, opt.value)}
                          className="rounded-xl py-2 px-2 text-[11px] font-medium"
                          style={{
                            background: answers[item.id]?.score === opt.value ? 'var(--color-primary)' : 'var(--color-bg)',
                            color: answers[item.id]?.score === opt.value ? '#fff' : 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <div className="font-bold">{opt.value}</div>
                          <div className="text-[10px] opacity-80">{opt.label}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {item.questionType === 'yes_partial_no' && (
                    <div className="grid grid-cols-3 gap-2">
                      {YPN_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setScore(item.id, opt.value)}
                          className="rounded-xl py-2 px-3 text-[13px] font-medium"
                          style={{
                            background: answers[item.id]?.score === opt.value ? 'var(--color-primary)' : 'var(--color-bg)',
                            color: answers[item.id]?.score === opt.value ? '#fff' : 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {item.questionType === 'text' && (
                    <textarea
                      value={answers[item.id]?.textAnswer ?? ''}
                      onChange={e => setText(item.id, e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Yorumunuzu yazın..."
                      className="w-full rounded-xl px-3 py-2 text-[13px] outline-none"
                      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* İsim görünürlüğü */}
        <div className="mb-6 rounded-2xl p-5" style={{ background: 'var(--color-surface)' }}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeName}
              onChange={e => setIncludeName(e.target.checked)}
              className="mt-1 w-4 h-4 rounded"
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <div>
              <div className="text-[13px] font-medium">Adımın yönetici tarafından görünmesini istiyorum</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Seçmezseniz yanıtınız anonim olarak değerlendirilir (EY.FR.40 standardı).
              </div>
            </div>
          </label>
        </div>

        {/* Eksik zorunlu uyarısı */}
        {missingRequired.length > 0 && (
          <div className="mb-4 rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[12px]">{missingRequired.length} zorunlu soru cevaplanmadı</span>
          </div>
        )}

        {/* Gönder + (opsiyonel) atla */}
        <div className="flex gap-3">
          {!isMandatory && (
            <button
              type="button"
              onClick={() => router.push('/staff/my-trainings')}
              className="flex-1 rounded-xl h-12 text-[13px] font-medium"
              style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
            >
              Daha Sonra
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || missingRequired.length > 0}
            className={`${isMandatory ? 'flex-1' : 'flex-[2]'} rounded-xl h-12 text-[14px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50`}
            style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Gönderiliyor...' : 'Geri Bildirimi Gönder'}
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
