'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface EvalItem { id: string; text: string; description: string | null; order: number }
interface EvalCategory { id: string; name: string; weight: number; order: number; items: EvalItem[] }
interface EvalForm { id: string; title: string; categories: EvalCategory[] }
interface EvalSubject { firstName: string; lastName: string; title: string | null; departmentRel: { name: string } | null }
interface Evaluation {
  id: string; status: string; evaluatorType: string;
  form: EvalForm;
  subject: EvalSubject;
  answers: { itemId: string; score: number; comment: string | null }[];
}
interface EvalData { evaluation: Evaluation; totalItems: number; answeredItems: number; progress: number }

const EVALUATOR_LABELS: Record<string, string> = {
  SELF: 'Öz Değerlendirme', MANAGER: 'Yönetici', PEER: 'Akran', SUBORDINATE: 'Ast',
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${n} yıldız`}
          className="flex h-11 w-11 items-center justify-center transition-transform hover:scale-110 sm:h-10 sm:w-10"
        >
          <Star
            className="h-7 w-7 sm:h-8 sm:w-8"
            fill={(hovered || value) >= n ? 'var(--color-warning)' : 'none'}
            style={{ color: (hovered || value) >= n ? 'var(--color-warning)' : 'var(--color-border)' }}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {['', 'Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Mükemmel'][value]}
        </span>
      )}
    </div>
  );
}

export default function EvaluationWizardPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const evalId = params.id as string;

  const { data, isLoading } = useFetch<EvalData>(`/api/staff/evaluations/${evalId}`);

  const [currentCatIdx, setCurrentCatIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { score: number; comment: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Mevcut cevapları başlangıç state'e yükle
  useEffect(() => {
    if (data?.evaluation.answers) {
      const initial: Record<string, { score: number; comment: string }> = {};
      for (const a of data.evaluation.answers) {
        initial[a.itemId] = { score: a.score, comment: a.comment ?? '' };
      }
      setAnswers(initial);
    }
    if (data?.evaluation.status === 'COMPLETED') setCompleted(true);
  }, [data]);

  if (isLoading && !data) return <PageLoading />;
  if (!data) return <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Değerlendirme bulunamadı.</div>;

  const { evaluation, totalItems } = data;
  const categories = evaluation.form.categories;
  const currentCat = categories[currentCatIdx];
  const isLastCat = currentCatIdx === categories.length - 1;

  // Tüm cevaplanan madde sayısı
  const answeredCount = Object.keys(answers).length;
  const progressPct = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0;

  // Mevcut kategorideki tüm maddeler cevaplandı mı?
  const currentCatComplete = currentCat.items.every(item => (answers[item.id]?.score ?? 0) > 0);

  const setItemScore = (itemId: string, score: number) =>
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], score, comment: prev[itemId]?.comment ?? '' } }));
  const setItemComment = (itemId: string, comment: string) =>
    setAnswers(prev => ({ ...prev, [itemId]: { ...prev[itemId], comment, score: prev[itemId]?.score ?? 0 } }));

  const handleNext = () => {
    if (!currentCatComplete) { toast('Bu kategorideki tüm maddeleri puanlayın.', 'error'); return; }
    setCurrentCatIdx(i => i + 1);
  };

  const handleSubmit = async () => {
    // Tüm maddeler cevaplandı mı?
    const allItems = categories.flatMap(c => c.items);
    for (const item of allItems) {
      if (!answers[item.id]?.score) { toast('Tüm maddeleri puanlamanız gerekiyor.', 'error'); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/staff/evaluations/${evalId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([itemId, a]) => ({
            itemId, score: a.score, comment: a.comment || undefined,
          })),
        }),
      });
      if (!res.ok) { const e = await res.json(); toast(e.error ?? 'Hata oluştu', 'error'); return; }
      setCompleted(true);
      toast('Değerlendirme başarıyla tamamlandı!', 'success');
    } finally { setSubmitting(false); }
  };

  if (completed) {
    return (
      <BlurFade delay={0}>
        <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'var(--color-success-bg)' }}>
            <CheckCircle className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
          </div>
          <h2 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>Değerlendirme Tamamlandı!</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {evaluation.subject.firstName} {evaluation.subject.lastName} için değerlendirmeniz kaydedildi.
          </p>
          <Button onClick={() => router.push('/staff/evaluations')} className="rounded-xl">
            Değerlendirmelerime Dön
          </Button>
        </div>
      </BlurFade>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 sm:px-0">
      <BlurFade delay={0}>
        {/* Header */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {EVALUATOR_LABELS[evaluation.evaluatorType] ?? evaluation.evaluatorType}
              </p>
              <h1 className="text-base font-black" style={{ color: 'var(--color-text)' }}>{evaluation.form.title}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Değerlendirilen: <strong>{evaluation.subject.firstName} {evaluation.subject.lastName}</strong>
                {evaluation.subject.departmentRel && ` · ${evaluation.subject.departmentRel.name}`}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>%{progressPct}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{answeredCount}/{totalItems} madde</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 rounded-full h-2 overflow-hidden" style={{ background: 'var(--color-border)' }}>
            <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'var(--color-primary)' }} />
          </div>

          {/* Category steps */}
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {categories.map((cat, i) => {
              const catComplete = cat.items.every(item => (answers[item.id]?.score ?? 0) > 0);
              return (
                <button
                  key={cat.id}
                  onClick={() => setCurrentCatIdx(i)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium transition-all"
                  style={{
                    background: i === currentCatIdx ? 'var(--color-primary)' : catComplete ? 'var(--color-success-bg)' : 'var(--color-surface-2)',
                    color: i === currentCatIdx ? 'white' : catComplete ? 'var(--color-success)' : 'var(--color-text-secondary)',
                  }}
                >
                  {catComplete && i !== currentCatIdx && <CheckCircle className="h-3 w-3" />}
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </BlurFade>

      {/* Current Category Items */}
      <BlurFade delay={0.05} key={currentCatIdx}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{currentCat.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Ağırlık: %{currentCat.weight} · {currentCat.items.length} madde
            </p>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {currentCat.items.map((item, itemIdx) => {
              const ans = answers[item.id];
              return (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                      style={{ background: ans?.score ? 'var(--color-success-bg)' : 'var(--color-surface-2)', color: ans?.score ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {itemIdx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{item.text}</p>
                      {item.description && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.description}</p>}
                    </div>
                  </div>

                  <div className="ml-9 space-y-2">
                    <StarRating value={ans?.score ?? 0} onChange={score => setItemScore(item.id, score)} />
                    <textarea
                      value={ans?.comment ?? ''}
                      onChange={e => setItemComment(item.id, e.target.value)}
                      placeholder="Opsiyonel yorum..."
                      rows={2}
                      className="w-full text-base sm:text-sm rounded-xl px-3 py-2 border resize-none outline-none"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </BlurFade>

      {/* Navigation */}
      <BlurFade delay={0.1}>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentCatIdx(i => i - 1)}
            disabled={currentCatIdx === 0}
            className="gap-1.5 rounded-xl"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Önceki</span>
          </Button>

          {!isLastCat ? (
            <Button onClick={handleNext} className="gap-1.5 rounded-xl">
              <span className="sm:hidden">Devam</span>
              <span className="hidden sm:inline">Kaydet ve Devam</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5 rounded-xl"
              style={{ background: 'var(--color-success)' }}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4" />
              <span className="sm:hidden">Tamamla</span>
              <span className="hidden sm:inline">Değerlendirmeyi Tamamla</span>
            </Button>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
