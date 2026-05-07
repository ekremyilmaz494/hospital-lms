'use client';

import './pre-exam.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ChevronRight, AlertTriangle, LogOut, Shield, Timer, Ban, Lock, ArrowLeft } from 'lucide-react';
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
  const [maxReachedQ, setMaxReachedQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const [, setAttemptId] = useState<string | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!confirmed) return;
    let cancelled = false;

    type StartAttemptBody = { id?: string; status?: string; examOnly?: boolean; error?: string };
    async function startAttempt(): Promise<{ res: Response; body: StartAttemptBody }> {
      for (let i = 0; i < 2; i++) {
        try {
          const res = await fetch(`/api/exam/${id}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examType: 'pre' }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.status >= 500 && i === 0) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          return { res, body };
        } catch (err) {
          if (i === 0) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          throw err;
        }
      }
      throw new Error('unreachable');
    }

    async function initExam() {
      try {
        const { res: startRes, body: attempt } = await startAttempt();

        if (!startRes.ok) {
          if (!cancelled) setError(attempt?.error || 'Sınav başlatılamadı');
          return;
        }

        // examOnly attempt'ler START sonrası status='post_exam' ile döner;
        // attemptPhaseRedirect tek doğruluk kaynağı (bkz. exam-state-machine.ts).
        if (attempt?.status) {
          const redirect = attemptPhaseRedirect(attempt.status as AttemptStatus, 'pre-exam');
          if (redirect) {
            const path = redirect === 'my-trainings'
              ? '/staff/my-trainings'
              : `/exam/${id}/${redirect}`;
            router.replace(path);
            return;
          }
        }

        if (!cancelled) setAttemptId(attempt?.id ?? null);

        const [qRes, timerRawRes] = await Promise.all([
          fetch(`/api/exam/${id}/questions?phase=pre`),
          attempt?.id
            ? fetch(`/api/exam/${attempt.id}/timer`, { method: 'POST' })
            : Promise.resolve(null),
        ]);
        if (!qRes.ok) {
          const errData = await qRes.json().catch(() => ({}));
          if (!cancelled) setError(errData.error || 'Sorular yüklenemedi');
          return;
        }
        const data = await qRes.json();
        if (!cancelled) {
          setExamData(data);

          try {
            const timerData = timerRawRes ? await timerRawRes.json() : null;
            const remaining = timerData?.remainingSeconds ?? data.totalTime;
            if (timerRawRes && remaining <= 0) {
              if (!cancelled) setError('Sınav süresi dolmuş. Lütfen sınavı tekrar başlatın.');
              return;
            }
            setTimeLeft(remaining);
          } catch {
            setTimeLeft(data.totalTime);
          }

          if (data.questions) {
            const restored: Record<number, string> = {};
            for (const q of data.questions) {
              if (q.savedAnswer) restored[q.id] = q.savedAnswer;
            }
            if (Object.keys(restored).length > 0) setAnswers(restored);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Sınav başlatılamadı (ağ/istemci hatası): ${msg}`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    initExam();
    return () => { cancelled = true; };
  }, [id, router, confirmed]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  useEffect(() => {
    const saveOnExit = () => {
      const qs = examData?.questions ?? [];
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

  const goNext = useCallback(() => {
    setCurrentQ(prev => {
      const next = prev + 1;
      setMaxReachedQ(m => Math.max(m, next));
      return next;
    });
  }, []);

  const handleFinish = useCallback(async () => {
    if (submitting || !examData) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const qs = examData.questions ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedAnswers = qs.map((q: any) => {
        const questionId = q.questionId ?? q.id ?? '';
        const options = q.options ?? [];
        const selectedAnswer = answers[q.id];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedOption = options.find((o: any) => o.id === selectedAnswer);
        return selectedOption ? { questionId: String(questionId), selectedOptionId: selectedOption.optionId ?? selectedOption.id } : null;
      }).filter(Boolean);

      const res = await fetch(`/api/exam/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers, phase: 'pre', tabSwitchCount }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? 'Gönderim başarısız. Tekrar deneyin.');
        return;
      }

      router.replace(`/exam/${id}/transition?from=pre&score=${data.score ?? 0}`);
    } catch {
      setSubmitError('Bir hata oluştu. Tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  }, [id, answers, examData, router, submitting, tabSwitchCount]);

  const handleFinishRef = useRef<() => void>(undefined);
  handleFinishRef.current = handleFinish;
  useEffect(() => {
    if (timeLeft === 0 && handleFinishRef.current) handleFinishRef.current();
  }, [timeLeft]);

  // ── Consent screen ──
  if (!confirmed) {
    return (
      <div className="pe-confirm">
        <div className="pe-confirm-card">
          <div className="pe-confirm-head">
            <div className="pe-confirm-icon"><Shield className="h-5 w-5" /></div>
            <div>
              <span className="pe-confirm-eyebrow">Ön Sınav</span>
              <h1>Başlamadan önce</h1>
              <p>Aşağıdaki kurallar tüm sınav boyunca geçerlidir.</p>
            </div>
          </div>

          <ul className="pe-rules">
            <Rule
              icon={<Timer className="h-4 w-4" />}
              title="Süre başladığında durdurulamaz"
              desc="Sınavı başlattığın anda süre işler ve duraklatılamaz. Sayfayı kapatsan bile süre devam eder."
            />
            <Rule
              icon={<Ban className="h-4 w-4" />}
              title="Sekme değiştirme yasağı"
              desc="Sınav sırasında başka sekmeye geçmen tespit edilir ve admin raporlarına işlenir."
              tone="err"
            />
            <Rule
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Süre dolduğunda otomatik gönderim"
              desc="Süre bittiğinde cevapların otomatik gönderilir. Sonrasında gönderim kabul edilmez."
              tone="amber"
            />
            <Rule
              icon={<Lock className="h-4 w-4" />}
              title="Önceki soruya dönülemez"
              desc="Bir soruyu geçtikten sonra geri dönemezsin. Cevabını vermeden sonraki soruya geçme."
              tone="err"
            />
          </ul>

          <div className="pe-confirm-actions">
            <button onClick={() => router.back()} className="pe-btn pe-btn-ghost">
              <ArrowLeft className="h-4 w-4" />
              <span>Geri Dön</span>
            </button>
            <button onClick={() => setConfirmed(true)} className="pe-btn pe-btn-primary">
              <Shield className="h-4 w-4" />
              <span>Anladım, Sınavı Başlat</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    );
  }

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="pe-err">
        <div className="pe-err-icon"><AlertTriangle className="h-6 w-6" /></div>
        <h2>Sınav başlatılamadı</h2>
        <p>{error}</p>
        <button onClick={() => router.back()} className="pe-err-link">← Geri Dön</button>
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
  const currentTimeLeft = timeLeft ?? 0;
  const minutes = Math.floor(currentTimeLeft / 60);
  const seconds = currentTimeLeft % 60;
  const progress = ((currentQ + 1) / questions.length) * 100;
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;
  const isTimerCritical = currentTimeLeft > 0 && currentTimeLeft < 300;

  return (
    <div
      className="pe-root"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {/* ═══════ Header ═══════ */}
      <header className="pe-header">
        <div className="pe-header-row">
          <div className="pe-header-left">
            <span className="pe-phase-chip">Ön Sınav</span>
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
                          body: JSON.stringify({ questionId, selectedOptionId: opt.optionId, examPhase: 'pre' }),
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
                <button onClick={handleFinish} disabled={submitting} className="pe-finish">
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
            <li>
              <span className="pe-nav-swatch pe-nav-swatch-ink" />
              Aktif
            </li>
            <li>
              <span className="pe-nav-swatch pe-nav-swatch-ok" />
              Cevaplandı · <strong>{answeredCount}</strong>
            </li>
            <li>
              <span className="pe-nav-swatch pe-nav-swatch-locked" />
              Kilitli · geçildi
            </li>
            <li>
              <span className="pe-nav-swatch pe-nav-swatch-future" />
              Cevaplanmadı · <strong>{questions.length - answeredCount}</strong>
            </li>
          </ul>
        </aside>
      </div>

    </div>
  );
}

// ── Rule row for consent screen ──
function Rule({
  icon, title, desc, tone = 'ink',
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone?: 'ink' | 'amber' | 'err';
}) {
  const palette = {
    ink:   { iconBg: 'var(--ed-cream)', iconColor: 'var(--ed-ink)' },
    amber: { iconBg: 'var(--k-warning-bg)', iconColor: 'var(--k-warning)' },
    err:   { iconBg: 'var(--k-error-bg)', iconColor: 'var(--k-error)' },
  }[tone];

  return (
    <li
      className="r-root"
      style={{
        ['--r-icon-bg' as string]: palette.iconBg,
        ['--r-icon-color' as string]: palette.iconColor,
      } as Record<string, string>}
    >
      <span className="r-icon">{icon}</span>
      <div className="r-body">
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
    </li>
  );
}
