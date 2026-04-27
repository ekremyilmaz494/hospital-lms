'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ChevronRight, AlertTriangle, Lock, LogOut } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { attemptPhaseRedirect, type AttemptStatus } from '@/lib/exam-state-machine';

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
  const [startReady, setStartReady] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const { data: examData, isLoading, error } = useFetch<ExamData>(startReady ? `/api/exam/${id}/questions?phase=post` : null);
  const [currentQ, setCurrentQ] = useState(0);
  const [maxReachedQ, setMaxReachedQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [phaseChecked, setPhaseChecked] = useState(false);
  const [isExamOnly, setIsExamOnly] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exam/${id}/start`, { method: 'POST' })
      .then(async (res) => {
        const attempt = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStartError(attempt?.error || 'Sınav başlatılamadı');
          setPhaseChecked(true);
          return;
        }
        const redirect = attemptPhaseRedirect(attempt.status as AttemptStatus, 'post-exam');
        if (redirect) {
          const path = redirect === 'my-trainings'
            ? '/staff/my-trainings'
            : `/exam/${id}/${redirect}`;
          router.replace(path);
          return;
        }
        setAttemptId(attempt.id);
        if (attempt.examOnly) setIsExamOnly(true);
        setStartReady(true);
        setPhaseChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setStartError('Sınav başlatılamadı. Lütfen tekrar deneyin.');
          setPhaseChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [id, router]);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    fetch(`/api/exam/${attemptId}/timer`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const remaining = data.remainingSeconds ?? examData?.totalTime ?? 1800;
        if (remaining <= 0) {
          // Süre dolmuş halde dönen kullanıcı: timer POST recovery attempt'i zaten
          // completed+failed yaptı. /exam/[id] sayfası olmadığı için eskiden 404'e düşüyorduk;
          // şimdi mevcut hata ekranını (pe-err) göster, kullanıcı "Eğitimlerime Dön" ile çıkar.
          setStartError('Sınav süresi dolmuş. Bu deneme tamamlandı.');
          return;
        }
        setTimeLeft(remaining);
      })
      .catch(() => { if (!cancelled) setTimeLeft(examData?.totalTime ?? 1800); });
    return () => { cancelled = true; };
  }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (timeLeft === null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => (prev === null || prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setTabSwitchCount((prev) => prev + 1);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (tabSwitchCount === 0) return;
    toast(`Sekme değiştirme tespit edildi (${tabSwitchCount}). Bu davranış kayıt altına alınıyor.`, 'warning');
  }, [tabSwitchCount, toast]);

  useEffect(() => {
    if (!isExamOnly) return;
    document.documentElement.requestFullscreen?.().catch(() => {
      toast('Tam ekran moduna geçin', 'warning');
    });
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        toast('Tam ekran modundan çıkmayınız', 'warning');
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isExamOnly, toast]);

  const handleFinishRef = useRef<() => void>(undefined);
  useEffect(() => {
    if (timeLeft === 0 && handleFinishRef.current) handleFinishRef.current();
  }, [timeLeft]);

  const goNext = useCallback(() => {
    setCurrentQ(prev => {
      const next = prev + 1;
      setMaxReachedQ(m => Math.max(m, next));
      return next;
    });
  }, []);

  const handleFinish = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
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
        body: JSON.stringify({ answers: formattedAnswers, phase: 'post', tabSwitchCount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const retry = await fetch(`/api/exam/${id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: formattedAnswers, phase: 'post', tabSwitchCount }),
        });
        const retryData = await retry.json().catch(() => ({}));
        if (retry.ok) {
          if (retryData.results && retryData.isPassed) {
            try { sessionStorage.setItem(`exam-results-${id}`, JSON.stringify(retryData.results)); } catch { /* ignore */ }
          }
          router.replace(`/exam/${id}/transition?from=post-exam&score=${retryData.score ?? 0}&passed=${retryData.isPassed ?? false}&passingScore=${retryData.passingScore ?? 70}&attemptsRemaining=${retryData.attemptsRemaining ?? 0}&attemptId=${attemptId}`);
          return;
        }
        setSubmitError(`Sınav gönderilemedi: ${data.error || retryData.error || 'Bilinmeyen hata'}. Cevaplarınız kaydedilmedi — tekrar deneyin.`);
        return;
      }
      if (data.results && data.isPassed) {
        try { sessionStorage.setItem(`exam-results-${id}`, JSON.stringify(data.results)); } catch { /* ignore */ }
      }
      router.replace(`/exam/${id}/transition?from=post-exam&score=${data.score ?? 0}&passed=${data.isPassed ?? false}&passingScore=${data.passingScore ?? 70}&attemptsRemaining=${data.attemptsRemaining ?? 0}&attemptId=${attemptId}`);
    } catch {
      setSubmitError('Sınav gönderilemedi — internet bağlantınızı kontrol edip tekrar deneyin. Cevaplarınız kaydedilmedi.');
    } finally {
      setSubmitting(false);
    }
  }, [id, answers, examData, router, attemptId, tabSwitchCount]);

  handleFinishRef.current = handleFinish;

  if (isLoading || !phaseChecked) return <PageLoading />;

  if (startError || error) {
    return (
      <div className="pe-err">
        <div className="pe-err-icon"><AlertTriangle className="h-6 w-6" /></div>
        <h2>Sınav başlatılamadı</h2>
        <p>{startError || error}</p>
        <button onClick={() => router.push('/staff/my-trainings')} className="pe-err-link">← Eğitimlerime Dön</button>
        <style>{`
          .pe-err { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 10px; max-width: 420px; margin: 0 auto; }
          .pe-err-icon { width: 56px; height: 56px; border-radius: 999px; background: var(--k-error-bg); color: var(--k-error); display: flex; align-items: center; justify-content: center; }
          .pe-err h2 { font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; font-size: 22px; color: var(--k-text-primary); margin: 0; }
          .pe-err p { font-size: 13px; color: var(--k-text-muted); margin: 0; }
          .pe-err-link { margin-top: 10px; background: none; border: none; color: var(--k-text-primary); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 600; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  if (!examData || (examData.questions ?? []).length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: 'var(--k-text-muted)', fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif', fontSize: 16 }}>
        Henüz veri yok
      </div>
    );
  }

  const questions = examData.questions ?? [];
  const displayTime = timeLeft ?? 0;
  const minutes = Math.floor(displayTime / 60);
  const seconds = displayTime % 60;
  const progress = ((currentQ + 1) / questions.length) * 100;
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;
  const isTimerCritical = displayTime > 0 && displayTime < 300;

  return (
    <div
      className="pe-root"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {isExamOnly && tabSwitchCount > 0 && (
        <div className="pe-warn-banner">
          Sekme değiştirme tespit edildi ({tabSwitchCount}) — davranışın kayıt altına alınıyor
        </div>
      )}

      {/* ═══════ Header ═══════ */}
      <header className="pe-header">
        <div className="pe-header-row">
          <div className="pe-header-left">
            <span className="pe-phase-chip pe-phase-chip-ok">{isExamOnly ? 'Sınav' : 'Son Sınav'}</span>
            <h1 className="pe-training">{examData.trainingTitle}</h1>
            <span className="pe-counter">
              Soru <strong>{(currentQ + 1).toString().padStart(2, '0')}</strong>/<strong>{questions.length.toString().padStart(2, '0')}</strong>
            </span>
          </div>
          <div className="pe-header-right">
            <div className={`pe-timer ${isTimerCritical ? 'pe-timer-crit' : ''}`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
            </div>
            <button
              onClick={() => { if (confirm('Sınavdan çıkmak istediğine emin misin? Cevapların kaydedilmiştir.')) router.push('/staff/my-trainings'); }}
              className="pe-exit"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Çık</span>
            </button>
          </div>
        </div>
        <div className="pe-progress">
          <div className="pe-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* ═══════ Body ═══════ */}
      <div className="pe-body">
        <main className="pe-question-card">
          <div className="pe-q-head">
            <span className="pe-q-num">S{String(q?.id ?? currentQ + 1).padStart(2, '0')}</span>
            <p className="pe-q-text">{q?.text ?? ''}</p>
          </div>

          <ul className="pe-options">
            {(q?.options ?? []).map((opt) => {
              const isSelected = answers[q?.id ?? 0] === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    onClick={() => {
                      setAnswers({ ...answers, [q?.id ?? 0]: opt.id });
                      const questionId = q?.questionId ?? '';
                      if (questionId && opt.optionId) {
                        fetch(`/api/exam/${id}/save-answer`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ questionId, selectedOptionId: opt.optionId, examPhase: 'post' }),
                        }).catch(() => {});
                      }
                    }}
                    className={`pe-option ${isSelected ? 'pe-option-on' : ''}`}
                    aria-pressed={isSelected}
                  >
                    <span className={`pe-option-letter ${isSelected ? 'pe-option-letter-on' : ''}`}>
                      {opt.id.toUpperCase()}
                    </span>
                    <span className="pe-option-text">{opt.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="pe-actions">
            {currentQ < questions.length - 1 ? (
              <button onClick={goNext} className="pe-next">
                <span>Sonraki Soru</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="pe-finish-wrap">
                {answeredCount < questions.length && (
                  <p className="pe-finish-warn">
                    <AlertTriangle className="h-3 w-3" />
                    {questions.length - answeredCount} soru cevaplanmadı · yanlış sayılacak
                  </p>
                )}
                <button onClick={handleFinish} disabled={submitting} className="pe-finish pe-finish-ok">
                  {submitting ? (
                    <>
                      <span className="pe-spin" />
                      <span>Gönderiliyor…</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      <span>Sınavı Bitir ({answeredCount}/{questions.length})</span>
                    </>
                  )}
                </button>
                {submitError && (
                  <div className="pe-submit-err">
                    <p>{submitError}</p>
                    <button onClick={() => { setSubmitError(null); handleFinish(); }}>Tekrar Dene</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <aside className="pe-navigator">
          <h2 className="pe-nav-title">Soru Haritası</h2>

          <div className="pe-nav-grid">
            {questions.map((qn, i) => {
              const qId = qn?.id;
              const isAnswered = qId !== undefined ? answers[qId] !== undefined : false;
              const isCurrent = i === currentQ;
              const isLocked = i < currentQ;
              const isFuture = i > maxReachedQ;
              const isDisabled = isLocked || isFuture;

              let cls = 'pe-nav-cell';
              if (isCurrent) cls += ' pe-nav-current';
              else if (isLocked) cls += ' pe-nav-locked';
              else if (isAnswered) cls += ' pe-nav-answered';
              else if (isFuture) cls += ' pe-nav-future';

              return (
                <button
                  key={i}
                  onClick={() => !isDisabled && setCurrentQ(i)}
                  disabled={isDisabled}
                  className={cls}
                  aria-label={`Soru ${i + 1}`}
                >
                  {isLocked ? <Lock className="h-3 w-3" /> : String(i + 1).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          <ul className="pe-nav-legend">
            <li><span className="pe-nav-swatch pe-nav-swatch-ink" /> Aktif</li>
            <li><span className="pe-nav-swatch pe-nav-swatch-ok" /> Cevaplandı · <strong>{answeredCount}</strong></li>
            <li><span className="pe-nav-swatch pe-nav-swatch-locked" /> Kilitli · geçildi</li>
            <li><span className="pe-nav-swatch pe-nav-swatch-future" /> Cevaplanmadı · <strong>{questions.length - answeredCount}</strong></li>
          </ul>
        </aside>
      </div>

      <style jsx>{`
        .pe-root { min-height: 100vh; background: var(--k-bg); padding-bottom: 40px; }

        .pe-warn-banner {
          position: sticky;
          top: 0;
          z-index: 60;
          padding: 8px 16px;
          background: var(--k-error);
          color: var(--k-bg);
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 600;
          text-align: center;
        }

        .pe-header {
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 14px 24px 0;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--k-border);
        }
        .pe-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 10px;
        }
        .pe-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }
        .pe-phase-chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--k-primary);
          color: var(--k-bg);
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .pe-phase-chip-ok { background: var(--k-primary); }
        .pe-training {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: var(--k-text-primary);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }
        .pe-counter {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: var(--k-text-muted);
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }
        .pe-counter strong {
          color: var(--k-text-primary);
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-weight: 500;
        }

        .pe-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .pe-timer {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          background: var(--k-surface);
          border: 1px solid var(--k-border);
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 16px;
          font-weight: 500;
          font-variation-settings: 'opsz' 28, 'SOFT' 50;
          color: var(--k-text-primary);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
          transition: background 220ms ease, color 220ms ease, border-color 220ms ease;
        }
        .pe-timer :global(svg) { color: var(--k-text-muted); }
        .pe-timer-crit {
          background: var(--k-error-bg);
          border-color: var(--k-error);
          color: var(--k-error);
          animation: pe-pulse 1.4s ease-in-out infinite;
        }
        .pe-timer-crit :global(svg) { color: var(--k-error); }
        @keyframes pe-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(179, 38, 30, 0.3); }
          50% { box-shadow: 0 0 0 4px rgba(179, 38, 30, 0); }
        }

        .pe-exit {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          background: transparent;
          color: var(--k-text-muted);
          border: 1px solid transparent;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
        }
        .pe-exit:hover { background: var(--k-error-bg); color: var(--k-error); border-color: var(--k-error); }

        .pe-progress {
          height: 3px;
          background: transparent;
          margin: 0 -24px;
          border-top: 1px solid var(--k-border);
        }
        .pe-progress-fill {
          height: 100%;
          background: var(--k-primary);
          transition: width 400ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pe-body {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 24px 0;
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
          align-items: start;
        }

        .pe-question-card {
          padding: 32px;
          background: var(--k-surface);
          border: 1px solid var(--k-border);
          border-radius: 18px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 2px rgba(10, 10, 10, 0.02);
        }
        .pe-q-head {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px dashed var(--k-border);
        }
        .pe-q-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: var(--k-primary);
          color: var(--k-bg);
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 16px;
          font-weight: 500;
          font-variation-settings: 'opsz' 28, 'SOFT' 50;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .pe-q-text {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 20px;
          font-weight: 500;
          font-variation-settings: 'opsz' 42, 'SOFT' 50;
          color: var(--k-text-primary);
          letter-spacing: -0.015em;
          line-height: 1.4;
          margin: 0;
          flex: 1;
        }

        .pe-options {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pe-option {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 18px;
          background: var(--k-surface);
          border: 1px solid var(--k-border);
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          transition: border-color 160ms ease, background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pe-option:hover { border-color: var(--k-border-hover); background: var(--k-bg); }
        .pe-option-on {
          background: var(--k-primary);
          border-color: var(--k-primary);
        }
        .pe-option-on:hover { background: var(--k-primary-hover); border-color: var(--k-primary-hover); }
        .pe-option:focus-visible { outline: 2px solid var(--k-primary); outline-offset: 2px; }

        .pe-option-letter {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: var(--k-bg);
          border: 1px solid var(--k-border);
          color: var(--k-text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 13px;
          font-weight: 500;
        }
        .pe-option-letter-on {
          background: var(--k-bg);
          color: var(--k-primary);
          border-color: var(--k-bg);
        }
        .pe-option-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
          color: var(--k-text-primary);
        }
        .pe-option-on .pe-option-text { color: var(--k-bg); }

        .pe-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 8px;
        }
        .pe-next, .pe-finish {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 22px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pe-next:active, .pe-finish:active { transform: scale(0.97); }
        .pe-next {
          background: var(--k-primary);
          color: var(--k-bg);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .pe-next:hover { background: var(--k-primary-hover); }

        .pe-finish-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .pe-finish-ok {
          background: var(--k-primary);
          color: var(--k-bg);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .pe-finish-ok:hover:not(:disabled) { background: var(--k-primary-hover); }
        .pe-finish:disabled { opacity: 0.6; cursor: not-allowed; }
        .pe-finish-warn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: var(--k-warning);
          margin: 0;
        }
        .pe-submit-err {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }
        .pe-submit-err p {
          font-size: 12px;
          color: var(--k-error);
          margin: 0;
        }
        .pe-submit-err button {
          background: none;
          border: none;
          color: var(--k-text-primary);
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }

        .pe-spin {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: var(--k-surface);
          animation: pe-rot 700ms linear infinite;
        }
        @keyframes pe-rot { to { transform: rotate(360deg); } }

        .pe-navigator {
          padding: 22px 20px;
          background: var(--k-surface);
          border: 1px solid var(--k-border);
          border-radius: 18px;
          position: sticky;
          top: 90px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        .pe-nav-title {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 14px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: var(--k-text-primary);
          margin: 0 0 14px;
          padding-bottom: 10px;
          border-bottom: 1px dashed var(--k-border);
        }

        .pe-nav-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          margin-bottom: 18px;
        }
        .pe-nav-cell {
          aspect-ratio: 1;
          border-radius: 8px;
          background: var(--k-bg);
          border: 1px solid var(--k-border);
          color: var(--k-text-muted);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .pe-nav-cell:disabled { cursor: not-allowed; }
        .pe-nav-answered { background: var(--k-success-bg); border-color: var(--k-success); color: var(--k-primary); }
        .pe-nav-current {
          background: var(--k-primary);
          border-color: var(--k-primary);
          color: var(--k-bg);
          font-weight: 700;
          box-shadow: 0 0 0 3px rgba(10, 122, 71, 0.12);
        }
        .pe-nav-locked { background: var(--k-warning-bg); border-color: var(--k-border); color: var(--k-text-muted); }
        .pe-nav-future { background: transparent; border-color: var(--k-border); color: var(--k-warning); opacity: 0.7; }

        .pe-nav-legend {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pe-nav-legend li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: var(--k-text-muted);
          font-variant-numeric: tabular-nums;
        }
        .pe-nav-legend strong { color: var(--k-text-primary); font-weight: 600; font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; }
        .pe-nav-swatch {
          width: 12px;
          height: 12px;
          border-radius: 4px;
          border: 1px solid var(--k-border);
          flex-shrink: 0;
        }
        .pe-nav-swatch-ink { background: var(--k-primary); border-color: var(--k-primary); }
        .pe-nav-swatch-ok { background: var(--k-success-bg); border-color: var(--k-success); }
        .pe-nav-swatch-locked { background: var(--k-warning-bg); }
        .pe-nav-swatch-future { background: transparent; }

        @media (max-width: 960px) {
          .pe-body { grid-template-columns: 1fr; padding: 20px 16px 0; }
          .pe-navigator { position: static; order: -1; }
          .pe-nav-grid { grid-template-columns: repeat(8, 1fr); }
        }

        @media (max-width: 640px) {
          .pe-header { padding: 12px 16px 0; }
          .pe-header-left { gap: 10px; }
          .pe-training { font-size: 13px; max-width: 160px; }
          .pe-counter { font-size: 10px; }
          .pe-question-card { padding: 22px 18px; }
          .pe-q-text { font-size: 17px; }
          .pe-q-num { width: 40px; height: 40px; font-size: 14px; border-radius: 10px; }
          .pe-option { padding: 12px 14px; gap: 10px; }
          .pe-option-text { font-size: 13px; }
          .pe-option-letter { width: 28px; height: 28px; font-size: 12px; }
          .pe-next, .pe-finish { width: 100%; }
          .pe-finish-wrap { width: 100%; }
          .pe-nav-grid { grid-template-columns: repeat(6, 1fr); }
        }

        @media (max-width: 480px) {
          .pe-exit span { display: none; }
          .pe-exit { width: 36px; padding: 0; justify-content: center; }
          .pe-header-left { flex-wrap: wrap; }
          .pe-training { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
