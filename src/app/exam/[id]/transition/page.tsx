'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Play, Award, CheckCircle2, ArrowRight, Check, X, Clock } from 'lucide-react';

interface QuestionResult {
  questionText: string;
  selectedOptionText: string | null;
  correctOptionText: string | null;
  isCorrect: boolean;
}

const COUNTDOWN_SECONDS = 10;

function TransitionContent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const from = searchParams.get('from') ?? 'pre';
  const score = searchParams.get('score');
  const passed = searchParams.get('passed');
  const passingScore = searchParams.get('passingScore');
  const attemptsRemaining = Number(searchParams.get('attemptsRemaining') ?? '0');
  const attemptIdParam = searchParams.get('attemptId');
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatedRef = useRef(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [feedbackRequired, setFeedbackRequired] = useState(false);
  const [feedbackMandatory, setFeedbackMandatory] = useState(false);

  const isPreToVideos = from === 'pre' || from === 'pre-exam';
  const isVideosToPost = from === 'videos';
  const isPostResult = from === 'post-exam';

  const destination = isPreToVideos
    ? `/exam/${id}/videos`
    : isVideosToPost
      ? `/exam/${id}/post-exam`
      : '/staff/my-trainings';

  const [passedGuardChecked, setPassedGuardChecked] = useState(!isVideosToPost);
  useEffect(() => {
    if (!isPreToVideos && !isVideosToPost) return;
    fetch(`/api/exam/${id}/start`, { method: 'POST' })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (res.ok) {
          // Videos page cift POST atmasin — 5s pencere
          try { sessionStorage.setItem(`exam-start-${id}`, String(Date.now())); } catch { /* ignore */ }
        }
        if (isPreToVideos && data?.examOnly) {
          router.replace(`/exam/${id}/post-exam`);
          return;
        }
        if (isVideosToPost) {
          const alreadyPassed = !res.ok && typeof data?.error === 'string' && data.error.includes('başarıyla tamamladınız');
          if (alreadyPassed) {
            router.replace('/staff/my-trainings');
            return;
          }
          setPassedGuardChecked(true);
        }
      })
      .catch(() => {
        if (isVideosToPost) setPassedGuardChecked(true);
      });
  }, [id, isPreToVideos, isVideosToPost, router]);

  const shouldCountdown = !isPostResult && passedGuardChecked;

  const navigate = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace(destination);
  };

  useEffect(() => {
    if (!shouldCountdown) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [shouldCountdown]);

  useEffect(() => {
    if (timeLeft === 0 && shouldCountdown) navigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    if (!isPostResult) return;
    // 1) Fast path: submit sonrası sessionStorage'da tazeyken oku
    try {
      const stored = sessionStorage.getItem(`exam-results-${id}`);
      if (stored) {
        setQuestionResults(JSON.parse(stored) as QuestionResult[]);
        sessionStorage.removeItem(`exam-results-${id}`);
        return;
      }
    } catch { /* ignore */ }

    // 2) Fallback: sayfa yenilendi ya da telefon kapanıp açıldı → DB'den replay
    //    Sadece geçen kullanıcı için endpoint detay döndürür (anti-cheating).
    if (passed !== 'true' || !attemptIdParam) return;
    let cancelled = false;
    fetch(`/api/exam/${attemptIdParam}/results`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d || !Array.isArray(d.results)) return;
        setQuestionResults(d.results as QuestionResult[]);
      })
      .catch(() => { /* sessiz — ekranda skor kartı yeterli */ });
    return () => { cancelled = true; };
  }, [isPostResult, id, passed, attemptIdParam]);

  useEffect(() => {
    if (!isPostResult || !attemptIdParam) return;
    let cancelled = false;
    fetch(`/api/feedback/status?attemptId=${attemptIdParam}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return;
        setFeedbackRequired(!!d.feedbackRequired);
        setFeedbackMandatory(!!d.feedbackMandatory);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [isPostResult, attemptIdParam]);

  // ═══ POST-EXAM RESULT SCREEN ═══
  if (isPostResult) {
    const isPassed = passed === 'true';
    const scoreNum = Number(score ?? 0);
    const passingNum = Number(passingScore ?? 70);
    const correctCount = questionResults.filter(r => r.isCorrect).length;
    const wrongCount = questionResults.filter(r => !r.isCorrect && r.selectedOptionText !== null).length;
    const skippedCount = questionResults.filter(r => r.selectedOptionText === null).length;

    return (
      <div className={`tr-result ${isPassed ? 'tr-result-pass' : 'tr-result-fail'}`}>
        <div className="tr-result-inner">
          {/* ── Score card ── */}
          <section className="tr-score-card">
            <div className="tr-score-hero">
              <div className="tr-score-icon">
                {isPassed ? <CheckCircle2 className="h-6 w-6" /> : <X className="h-6 w-6" />}
              </div>
              <span className="tr-score-eyebrow">Sınav Sonucu</span>
              <h1 className="tr-score-title">
                {isPassed ? (
                  <>Tebrikler, <em>başarılı</em></>
                ) : (
                  <>Ne yazık ki, <em>başarısız</em></>
                )}
              </h1>
              <p className="tr-score-subtitle">
                {isPassed ? 'Eğitimi başarıyla tamamladın.' : 'Baraj puanını geçemedin.'}
              </p>
            </div>

            <div className="tr-score-body">
              <div className="tr-score-pair">
                <div className="tr-score-slot">
                  <span className="tr-slot-label">Puanın</span>
                  <div className="tr-slot-value tr-slot-value-main">
                    <span>{scoreNum}</span>
                    <span className="tr-slot-pct">%</span>
                  </div>
                </div>
                <div className="tr-score-slot">
                  <span className="tr-slot-label">Baraj</span>
                  <div className="tr-slot-value">
                    <span>{passingNum}</span>
                    <span className="tr-slot-pct">%</span>
                  </div>
                </div>
              </div>

              <div className="tr-score-bar">
                <div className="tr-score-bar-track" />
                <div className="tr-score-bar-fill" style={{ width: `${scoreNum}%` }} />
                <div className="tr-score-bar-threshold" style={{ left: `${passingNum}%` }} />
              </div>

              {questionResults.length > 0 && (
                <div className="tr-tally">
                  <div className="tr-tally-cell tr-tally-ok">
                    <span className="tr-tally-num">{correctCount.toString().padStart(2, '0')}</span>
                    <span className="tr-tally-label">Doğru</span>
                  </div>
                  <div className="tr-tally-cell tr-tally-err">
                    <span className="tr-tally-num">{wrongCount.toString().padStart(2, '0')}</span>
                    <span className="tr-tally-label">Yanlış</span>
                  </div>
                  <div className="tr-tally-cell tr-tally-skip">
                    <span className="tr-tally-num">{skippedCount.toString().padStart(2, '0')}</span>
                    <span className="tr-tally-label">Boş</span>
                  </div>
                </div>
              )}

              {!isPassed && attemptsRemaining > 0 && (
                <div className="tr-notice tr-notice-amber">
                  <h4><em>{attemptsRemaining}</em> deneme hakkın kaldı</h4>
                  <p>Sonraki denemende ön sınav atlanır, doğrudan videoları izleyip son sınava girersin.</p>
                </div>
              )}
              {!isPassed && attemptsRemaining === 0 && (
                <div className="tr-notice tr-notice-err">
                  <h4>Tüm deneme hakların tükendi</h4>
                  <p>Yeni bir deneme için eğitim yöneticine başvur.</p>
                </div>
              )}

              <button
                onClick={() => {
                  if (feedbackRequired && attemptIdParam) {
                    router.push(`/exam/${id}/feedback?attemptId=${attemptIdParam}`);
                  } else {
                    router.push('/staff/my-trainings');
                  }
                }}
                className={`tr-cta ${isPassed ? 'tr-cta-ok' : 'tr-cta-ink'}`}
              >
                <span>
                  {feedbackRequired
                    ? (feedbackMandatory ? 'Zorunlu Geri Bildirimi Doldur' : 'Geri Bildirim Ver')
                    : 'Eğitimlerime Dön'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* ── Per-question results ── */}
          {questionResults.length > 0 && (
            <section className="tr-analysis">
              <header>
                <span className="tr-analysis-eyebrow">Soru Analizi</span>
                <h2>{questionResults.length} sorunun dökümü</h2>
              </header>
              <ul className="tr-analysis-list">
                {questionResults.map((result, i) => (
                  <li key={i} className={`tr-qa ${result.isCorrect ? 'tr-qa-ok' : result.selectedOptionText === null ? 'tr-qa-skip' : 'tr-qa-err'}`}>
                    <div className="tr-qa-head">
                      <span className="tr-qa-mark">
                        {result.isCorrect ? <Check className="h-3.5 w-3.5" /> : result.selectedOptionText === null ? '—' : <X className="h-3.5 w-3.5" />}
                      </span>
                      <p className="tr-qa-text">
                        <span className="tr-qa-num">{(i + 1).toString().padStart(2, '0')}</span>
                        {result.questionText}
                      </p>
                    </div>

                    <div className="tr-qa-answers">
                      {result.selectedOptionText && (
                        <div className={`tr-qa-row ${result.isCorrect ? 'tr-qa-row-ok' : 'tr-qa-row-err'}`}>
                          <span className="tr-qa-row-label">{result.isCorrect ? 'Doğru' : 'Senin cevabın'}</span>
                          <span className="tr-qa-row-text">{result.selectedOptionText}</span>
                        </div>
                      )}

                      {!result.isCorrect && result.correctOptionText && (
                        <div className="tr-qa-row tr-qa-row-ok">
                          <span className="tr-qa-row-label">Doğru cevap</span>
                          <span className="tr-qa-row-text">{result.correctOptionText}</span>
                        </div>
                      )}

                      {result.selectedOptionText === null && (
                        <div className="tr-qa-row tr-qa-row-skip">
                          <span className="tr-qa-row-text-skip">Boş bırakıldı</span>
                          {result.correctOptionText && (
                            <>
                              <span className="tr-qa-row-label tr-qa-row-label-skip">· Doğru cevap</span>
                              <span className="tr-qa-row-text">{result.correctOptionText}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <style jsx>{`
          .tr-result {
            min-height: 100vh;
            padding: 32px 20px 60px;
            background: var(--k-bg);
            position: relative;
            overflow: hidden;
          }
          .tr-result::before {
            content: '';
            position: absolute;
            top: -30%;
            right: -20%;
            width: 700px;
            height: 700px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(10, 122, 71, 0.06) 0%, transparent 60%);
            pointer-events: none;
          }
          .tr-result-fail::before {
            background: radial-gradient(circle, rgba(179, 38, 30, 0.06) 0%, transparent 60%);
          }
          .tr-result-inner {
            max-width: 640px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 18px;
            position: relative;
          }

          /* ── Score card ── */
          .tr-score-card {
            background: var(--k-surface);
            border: 1px solid var(--k-border);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(10, 10, 10, 0.08);
          }
          .tr-score-hero {
            padding: 36px 32px 28px;
            text-align: center;
            background: linear-gradient(135deg, var(--k-bg) 0%, var(--k-warning-bg) 100%);
            border-bottom: 1px solid var(--k-border);
            position: relative;
            overflow: hidden;
          }
          .tr-score-hero::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 3px;
            background: ${isPassed ? 'var(--k-primary)' : 'var(--k-error)'};
          }
          .tr-score-icon {
            width: 60px;
            height: 60px;
            border-radius: 999px;
            background: ${isPassed ? 'var(--k-primary)' : 'var(--k-error)'};
            color: var(--k-bg);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
          }
          .tr-score-eyebrow {
            display: inline-block;
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--k-text-muted);
            margin-bottom: 8px;
          }
          .tr-score-title {
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: clamp(26px, 4.5vw, 36px);
            font-weight: 500;
            font-variation-settings: 'opsz' 72, 'SOFT' 50;
            color: var(--k-text-primary);
            letter-spacing: -0.025em;
            line-height: 1.05;
            margin: 0 0 8px;
          }
          .tr-score-title em {
            font-style: italic;
            color: ${isPassed ? 'var(--k-primary)' : 'var(--k-error)'};
            font-variation-settings: 'opsz' 72, 'SOFT' 100;
          }
          .tr-score-subtitle {
            font-size: 13px;
            color: var(--k-text-muted);
            margin: 0;
          }

          .tr-score-body {
            padding: 28px 32px 32px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .tr-score-pair {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          .tr-score-slot {
            padding: 18px 20px;
            background: var(--k-bg);
            border: 1px solid var(--k-border);
            border-radius: 12px;
            text-align: center;
          }
          .tr-slot-label {
            display: block;
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--k-text-muted);
            margin-bottom: 8px;
          }
          .tr-slot-value {
            display: flex;
            align-items: baseline;
            justify-content: center;
            gap: 2px;
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 38px;
            font-weight: 500;
            font-variation-settings: 'opsz' 72, 'SOFT' 50;
            color: var(--k-text-primary);
            line-height: 1;
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.03em;
          }
          .tr-slot-value-main {
            color: ${isPassed ? 'var(--k-primary)' : 'var(--k-error)'};
          }
          .tr-slot-pct {
            font-family: var(--font-display, system-ui);
            font-size: 14px;
            color: var(--k-text-muted);
            font-weight: 500;
            letter-spacing: 0;
          }

          .tr-score-bar {
            position: relative;
            height: 8px;
            background: var(--k-border);
            border-radius: 4px;
            overflow: visible;
          }
          .tr-score-bar-track { display: none; }
          .tr-score-bar-fill {
            position: absolute;
            left: 0; top: 0; bottom: 0;
            background: ${isPassed ? 'var(--k-primary)' : 'var(--k-error)'};
            border-radius: 4px;
            transition: width 1100ms cubic-bezier(0.16, 1, 0.3, 1);
          }
          .tr-score-bar-threshold {
            position: absolute;
            top: -4px;
            bottom: -4px;
            width: 2px;
            background: var(--k-text-primary);
            border-radius: 1px;
          }
          .tr-score-bar-threshold::after {
            content: 'Baraj';
            position: absolute;
            bottom: -18px;
            left: 50%;
            transform: translateX(-50%);
            font-family: var(--font-display, system-ui);
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--k-text-muted);
            white-space: nowrap;
          }

          .tr-tally {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-top: 10px;
          }
          .tr-tally-cell {
            padding: 12px 10px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid transparent;
          }
          .tr-tally-ok { background: var(--k-success-bg); border-color: var(--k-success); }
          .tr-tally-err { background: var(--k-error-bg); border-color: var(--k-error); }
          .tr-tally-skip { background: var(--k-bg); border-color: var(--k-border); }
          .tr-tally-num {
            display: block;
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 24px;
            font-weight: 500;
            font-variation-settings: 'opsz' 42, 'SOFT' 50;
            line-height: 1;
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.02em;
          }
          .tr-tally-ok .tr-tally-num { color: var(--k-primary); }
          .tr-tally-err .tr-tally-num { color: var(--k-error); }
          .tr-tally-skip .tr-tally-num { color: var(--k-text-muted); }
          .tr-tally-label {
            display: block;
            margin-top: 4px;
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--k-text-muted);
          }

          .tr-notice {
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid transparent;
            position: relative;
            overflow: hidden;
          }
          .tr-notice::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 3px;
          }
          .tr-notice-amber { background: var(--k-warning-bg); border-color: var(--k-warning); }
          .tr-notice-amber::before { background: var(--k-warning); }
          .tr-notice-err { background: var(--k-error-bg); border-color: var(--k-error); }
          .tr-notice-err::before { background: var(--k-error); }
          .tr-notice h4 {
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 15px;
            font-weight: 500;
            font-variation-settings: 'opsz' 28;
            margin: 0 0 4px;
            padding-left: 10px;
          }
          .tr-notice-amber h4 { color: var(--k-warning); }
          .tr-notice-err h4 { color: var(--k-error); }
          .tr-notice h4 em { font-style: italic; font-weight: 600; font-variation-settings: 'opsz' 28, 'SOFT' 100; }
          .tr-notice p {
            font-size: 12px;
            line-height: 1.55;
            margin: 0;
            padding-left: 10px;
          }
          .tr-notice-amber p { color: var(--k-warning); }
          .tr-notice-err p { color: var(--k-error); opacity: 0.85; }

          .tr-cta {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 52px;
            padding: 0 24px;
            border-radius: 999px;
            font-family: var(--font-display, system-ui);
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            color: var(--k-bg);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 20px rgba(10, 10, 10, 0.12);
            transition: background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
          }
          .tr-cta-ok { background: var(--k-primary); }
          .tr-cta-ok:hover { background: var(--k-primary-hover); }
          .tr-cta-ink { background: var(--k-text-primary); }
          .tr-cta-ink:hover { background: var(--k-primary-hover); }
          .tr-cta:active { transform: scale(0.98); }

          /* ── Analysis ── */
          .tr-analysis {
            background: var(--k-surface);
            border: 1px solid var(--k-border);
            border-radius: 20px;
            overflow: hidden;
          }
          .tr-analysis header {
            padding: 22px 28px;
            border-bottom: 1px solid var(--k-border);
            background: var(--k-bg);
          }
          .tr-analysis-eyebrow {
            display: block;
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--k-text-muted);
            margin-bottom: 4px;
          }
          .tr-analysis header h2 {
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 20px;
            font-weight: 500;
            font-variation-settings: 'opsz' 36, 'SOFT' 50;
            color: var(--k-text-primary);
            letter-spacing: -0.015em;
            margin: 0;
          }

          .tr-analysis-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .tr-qa {
            padding: 20px 28px;
            border-bottom: 1px dashed var(--k-border);
          }
          .tr-qa:last-child { border-bottom: none; }

          .tr-qa-head {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 12px;
          }
          .tr-qa-mark {
            flex-shrink: 0;
            width: 28px;
            height: 28px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 13px;
            color: var(--k-bg);
            margin-top: 2px;
          }
          .tr-qa-ok .tr-qa-mark { background: var(--k-primary); }
          .tr-qa-err .tr-qa-mark { background: var(--k-error); }
          .tr-qa-skip .tr-qa-mark { background: var(--k-text-muted); }

          .tr-qa-text {
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 15px;
            font-weight: 500;
            font-variation-settings: 'opsz' 28;
            color: var(--k-text-primary);
            line-height: 1.45;
            margin: 0;
            flex: 1;
          }
          .tr-qa-num {
            display: inline-block;
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            color: var(--k-text-muted);
            margin-right: 8px;
            font-variant-numeric: tabular-nums;
          }

          .tr-qa-answers {
            padding-left: 40px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .tr-qa-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-radius: 10px;
            flex-wrap: wrap;
          }
          .tr-qa-row-ok { background: var(--k-success-bg); border: 1px solid var(--k-success); }
          .tr-qa-row-err { background: var(--k-error-bg); border: 1px solid var(--k-error); }
          .tr-qa-row-skip { background: var(--k-bg); border: 1px dashed var(--k-border); }

          .tr-qa-row-label {
            font-family: var(--font-display, system-ui);
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            flex-shrink: 0;
          }
          .tr-qa-row-ok .tr-qa-row-label { color: var(--k-primary); }
          .tr-qa-row-err .tr-qa-row-label { color: var(--k-error); }
          .tr-qa-row-label-skip { color: var(--k-text-muted); }
          .tr-qa-row-text {
            font-size: 13px;
            color: var(--k-text-primary);
            line-height: 1.45;
          }
          .tr-qa-row-text-skip {
            font-size: 12px;
            color: var(--k-text-muted);
            font-style: italic;
          }

          @media (max-width: 640px) {
            .tr-score-hero { padding: 28px 22px 22px; }
            .tr-score-body { padding: 22px 22px 24px; }
            .tr-analysis header { padding: 18px 20px; }
            .tr-qa { padding: 16px 20px; }
            .tr-qa-answers { padding-left: 20px; }
            .tr-score-pair { grid-template-columns: 1fr 1fr; gap: 10px; }
            .tr-slot-value { font-size: 32px; }
          }

          @media (max-width: 420px) {
            .tr-qa-answers { padding-left: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ═══ COUNTDOWN TRANSITION ═══
  const title = isPreToVideos ? 'Ön sınavı tamamladın' : 'Tüm videoları izledin';
  const subtitle = isPreToVideos ? 'Şimdi eğitim videolarına geçeceksin.' : 'Şimdi son sınava gireceksin.';
  const ctaLabel = isPreToVideos ? 'Videolara Geç' : 'Son Sınava Başla';
  const CtaIcon = isPreToVideos ? Play : Award;

  const circumference = 2 * Math.PI * 54;
  const progress = ((COUNTDOWN_SECONDS - timeLeft) / COUNTDOWN_SECONDS) * circumference;

  return (
    <div className="tr-count">
      <div className="tr-count-inner">
        <div className="tr-count-icon">
          <CheckCircle2 className="h-7 w-7" />
        </div>

        <span className="tr-count-eyebrow">Geçiş</span>
        <h1 className="tr-count-title">{title}</h1>
        <p className="tr-count-subtitle">{subtitle}</p>

        {score && (
          <div className="tr-count-score">
            <span>Puanın</span>
            <strong>{score}%</strong>
          </div>
        )}

        <div className="tr-count-ring-wrap">
          <svg viewBox="0 0 128 128" className="tr-count-ring">
            <circle cx="64" cy="64" r="54" fill="none" strokeWidth="5" stroke="var(--k-border)" />
            <circle
              cx="64" cy="64" r="54" fill="none" strokeWidth="5"
              stroke="var(--k-text-primary)" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              transform="rotate(-90 64 64)"
              className="tr-count-arc"
            />
          </svg>
          <div className="tr-count-digit">
            <span>{timeLeft}</span>
            <span className="tr-count-unit">sn</span>
          </div>
        </div>

        <p className="tr-count-hint">
          <Clock className="h-3 w-3" />
          {timeLeft > 0 ? `${timeLeft} saniye sonra otomatik geçiş` : 'Yönlendiriliyor…'}
        </p>

        <button onClick={navigate} className="tr-count-cta">
          <CtaIcon className="h-4 w-4" />
          <span>{ctaLabel}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <style jsx>{`
        .tr-count {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          background: var(--k-bg);
          position: relative;
          overflow: hidden;
        }
        .tr-count::before {
          content: '';
          position: absolute;
          top: -30%;
          right: -20%;
          width: 700px;
          height: 700px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(10, 122, 71, 0.07) 0%, transparent 60%);
          pointer-events: none;
        }
        .tr-count-inner {
          width: 100%;
          max-width: 480px;
          text-align: center;
          background: var(--k-surface);
          border: 1px solid var(--k-border);
          border-radius: 20px;
          padding: 36px 32px;
          box-shadow: 0 12px 40px rgba(10, 10, 10, 0.06);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .tr-count-icon {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          background: var(--k-primary);
          color: var(--k-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
        }
        .tr-count-eyebrow {
          display: inline-block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--k-text-muted);
          margin-bottom: 8px;
        }
        .tr-count-title {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 28px;
          font-weight: 500;
          font-variation-settings: 'opsz' 56, 'SOFT' 50;
          color: var(--k-text-primary);
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0 0 6px;
        }
        .tr-count-subtitle {
          font-size: 13px;
          color: var(--k-text-muted);
          margin: 0 0 16px;
        }

        .tr-count-score {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          background: var(--k-bg);
          border: 1px solid var(--k-border);
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: var(--k-text-muted);
          margin-bottom: 24px;
        }
        .tr-count-score strong {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 14px;
          font-weight: 500;
          color: var(--k-text-primary);
          font-variant-numeric: tabular-nums;
        }

        .tr-count-ring-wrap {
          position: relative;
          width: 140px;
          height: 140px;
          margin: 0 auto 18px;
        }
        .tr-count-ring { width: 100%; height: 100%; display: block; }
        .tr-count-arc { transition: stroke-dashoffset 1s linear; }
        .tr-count-digit {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 3px;
        }
        .tr-count-digit > span:first-child {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 42px;
          font-weight: 500;
          font-variation-settings: 'opsz' 72, 'SOFT' 50;
          color: var(--k-text-primary);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.03em;
          line-height: 1;
          align-self: center;
        }
        .tr-count-unit {
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          color: var(--k-text-muted);
          margin-bottom: 6px;
        }

        .tr-count-hint {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: var(--k-text-muted);
          margin: 0 0 24px;
          font-variant-numeric: tabular-nums;
        }

        .tr-count-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 52px;
          padding: 0 28px;
          border-radius: 999px;
          background: var(--k-primary);
          color: var(--k-bg);
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 20px rgba(10, 10, 10, 0.15);
          transition: background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tr-count-cta:hover { background: var(--k-primary-hover); }
        .tr-count-cta:active { transform: scale(0.97); }

        @media (max-width: 480px) {
          .tr-count-inner { padding: 28px 22px; }
          .tr-count-title { font-size: 24px; }
          .tr-count-cta { width: 100%; padding: 0 20px; }
        }
      `}</style>
    </div>
  );
}

export default function TransitionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--k-bg)', color: 'var(--k-text-muted)', fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif', fontSize: 16 }}>
        Yükleniyor…
      </div>
    }>
      <TransitionContent />
    </Suspense>
  );
}
