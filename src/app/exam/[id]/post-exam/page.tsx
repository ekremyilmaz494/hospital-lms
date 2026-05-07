'use client';

import './post-exam.css';
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
    // iOS Safari (iPhone/iPad) `requestFullscreen` desteklemez — ham çağrı
    // sessiz reject döndürür ve kullanıcıyı tıkanmış toast'a hapseder.
    // Mobil Safari'de fullscreen yerine "exam shell" modu (data-exam-shell)
    // ile topbar/sidebar gizlenir; visibilitychange + blur tab switch denetimi
    // zaten ayrı bir effect'te yürür → kopya kontrolü korunur.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && 'ontouchend' in document);
    const supportsFullscreen = typeof document.documentElement.requestFullscreen === 'function' && !isIOS;

    if (!supportsFullscreen) {
      document.documentElement.setAttribute('data-exam-shell', 'on');
      return () => {
        document.documentElement.removeAttribute('data-exam-shell');
      };
    }

    document.documentElement.requestFullscreen().catch(() => {
      // Desktop'ta da reddedilebilir (permission). Shell moduna düş.
      document.documentElement.setAttribute('data-exam-shell', 'on');
    });
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        toast('Tam ekran modundan çıkmayınız', 'warning');
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.documentElement.removeAttribute('data-exam-shell');
    };
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
      </div>
    );
  }

  if (!examData || (examData.questions ?? []).length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: 'var(--ed-ink-soft)', fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif', fontSize: 16 }}>
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

    </div>
  );
}
