'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  ChevronRight,
  EyeOff,
  Eye,
} from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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
    return () => { cancelled = true; };
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
      <div className="fb-done">
        <div className="fb-done-card">
          <div className="fb-done-icon"><CheckCircle2 className="h-7 w-7" /></div>
          <span className="fb-done-eyebrow">Teşekkürler</span>
          <h2>Geri bildiriminiz <em>alındı</em></h2>
          <p>Bu eğitim için formu daha önce tamamladın. Görüşlerin eğitim kalitemizi geliştirmemize yardımcı oluyor.</p>
          <button onClick={() => router.push('/staff/my-trainings')} className="fb-done-cta">
            <span>Eğitimlerime Dön</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <style jsx>{`
          .fb-done {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 20px;
            background: #faf7f2;
            position: relative;
            overflow: hidden;
          }
          .fb-done::before {
            content: '';
            position: absolute;
            top: -30%;
            right: -20%;
            width: 700px;
            height: 700px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(10, 122, 71, 0.08) 0%, transparent 60%);
            pointer-events: none;
          }
          .fb-done-card {
            width: 100%;
            max-width: 480px;
            padding: 40px 36px;
            background: #ffffff;
            border: 1px solid #e5e0d5;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 12px 40px rgba(10, 10, 10, 0.06);
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
          }
          .fb-done-icon {
            width: 64px;
            height: 64px;
            border-radius: 999px;
            background: #0a7a47;
            color: #faf7f2;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
          }
          .fb-done-eyebrow {
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #5b6478;
            margin-bottom: 8px;
          }
          .fb-done h2 {
            font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
            font-size: 26px;
            font-weight: 500;
            font-variation-settings: 'opsz' 48, 'SOFT' 50;
            color: #0a1628;
            letter-spacing: -0.02em;
            line-height: 1.1;
            margin: 0 0 10px;
          }
          .fb-done h2 em {
            font-style: italic;
            color: #0a7a47;
            font-variation-settings: 'opsz' 48, 'SOFT' 100;
          }
          .fb-done p {
            font-size: 13px;
            color: #5b6478;
            line-height: 1.55;
            margin: 0 0 24px;
            max-width: 360px;
          }
          .fb-done-cta {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 48px;
            padding: 0 24px;
            border-radius: 999px;
            background: #0a1628;
            color: #faf7f2;
            border: none;
            cursor: pointer;
            font-family: var(--font-display, system-ui);
            font-size: 14px;
            font-weight: 600;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 20px rgba(10, 10, 10, 0.15);
            transition: background 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
          }
          .fb-done-cta:hover { background: #1a1a1a; }
          .fb-done-cta:active { transform: scale(0.97); }
        `}</style>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="fb-root">
      {/* ── Sticky progress ── */}
      <div className="fb-sticky">
        <div className="fb-sticky-inner">
          <span className="fb-sticky-title">{trainingTitle || 'Eğitim Değerlendirmesi'}</span>
          <span className="fb-sticky-count">
            <strong>{answeredCount.toString().padStart(2, '0')}</strong>/<strong>{totalCount.toString().padStart(2, '0')}</strong>
          </span>
        </div>
        <div className="fb-progress">
          <div className="fb-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="fb-body">
        {/* ── Mandatory banner ── */}
        {isMandatory && (
          <div className="fb-mandatory">
            <div className="fb-mandatory-icon"><AlertTriangle className="h-4 w-4" /></div>
            <div>
              <h3>Bu değerlendirme zorunlu</h3>
              <p>Formu tamamlamadan yeni bir eğitime başlayamazsın.</p>
            </div>
          </div>
        )}

        {/* ── Editorial header ── */}
        <header className="fb-hero">
          <span className="fb-eyebrow">
            {form.documentCode || 'Geri Bildirim'}
          </span>
          <h1 className="fb-title">{form.title}</h1>
          {form.description && <p className="fb-subtitle">{form.description}</p>}
          <p className="fb-quote">
            <em>Görüşleriniz eğitim kalitemizi doğrudan şekillendirir.</em>
          </p>
        </header>

        {/* ── Categories ── */}
        <div className="fb-categories">
          {form.categories.map((category, catIdx) => (
            <section key={category.id} className="fb-category">
              <header className="fb-category-head">
                <span className="fb-category-num">{String(catIdx + 1).padStart(2, '0')}</span>
                <div>
                  <span className="fb-category-eyebrow">Bölüm {catIdx + 1}</span>
                  <h2>{category.name}</h2>
                </div>
              </header>

              <div className="fb-items">
                {category.items.map((item, itemIdx) => {
                  const answered = isAnswered(item);
                  return (
                    <div key={item.id} className={`fb-item ${answered ? 'fb-item-answered' : ''}`}>
                      <div className="fb-item-head">
                        <span className={`fb-item-num ${answered ? 'fb-item-num-ok' : ''}`}>
                          {answered ? <CheckCircle2 className="h-3.5 w-3.5" /> : String(itemIdx + 1).padStart(2, '0')}
                        </span>
                        <label className="fb-item-label">
                          {item.text}
                          {item.isRequired && <span className="fb-req">Zorunlu</span>}
                        </label>
                      </div>

                      {item.questionType === 'likert_5' && (
                        <div className="fb-likert">
                          <div className="fb-likert-grid">
                            {LIKERT_OPTIONS.map((opt) => {
                              const selected = answers[item.id]?.score === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setScore(item.id, opt.value)}
                                  className={`fb-likert-cell ${selected ? 'fb-likert-cell-on' : ''}`}
                                  aria-pressed={selected}
                                >
                                  <span className="fb-likert-value">{opt.value}</span>
                                  <span className="fb-likert-label">{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {item.questionType === 'yes_partial_no' && (
                        <div className="fb-ypn">
                          {YPN_OPTIONS.map((opt) => {
                            const selected = answers[item.id]?.score === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setScore(item.id, opt.value)}
                                className={`fb-ypn-cell ${selected ? 'fb-ypn-cell-on' : ''}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {item.questionType === 'text' && (
                        <div className="fb-text-wrap">
                          <textarea
                            value={answers[item.id]?.textAnswer ?? ''}
                            onChange={(e) => setText(item.id, e.target.value)}
                            rows={4}
                            maxLength={2000}
                            placeholder="Görüşlerini paylaş..."
                            className="fb-textarea"
                          />
                          <div className="fb-text-count">
                            {(answers[item.id]?.textAnswer ?? '').length} / 2000
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

        {/* ── Identity switch ── */}
        <section className="fb-identity">
          <div className={`fb-identity-icon ${includeName ? 'fb-identity-icon-on' : ''}`}>
            {includeName ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </div>
          <div className="fb-identity-body">
            <h3>{includeName ? 'Adın görünecek' : 'Anonim gönderim'}</h3>
            <p>
              {includeName
                ? 'Yöneticiler yanıtlarını adınla birlikte görecek.'
                : 'Yanıtların EY.FR.40 standardı gereği anonim değerlendirilir. İstersen adının görünmesine izin verebilirsin.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={includeName}
            onClick={() => setIncludeName((v) => !v)}
            className={`fb-switch ${includeName ? 'fb-switch-on' : ''}`}
          >
            <span className="fb-switch-dot" />
          </button>
        </section>

        {/* ── KVKK ── */}
        <div className="fb-kvkk">
          <Shield className="h-3.5 w-3.5" />
          <p>Yanıtların KVKK kapsamında güvenli saklanır ve yalnızca eğitim iyileştirme amacıyla kullanılır.</p>
        </div>

        {/* ── Desktop submit ── */}
        <div className="fb-submit fb-submit-desktop">
          {missingRequired.length > 0 && (
            <div className="fb-submit-warn">
              <AlertTriangle className="h-4 w-4" />
              <span>{missingRequired.length} zorunlu soru cevaplanmayı bekliyor</span>
            </div>
          )}
          <div className="fb-submit-actions">
            {!isMandatory && (
              <button
                type="button"
                onClick={() => router.push('/staff/my-trainings')}
                className="fb-btn fb-btn-ghost"
              >
                Daha Sonra
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || missingRequired.length > 0}
              className={`fb-btn fb-btn-primary ${isMandatory ? 'fb-btn-flex-1' : 'fb-btn-flex-2'}`}
            >
              {submitting ? (
                <>
                  <span className="fb-spin" />
                  <span>Gönderiliyor…</span>
                </>
              ) : (
                <>
                  <span>Geri Bildirimi Gönder</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky submit ── */}
      <div className="fb-submit-mobile">
        {missingRequired.length > 0 && (
          <div className="fb-submit-warn-mobile">
            <AlertTriangle className="h-3 w-3" />
            <span>{missingRequired.length} zorunlu soru eksik</span>
          </div>
        )}
        <div className="fb-submit-actions-mobile">
          {!isMandatory && (
            <button
              type="button"
              onClick={() => router.push('/staff/my-trainings')}
              className="fb-btn fb-btn-ghost"
            >
              Sonra
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || missingRequired.length > 0}
            className="fb-btn fb-btn-primary fb-btn-flex-1"
          >
            {submitting ? (
              <>
                <span className="fb-spin" />
                <span>Gönderiliyor</span>
              </>
            ) : (
              <>
                <span>Gönder</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .fb-root {
          min-height: 100vh;
          background: #faf7f2;
          position: relative;
        }

        /* ── Sticky header ── */
        .fb-sticky {
          position: sticky;
          top: 0;
          z-index: 30;
          background: rgba(247, 244, 234, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #e5e0d5;
        }
        .fb-sticky-inner {
          max-width: 760px;
          margin: 0 auto;
          padding: 14px 24px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .fb-sticky-title {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 13px;
          font-weight: 500;
          font-variation-settings: 'opsz' 22;
          color: #0a1628;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .fb-sticky-count {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #5b6478;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }
        .fb-sticky-count strong {
          color: #0a1628;
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-weight: 500;
        }
        .fb-progress {
          height: 2px;
          background: #e5e0d5;
          max-width: 760px;
          margin: 0 auto;
        }
        .fb-progress-fill {
          height: 100%;
          background: #0a7a47;
          transition: width 400ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* ── Body ── */
        .fb-body {
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 24px 140px;
        }

        /* ── Mandatory banner ── */
        .fb-mandatory {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 20px;
          background: #fdf5f2;
          border: 1px solid #e9c9c0;
          border-radius: 14px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .fb-mandatory::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #b3261e;
        }
        .fb-mandatory-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #b3261e;
          color: #faf7f2;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fb-mandatory h3 {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 14px;
          font-weight: 500;
          color: #7a1d14;
          margin: 0 0 2px;
        }
        .fb-mandatory p { font-size: 12px; color: #7a1d14; opacity: 0.8; margin: 0; }

        /* ── Hero ── */
        .fb-hero {
          text-align: center;
          padding: 24px 0 32px;
          border-bottom: 1px dashed #e5e0d5;
          margin-bottom: 28px;
        }
        .fb-eyebrow {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 999px;
          background: #faf7f2;
          border: 1px solid #e5e0d5;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5b6478;
          margin-bottom: 18px;
        }
        .fb-title {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: clamp(28px, 4.5vw, 44px);
          font-weight: 500;
          font-variation-settings: 'opsz' 72, 'SOFT' 50;
          color: #0a1628;
          letter-spacing: -0.025em;
          line-height: 1.05;
          margin: 0 0 12px;
        }
        .fb-subtitle {
          font-size: 14px;
          color: #5b6478;
          line-height: 1.55;
          max-width: 520px;
          margin: 0 auto 16px;
        }
        .fb-quote {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 13px;
          color: #5b6478;
          margin: 0;
        }
        .fb-quote em { font-style: italic; }

        /* ── Categories ── */
        .fb-categories { display: flex; flex-direction: column; gap: 18px; }

        .fb-category {
          background: #ffffff;
          border: 1px solid #e5e0d5;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 2px rgba(10, 10, 10, 0.02);
        }
        .fb-category-head {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 22px 24px;
          background: #faf7f2;
          border-bottom: 1px solid #e5e0d5;
        }
        .fb-category-num {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 40px;
          font-weight: 500;
          font-variation-settings: 'opsz' 72, 'SOFT' 50;
          color: transparent;
          -webkit-text-stroke: 1.5px #0a7a47;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .fb-category-eyebrow {
          display: block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #0a7a47;
          margin-bottom: 2px;
        }
        .fb-category-head h2 {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 18px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: #0a1628;
          margin: 0;
          letter-spacing: -0.01em;
        }

        /* ── Items ── */
        .fb-items { display: flex; flex-direction: column; }
        .fb-item {
          padding: 22px 24px;
          border-top: 1px dashed #e5e0d5;
          transition: background 300ms ease;
        }
        .fb-item:first-child { border-top: none; }
        .fb-item-answered { background: linear-gradient(90deg, #f7fcf8 0%, #ffffff 80%); }

        .fb-item-head {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .fb-item-num {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: #faf7f2;
          border: 1px solid #e5e0d5;
          color: #5b6478;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          margin-top: 2px;
          transition: background 220ms ease, color 220ms ease, border-color 220ms ease;
        }
        .fb-item-num-ok {
          background: #0a7a47;
          border-color: #0a7a47;
          color: #faf7f2;
        }
        .fb-item-label {
          flex: 1;
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 28;
          color: #0a1628;
          line-height: 1.5;
          letter-spacing: -0.005em;
        }
        .fb-req {
          display: inline-flex;
          align-items: center;
          margin-left: 8px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #fdf5f2;
          color: #b3261e;
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          vertical-align: middle;
        }

        /* ── Likert ── */
        .fb-likert { padding-left: 38px; }
        .fb-likert-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }
        .fb-likert-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 76px;
          padding: 10px 6px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e5e0d5;
          cursor: pointer;
          transition: background 180ms ease, border-color 180ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
        }
        .fb-likert-cell:hover { border-color: #d9d4c4; background: #faf7f2; }
        .fb-likert-cell-on {
          background: #0a7a47;
          border-color: #0a7a47;
          transform: translateY(-1px);
        }
        .fb-likert-value {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 24px;
          font-weight: 500;
          font-variation-settings: 'opsz' 42, 'SOFT' 50;
          color: #0a1628;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }
        .fb-likert-cell-on .fb-likert-value { color: #faf7f2; }
        .fb-likert-label {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #5b6478;
          text-align: center;
        }
        .fb-likert-cell-on .fb-likert-label { color: rgba(250, 250, 247, 0.85); }

        /* ── Y/P/N ── */
        .fb-ypn {
          padding-left: 38px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .fb-ypn-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          padding: 0 12px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e5e0d5;
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 15px;
          font-weight: 500;
          color: #0a1628;
          cursor: pointer;
          transition: background 180ms ease, border-color 180ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fb-ypn-cell:hover { border-color: #d9d4c4; background: #faf7f2; }
        .fb-ypn-cell-on {
          background: #0a7a47;
          border-color: #0a7a47;
          color: #faf7f2;
          transform: translateY(-1px);
        }

        /* ── Text ── */
        .fb-text-wrap {
          padding-left: 38px;
          position: relative;
        }
        .fb-textarea {
          width: 100%;
          padding: 14px 16px 30px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e5e0d5;
          color: #0a1628;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.55;
          outline: none;
          resize: vertical;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .fb-textarea:focus {
          border-color: #0a7a47;
          box-shadow: 0 0 0 3px rgba(10, 122, 71, 0.1);
        }
        .fb-text-count {
          position: absolute;
          bottom: 10px;
          right: 14px;
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          color: #5b6478;
          font-variant-numeric: tabular-nums;
          pointer-events: none;
        }

        /* ── Identity ── */
        .fb-identity {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px 22px;
          background: #ffffff;
          border: 1px solid #e5e0d5;
          border-radius: 18px;
          margin-top: 24px;
        }
        .fb-identity-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #faf7f2;
          color: #5b6478;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 200ms ease, color 200ms ease;
        }
        .fb-identity-icon-on {
          background: #eaf6ef;
          color: #0a7a47;
        }
        .fb-identity-body { flex: 1; min-width: 0; }
        .fb-identity-body h3 {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 14px;
          font-weight: 500;
          color: #0a1628;
          margin: 0 0 3px;
        }
        .fb-identity-body p {
          font-size: 12px;
          color: #5b6478;
          line-height: 1.5;
          margin: 0;
        }

        .fb-switch {
          flex-shrink: 0;
          width: 44px;
          height: 26px;
          border-radius: 999px;
          background: #d9d4c4;
          border: none;
          cursor: pointer;
          padding: 0;
          position: relative;
          transition: background 220ms cubic-bezier(0.16, 1, 0.3, 1);
          margin-top: 6px;
        }
        .fb-switch-on { background: #0a7a47; }
        .fb-switch-dot {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(10, 10, 10, 0.15);
          transition: left 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fb-switch-on .fb-switch-dot { left: 21px; }

        /* ── KVKK ── */
        .fb-kvkk {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 20px 2px 0;
          color: #5b6478;
        }
        .fb-kvkk :global(svg) { flex-shrink: 0; margin-top: 2px; }
        .fb-kvkk p {
          font-size: 11px;
          line-height: 1.55;
          margin: 0;
        }

        /* ── Submit desktop ── */
        .fb-submit-desktop { display: block; margin-top: 28px; }
        @media (max-width: 640px) {
          .fb-submit-desktop { display: none; }
        }
        .fb-submit-warn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 12px;
          background: #fef6e7;
          border: 1px solid #e9c977;
          color: #6a4e11;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 14px;
        }
        .fb-submit-actions { display: flex; gap: 10px; }

        /* ── Submit mobile ── */
        .fb-submit-mobile {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 40;
          padding: 12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px);
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          border-top: 1px solid #e5e0d5;
        }
        @media (max-width: 640px) {
          .fb-submit-mobile { display: block; }
        }
        .fb-submit-warn-mobile {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #6a4e11;
          margin-bottom: 8px;
          padding: 0 2px;
        }
        .fb-submit-actions-mobile {
          display: flex;
          gap: 8px;
        }

        .fb-btn {
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
          border: 1px solid transparent;
          cursor: pointer;
          transition: background 160ms ease, border-color 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fb-btn:active:not(:disabled) { transform: scale(0.97); }
        .fb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .fb-btn-ghost {
          background: transparent;
          color: #5b6478;
          border-color: #e5e0d5;
        }
        .fb-btn-ghost:hover { border-color: #0a1628; color: #0a1628; }
        .fb-btn-primary {
          background: #0a7a47;
          color: #faf7f2;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .fb-btn-primary:hover:not(:disabled) { background: #086338; }
        .fb-btn-flex-1 { flex: 1; }
        .fb-btn-flex-2 { flex: 2; }

        .fb-spin {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          animation: fb-rot 700ms linear infinite;
        }
        @keyframes fb-rot { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .fb-body { padding: 20px 16px 140px; }
          .fb-hero { padding: 18px 0 24px; margin-bottom: 20px; }
          .fb-category-head { padding: 18px 20px; gap: 14px; }
          .fb-category-num { font-size: 34px; }
          .fb-item { padding: 18px 20px; }
          .fb-likert, .fb-ypn, .fb-text-wrap { padding-left: 0; }
          .fb-likert-grid { gap: 6px; }
          .fb-likert-cell { min-height: 64px; padding: 8px 4px; }
          .fb-likert-value { font-size: 20px; }
          .fb-identity { padding: 16px 18px; gap: 12px; }
        }
      `}</style>
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
