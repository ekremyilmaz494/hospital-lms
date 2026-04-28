'use client';

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

        <style jsx>{`
          .pe-confirm {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: var(--k-bg);
          }
          .pe-confirm-card {
            width: 100%;
            max-width: 560px;
            background: var(--k-surface);
            border: 1px solid var(--k-border);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(10, 10, 10, 0.08);
          }
          .pe-confirm-head {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding: 26px 28px 22px;
            background: linear-gradient(135deg, var(--k-bg) 0%, var(--k-warning-bg) 100%);
            border-bottom: 1px solid var(--k-border);
            position: relative;
            overflow: hidden;
          }
          .pe-confirm-head::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 3px;
            background: var(--k-primary);
          }
          .pe-confirm-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: var(--k-primary);
            color: var(--k-bg);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .pe-confirm-eyebrow {
            display: block;
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--k-text-muted);
            margin-bottom: 4px;
          }
          .pe-confirm-head h1 {
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 26px;
            font-weight: 500;
            font-variation-settings: 'opsz' 48, 'SOFT' 50;
            color: var(--k-text-primary);
            letter-spacing: -0.02em;
            line-height: 1.05;
            margin: 0;
          }
          .pe-confirm-head p {
            font-size: 13px;
            color: var(--k-text-muted);
            margin: 6px 0 0;
          }

          .pe-rules {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
          }

          .pe-confirm-actions {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            padding: 16px 20px;
            border-top: 1px solid var(--k-border);
            background: var(--k-bg);
          }
          .pe-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 44px;
            padding: 0 18px;
            border-radius: 999px;
            font-family: var(--font-display, system-ui);
            font-size: 13px;
            font-weight: 600;
            border: 1px solid transparent;
            cursor: pointer;
            transition: background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
          }
          .pe-btn:active { transform: scale(0.97); }
          .pe-btn-ghost { background: transparent; color: var(--k-text-muted); border-color: var(--k-border); }
          .pe-btn-ghost:hover { background: var(--k-surface); color: var(--k-text-primary); border-color: var(--k-primary); }
          .pe-btn-primary { background: var(--k-primary); color: var(--k-bg); border-color: var(--k-primary); box-shadow: inset 0 1px 0 rgba(255,255,255,0.15); }
          .pe-btn-primary:hover { background: var(--k-primary-hover); border-color: var(--k-primary-hover); }
          .pe-btn-primary :global(svg) { color: var(--k-bg); }

          @media (max-width: 520px) {
            .pe-confirm-head { padding: 22px 20px 18px; gap: 12px; }
            .pe-confirm-head h1 { font-size: 22px; }
            .pe-confirm-actions { flex-direction: column-reverse; }
            .pe-btn { width: 100%; }
          }
        `}</style>
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
        <style>{`
          .pe-err { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 80px 20px; gap: 10px; max-width: 420px; margin: 0 auto; min-height: 60vh; justify-content: center; }
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

      <style jsx>{`
        .pe-root {
          min-height: 100vh;
          background: var(--k-bg);
          padding-bottom: 40px;
        }

        /* ── Header ── */
        .pe-header {
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 14px 24px 0;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
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

        /* ── Body ── */
        .pe-body {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 24px 0;
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
          align-items: start;
        }

        /* ── Question card ── */
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
          font-variation-settings: 'opsz' 20, 'SOFT' 50;
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

        /* ── Actions ── */
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
        .pe-finish {
          background: var(--k-warning);
          color: var(--k-bg);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .pe-finish:hover:not(:disabled) { background: var(--k-warning); }
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

        .pe-spin {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: var(--k-surface);
          animation: pe-rot 700ms linear infinite;
        }
        @keyframes pe-rot { to { transform: rotate(360deg); } }

        .pe-submit-err {
          display: flex;
          align-items: center;
          gap: 8px;
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

        /* ── Navigator ── */
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
        .pe-nav-answered {
          background: var(--k-success-bg);
          border-color: var(--k-success);
          color: var(--k-primary);
        }
        .pe-nav-current {
          background: var(--k-primary);
          border-color: var(--k-primary);
          color: var(--k-bg);
          font-weight: 700;
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.08);
        }
        .pe-nav-locked {
          background: var(--k-warning-bg);
          border-color: var(--k-border);
          color: var(--k-text-muted);
        }
        .pe-nav-future {
          background: transparent;
          border-color: var(--k-border);
          color: var(--k-warning);
          opacity: 0.7;
        }

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

        /* ── Responsive ── */
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
    ink:   { iconBg: 'var(--k-bg)', iconColor: 'var(--k-text-primary)' },
    amber: { iconBg: 'var(--k-warning-bg)', iconColor: 'var(--k-warning)' },
    err:   { iconBg: 'var(--k-error-bg)', iconColor: 'var(--k-error)' },
  }[tone];

  return (
    <li className="r-root">
      <span className="r-icon">{icon}</span>
      <div className="r-body">
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
      <style jsx>{`
        .r-root {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 28px;
          border-bottom: 1px dashed var(--k-border);
        }
        .r-root:last-child { border-bottom: none; }
        .r-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: ${palette.iconBg};
          color: ${palette.iconColor};
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .r-body h4 {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 14px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: var(--k-text-primary);
          margin: 0 0 3px;
          letter-spacing: -0.005em;
        }
        .r-body p {
          font-size: 12px;
          color: var(--k-text-muted);
          line-height: 1.55;
          margin: 0;
        }
      `}</style>
    </li>
  );
}
