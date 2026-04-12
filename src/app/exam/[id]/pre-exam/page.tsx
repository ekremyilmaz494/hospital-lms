'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight, AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/shared/page-loading';

interface Option {
  id: string;
  optionId: string;
  text: string;
}

interface Question {
  id: number;
  questionId: string;
  text: string;
  options: Option[];
  savedAnswer?: string;
}

interface ExamData {
  trainingTitle: string;
  examType: string;
  totalTime: number;
  questions: Question[];
}

export default function PreExamPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState<string | null>(null);

  // 1. Once attempt baslat, sonra sorulari cek, timer'i Redis'ten al
  useEffect(() => {
    let cancelled = false;

    async function initExam() {
      try {
        // Adim 1: Attempt baslat
        const startRes = await fetch(`/api/exam/${id}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examType: 'pre' }),
        });
        const attempt = await startRes.json();

        // Start API hata kontrolu — gercek hatayi goster
        if (!startRes.ok) {
          if (!cancelled) setError(attempt?.error || 'Sınav başlatılamadı');
          return;
        }

        // Phase guard: redirect if attempt is past pre-exam or examOnly
        if (attempt?.examOnly || attempt?.status === 'post_exam') {
          router.replace(`/exam/${id}/post-exam`);
          return;
        }
        if (attempt?.status === 'watching_videos') {
          router.replace(`/exam/${id}/videos`);
          return;
        }
        if (attempt?.status === 'completed') {
          router.replace('/staff/my-trainings');
          return;
        }

        if (!cancelled) setAttemptId(attempt?.id ?? null);

        // Adim 2: Sorulari cek (attempt artik var)
        const qRes = await fetch(`/api/exam/${id}/questions?phase=pre`);
        if (!qRes.ok) {
          const errData = await qRes.json().catch(() => ({}));
          if (!cancelled) setError(errData.error || 'Sorular yüklenemedi');
          return;
        }
        const data = await qRes.json();
        if (!cancelled) {
          setExamData(data);

          // Adim 3: Timer'i Redis'ten al (sunucu tarafli, sayfa yenilemede korunur)
          if (attempt?.id) {
            try {
              const timerRes = await fetch(`/api/exam/${attempt.id}/timer`, { method: 'POST' });
              const timerData = await timerRes.json();
              setTimeLeft(timerData.remainingSeconds ?? data.totalTime);
            } catch {
              setTimeLeft(data.totalTime);
            }
          } else {
            setTimeLeft(data.totalTime);
          }

          // Kaydedilmis cevaplari yukle
          if (data.questions) {
            const restored: Record<number, string> = {};
            for (const q of data.questions) {
              if (q.savedAnswer) restored[q.id] = q.savedAnswer;
            }
            if (Object.keys(restored).length > 0) setAnswers(restored);
          }
        }
      } catch {
        if (!cancelled) setError('Sınav başlatılamadı');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    initExam();
    return () => { cancelled = true; };
  }, [id, router]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Sayfa kapatilirken son cevabi kaydet (beforeunload)
  useEffect(() => {
    const saveOnExit = () => {
      const qs = examData?.questions ?? [];
      // Cevaplanmis ama henuz save edilmemis son cevabi gonder
      const lastQ = qs[currentQ];
      const lastAnswer = lastQ ? answers[lastQ.id] : undefined;
      if (lastQ?.questionId && lastAnswer) {
        const opt = lastQ.options.find(o => o.id === lastAnswer);
        if (opt?.optionId) {
          const payload = JSON.stringify({ questionId: lastQ.questionId, selectedOptionId: opt.optionId, examPhase: 'pre' });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(`/api/exam/${id}/save-answer`, blob);
        }
      }
    };
    window.addEventListener('beforeunload', saveOnExit);
    return () => window.removeEventListener('beforeunload', saveOnExit);
  }, [id, examData, currentQ, answers]);

  const handleFinish = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // BUG #1 FIX: answers key'leri q.id ile saklanıyor, idx değil
      const qs = examData?.questions ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedAnswers = qs.map((q: any) => {
        const questionId = q.questionId ?? q.id ?? '';
        const options = q.options ?? [];
        const selectedAnswer = answers[q.id];  // q.id ile oku
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedOption = options.find((o: any) => o.id === selectedAnswer);
        return selectedOption ? { questionId: String(questionId), selectedOptionId: selectedOption.optionId ?? selectedOption.id } : null;
      }).filter(Boolean);

      const res = await fetch(`/api/exam/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers, phase: 'pre' }),
      });

      // BUG #2 FIX: response.ok kontrolü
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? 'Gönderim başarısız. Tekrar deneyin.');
        return;
      }

      router.push(`/exam/${id}/transition?from=pre&score=${data.score ?? 0}`);
    } catch {
      setSubmitError('Bir hata oluştu. Tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  }, [id, answers, examData, router, submitting]);

  // Auto-submit when timer hits zero
  const handleFinishRef = useRef<() => void>(undefined);
  handleFinishRef.current = handleFinish;
  useEffect(() => {
    if (timeLeft === 0 && handleFinishRef.current) handleFinishRef.current();
  }, [timeLeft]);

  // ── Early returns (tüm hook'lar yukarıda tanımlandı) ──
  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!examData || (examData.questions ?? []).length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>;
  }

  const questions = examData.questions ?? [];
  const currentTimeLeft = timeLeft ?? 0;
  const minutes = Math.floor(currentTimeLeft / 60);
  const seconds = currentTimeLeft % 60;
  const progress = ((currentQ + 1) / questions.length) * 100;
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Exam Header */}
      <div className="sticky top-0 z-50 border-b px-6 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold">{examData.trainingTitle ?? ''}</h3>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>{examData.examType ?? 'Ön Sınav'}</span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Soru {currentQ + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: currentTimeLeft < 300 ? 'var(--color-error-bg)' : 'var(--color-surface-hover)' }}>
              <Clock className="h-4 w-4" style={{ color: currentTimeLeft < 300 ? 'var(--color-error)' : 'var(--color-text-muted)' }} />
              <span className="text-base font-bold" style={{ fontFamily: 'var(--font-mono)', color: currentTimeLeft < 300 ? 'var(--color-error)' : 'var(--color-text-primary)' }}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
            <button
              onClick={() => { if (confirm('Sınavdan çıkmak istediğinize emin misiniz? Cevaplarınız kaydedilmiştir.')) router.push('/staff/my-trainings'); }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors duration-150 hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <LogOut className="h-3.5 w-3.5" /> Çık
            </button>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="mt-2 h-1 w-full rounded-full" style={{ background: 'var(--color-border)' }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--color-primary)', transition: 'width var(--transition-base)' }} />
        </div>
      </div>

      {/* Exam Body */}
      <div className="mx-auto max-w-5xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Question Area */}
          <div className="lg:col-span-3 rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="mb-6 text-lg font-semibold leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
              <span className="mr-2 text-sm font-bold" style={{ color: 'var(--color-primary)' }}>S{q?.id ?? currentQ + 1}.</span>
              {q?.text ?? ''}
            </p>

            <div className="space-y-3">
              {(q?.options ?? []).map((opt) => {
                const isSelected = answers[q?.id ?? 0] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setAnswers({ ...answers, [q?.id ?? 0]: opt.id });
                      // Auto-save cevabi
                      const questionId = q?.questionId ?? '';
                      if (questionId && opt.optionId) {
                        fetch(`/api/exam/${id}/save-answer`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ questionId, selectedOptionId: opt.optionId, examPhase: 'pre' }),
                        }).catch(() => {});
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border p-4 text-left"
                    style={{
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      transition: 'border-color var(--transition-fast), background var(--transition-fast)',
                    }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: isSelected ? 'var(--color-primary)' : 'var(--color-border)', color: isSelected ? 'white' : 'var(--color-text-muted)' }}>
                      {opt.id.toUpperCase()}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontWeight: isSelected ? 600 : 400 }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <ChevronLeft className="h-4 w-4" /> Önceki
              </Button>
              {currentQ < questions.length - 1 ? (
                <Button onClick={() => setCurrentQ(currentQ + 1)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
                  Sonraki <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <div>
                  <Button onClick={handleFinish} disabled={submitting} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)', transition: 'background var(--transition-fast)' }}>
                    <AlertTriangle className="h-4 w-4" /> {submitting ? 'Gönderiliyor...' : `Sınavı Bitir (${answeredCount}/${questions.length})`}
                  </Button>
                  {submitError && (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <p className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>{submitError}</p>
                      <button onClick={() => { setSubmitError(null); handleFinish(); }} className="text-xs font-semibold underline" style={{ color: 'var(--color-primary)' }}>Tekrar Dene</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Question Navigator */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold">Soru Navigasyonu</h4>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                // B7.4/G7.4 — id ?? 0 fallback kaldırıldı: undefined id → answered=false (yanlış pozitif önlenir)
                const qId = questions[i]?.id
                const isAnswered = qId !== undefined ? answers[qId] !== undefined : false;
                const isCurrent = i === currentQ;
                return (
                  <button key={i} onClick={() => setCurrentQ(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold" style={{ background: isCurrent ? 'var(--color-primary)' : isAnswered ? 'var(--color-success-bg)' : 'var(--color-surface-hover)', color: isCurrent ? 'white' : isAnswered ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1.5px solid ${isCurrent ? 'var(--color-primary)' : isAnswered ? 'var(--color-success)' : 'var(--color-border)'}`, transition: 'background var(--transition-fast), border-color var(--transition-fast)' }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-success-bg)', border: '1.5px solid var(--color-success)' }} /><span style={{ color: 'var(--color-text-muted)' }}>Cevaplanmış ({answeredCount})</span></div>
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-primary)' }} /><span style={{ color: 'var(--color-text-muted)' }}>Aktif soru</span></div>
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)' }} /><span style={{ color: 'var(--color-text-muted)' }}>Cevaplanmamış ({questions.length - answeredCount})</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
