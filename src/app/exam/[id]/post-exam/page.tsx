'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ChevronRight, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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
  totalTime?: number;
  questions: Question[];
}

export default function PostExamPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: examData, isLoading, error } = useFetch<ExamData>(`/api/exam/${id}/questions?phase=post`);
  const [currentQ, setCurrentQ] = useState(0);
  const [maxReachedQ, setMaxReachedQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [phaseChecked, setPhaseChecked] = useState(false);
  const [isExamOnly, setIsExamOnly] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Kaydedilmis cevaplari yukle
  useEffect(() => {
    if (examData?.questions) {
      const restored: Record<number, string> = {};
      for (const q of examData.questions) {
        if (q.savedAnswer) restored[q.id] = q.savedAnswer;
      }
      if (Object.keys(restored).length > 0) {
        setAnswers(restored);
        setMaxReachedQ(Math.max(...Object.keys(restored).map(Number)) - 1);
      }
    }
  }, [examData]);

  // Phase guard — redirect if attempt is not in post_exam status
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exam/${id}/start`, { method: 'POST' })
      .then(res => res.json())
      .then(attempt => {
        if (cancelled) return;
        if (attempt.status !== 'post_exam') {
          if (attempt.status === 'pre_exam') router.replace(`/exam/${id}/pre-exam`);
          else if (attempt.status === 'watching_videos') router.replace(`/exam/${id}/videos`);
          else if (attempt.status === 'completed') router.replace('/staff/my-trainings');
          return;
        }
        setAttemptId(attempt.id);
        if (attempt.examOnly) setIsExamOnly(true);
        setPhaseChecked(true);
      })
      .catch(() => setPhaseChecked(true));
    return () => { cancelled = true; };
  }, [id, router]);

  // Server-synced timer — fetch remaining seconds from Redis-backed endpoint
  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    fetch(`/api/exam/${attemptId}/timer`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setTimeLeft(data.remainingSeconds ?? examData?.totalTime ?? 1800);
      })
      .catch(() => { if (!cancelled) setTimeLeft(examData?.totalTime ?? 1800); });
    return () => { cancelled = true; };
  }, [attemptId]);

  // Sayfa kapatilirken son cevabi kaydet (beforeunload)
  useEffect(() => {
    const saveOnExit = () => {
      const qs = examData?.questions ?? [];
      const lastQ = qs[currentQ];
      const lastAnswer = lastQ ? answers[lastQ.id] : undefined;
      if (lastQ?.questionId && lastAnswer) {
        const opt = lastQ.options.find(o => o.id === lastAnswer);
        if (opt?.optionId) {
          const payload = JSON.stringify({ questionId: lastQ.questionId, selectedOptionId: opt.optionId, examPhase: 'post' });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(`/api/exam/${id}/save-answer`, blob);
        }
      }
    };
    window.addEventListener('beforeunload', saveOnExit);
    return () => window.removeEventListener('beforeunload', saveOnExit);
  }, [id, examData, currentQ, answers]);

  // Countdown interval
  useEffect(() => {
    if (timeLeft === null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anti-cheat: Tab visibility detection (examOnly)
  useEffect(() => {
    if (!isExamOnly) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            toast('3. ihlal: Sınavınız otomatik sonlandırıldı', 'error');
          } else {
            toast(`Uyarı: Sekme değiştirme tespit edildi (${next}/3)`, 'warning');
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isExamOnly, toast]);

  // Force submit on 3rd tab switch violation
  useEffect(() => {
    if (tabSwitchCount >= 3 && handleFinishRef.current) {
      handleFinishRef.current();
    }
  }, [tabSwitchCount]);

  // Auto-submit when timer hits zero
  const handleFinishRef = useRef<() => void>(undefined);
  useEffect(() => {
    if (timeLeft === 0 && handleFinishRef.current) handleFinishRef.current();
  }, [timeLeft]);

  // One-way navigation helpers
  const goNext = useCallback(() => {
    setCurrentQ(prev => {
      const next = prev + 1;
      setMaxReachedQ(m => Math.max(m, next));
      return next;
    });
  }, []);

  const handleFinish = useCallback(async () => {
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const qs = examData?.questions ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedAnswers = qs.map((q: any) => {
        const questionId = q.questionId ?? q.id ?? '';
        const options = q.options ?? [];
        const selectedLetter = answers[q.id];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedOption = options.find((o: any) => o.id === selectedLetter);
        return selectedOption ? { questionId: String(questionId), selectedOptionId: selectedOption.optionId ?? selectedOption.id } : null;
      }).filter(Boolean);

      const res = await fetch(`/api/exam/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers, phase: 'post' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Retry once on failure (timer auto-submit may race)
        const retry = await fetch(`/api/exam/${id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: formattedAnswers, phase: 'post' }),
        });
        const retryData = await retry.json().catch(() => ({}));
        if (retry.ok) {
          if (retryData.results) {
            try { sessionStorage.setItem(`exam-results-${id}`, JSON.stringify(retryData.results)); } catch { /* ignore */ }
          }
          router.push(`/exam/${id}/transition?from=post-exam&score=${retryData.score ?? 0}&passed=${retryData.isPassed ?? false}&passingScore=${retryData.passingScore ?? 70}&attemptId=${attemptId}`);
          return;
        }
        toast(`Sınav gönderilemedi: ${data.error || retryData.error || 'Bilinmeyen hata'}. Cevaplarınız kaydedilmemiş olabilir.`, 'error');
        router.push('/staff/my-trainings');
        return;
      }
      if (data.results) {
        try { sessionStorage.setItem(`exam-results-${id}`, JSON.stringify(data.results)); } catch { /* ignore */ }
      }
      router.push(`/exam/${id}/transition?from=post-exam&score=${data.score ?? 0}&passed=${data.isPassed ?? false}&passingScore=${data.passingScore ?? 70}&attemptId=${attemptId}`);
    } catch (err) {
      toast('Sınav gönderilemedi — internet bağlantınızı kontrol edin. Sayfayı yenileyip tekrar deneyin.', 'error');
      router.push('/staff/my-trainings');
    } finally {
      setSubmitting(false);
    }
  }, [id, answers, examData, router]);

  // Keep ref in sync for auto-submit on timer expiry
  handleFinishRef.current = handleFinish;

  if (isLoading || !phaseChecked) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!examData || (examData.questions ?? []).length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>;
  }

  const questions = examData.questions ?? [];
  const displayTime = timeLeft ?? 0;
  const minutes = Math.floor(displayTime / 60);
  const seconds = displayTime % 60;
  const progress = ((currentQ + 1) / questions.length) * 100;
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--color-bg)' }}
      onContextMenu={isExamOnly ? (e) => e.preventDefault() : undefined}
      onCopy={isExamOnly ? (e) => e.preventDefault() : undefined}
    >
      {/* Tab switch warning banner */}
      {isExamOnly && tabSwitchCount > 0 && (
        <div
          className="sticky top-0 z-60 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white"
          style={{ background: tabSwitchCount >= 2 ? 'var(--color-error)' : 'var(--color-warning)' }}
        >
          Sekme değiştirme tespit edildi ({tabSwitchCount}/3) — 3. ihlalde sınav sonlandırılır
        </div>
      )}
      <div className="sticky top-0 z-50 border-b px-6 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold">{examData.trainingTitle ?? ''}</h3>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{isExamOnly ? 'Sınav' : (examData.examType ?? 'Son Sınav')}</span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Soru {currentQ + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: 'var(--color-surface-hover)' }}>
            <Clock className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-base font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
          </div>
        </div>
        <div className="mt-2 h-1 w-full rounded-full" style={{ background: 'var(--color-border)' }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--color-accent)', transition: 'width var(--transition-base)' }} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="mb-6 text-lg font-semibold leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
              <span className="mr-2 text-sm font-bold" style={{ color: 'var(--color-accent)' }}>S{q?.id ?? currentQ + 1}.</span>{q?.text ?? ''}
            </p>
            <div className="space-y-3">
              {(q?.options ?? []).map((opt) => {
                const isSelected = answers[q?.id ?? 0] === opt.id;
                return (
                  <button key={opt.id} onClick={() => {
                    setAnswers({ ...answers, [q?.id ?? 0]: opt.id });
                    // Auto-save cevabi
                    const questionId = q?.questionId ?? '';
                    if (questionId && opt.optionId) {
                      fetch(`/api/exam/${id}/save-answer`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questionId, selectedOptionId: opt.optionId, examPhase: 'post' }),
                      }).catch(() => {});
                    }
                  }} className="flex w-full items-center gap-3 rounded-lg border p-4 text-left" style={{ borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)', background: isSelected ? 'var(--color-accent-light)' : 'var(--color-surface)', transition: 'border-color var(--transition-fast), background var(--transition-fast)' }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: isSelected ? 'var(--color-accent)' : 'var(--color-border)', color: isSelected ? 'white' : 'var(--color-text-muted)' }}>{opt.id.toUpperCase()}</div>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontWeight: isSelected ? 600 : 400 }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-end">
              {currentQ < questions.length - 1 ? (
                <Button onClick={goNext} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)', transition: 'background var(--transition-fast)' }}>Sonraki <ChevronRight className="h-4 w-4" /></Button>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  {answeredCount < questions.length && (
                    <p className="text-[11px] font-medium" style={{ color: 'var(--color-warning)' }}>
                      {questions.length - answeredCount} soru cevaplanmadı (yanlış sayılacak)
                    </p>
                  )}
                  <Button onClick={handleFinish} disabled={submitting} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-success)', transition: 'background var(--transition-fast)' }}><AlertTriangle className="h-4 w-4" /> {submitting ? 'Gönderiliyor...' : `Sınavı Bitir (${answeredCount}/${questions.length})`}</Button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold">Soru Navigasyonu</h4>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const isAnswered = answers[questions[i]?.id ?? 0] !== undefined;
                const isCurrent = i === currentQ;
                const isLocked = i < currentQ;
                const isFuture = i > maxReachedQ;
                const isDisabled = isLocked || isFuture;
                return (
                  <button key={i} onClick={() => { if (!isDisabled) setCurrentQ(i); }} disabled={isDisabled} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold" style={{ background: isCurrent ? 'var(--color-accent)' : isLocked ? 'var(--color-surface-hover)' : isAnswered ? 'var(--color-success-bg)' : 'var(--color-surface-hover)', color: isCurrent ? 'white' : isLocked ? 'var(--color-text-muted)' : isAnswered ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1.5px solid ${isCurrent ? 'var(--color-accent)' : isLocked ? 'var(--color-border)' : isAnswered ? 'var(--color-success)' : 'var(--color-border)'}`, opacity: isDisabled && !isCurrent ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'background var(--transition-fast), border-color var(--transition-fast)' }}>
                    {isLocked ? <Lock className="h-3 w-3" /> : i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
