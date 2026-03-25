'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: number;
  text: string;
  options: Option[];
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
  const { data: examData, isLoading, error } = useFetch<ExamData>(`/api/exam/${id}/questions`);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft] = useState(1800);
  const [submitting, setSubmitting] = useState(false);

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
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((currentQ + 1) / questions.length) * 100;
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/exam/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examType: 'post', answers }),
      });
    } catch {
      // Continue navigation even if submit fails
    } finally {
      setSubmitting(false);
      router.push('/staff/my-trainings');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="sticky top-0 z-50 border-b px-6 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold">{examData.trainingTitle ?? ''}</h3>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{examData.examType ?? 'Son Sınav'}</span>
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
                  <button key={opt.id} onClick={() => setAnswers({ ...answers, [q?.id ?? 0]: opt.id })} className="flex w-full items-center gap-3 rounded-lg border p-4 text-left" style={{ borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)', background: isSelected ? 'var(--color-accent-light)' : 'var(--color-surface)', transition: 'border-color var(--transition-fast), background var(--transition-fast)' }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: isSelected ? 'var(--color-accent)' : 'var(--color-border)', color: isSelected ? 'white' : 'var(--color-text-muted)' }}>{opt.id.toUpperCase()}</div>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontWeight: isSelected ? 600 : 400 }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><ChevronLeft className="h-4 w-4" /> Önceki</Button>
              {currentQ < questions.length - 1 ? (
                <Button onClick={() => setCurrentQ(currentQ + 1)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)', transition: 'background var(--transition-fast)' }}>Sonraki <ChevronRight className="h-4 w-4" /></Button>
              ) : (
                <Button onClick={handleFinish} disabled={submitting} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-success)', transition: 'background var(--transition-fast)' }}><AlertTriangle className="h-4 w-4" /> {submitting ? 'Gönderiliyor...' : `Sınavı Bitir (${answeredCount}/${questions.length})`}</Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold">Soru Navigasyonu</h4>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const isAnswered = answers[questions[i]?.id ?? 0] !== undefined;
                const isCurrent = i === currentQ;
                return (
                  <button key={i} onClick={() => setCurrentQ(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold" style={{ background: isCurrent ? 'var(--color-accent)' : isAnswered ? 'var(--color-success-bg)' : 'var(--color-surface-hover)', color: isCurrent ? 'white' : isAnswered ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1.5px solid ${isCurrent ? 'var(--color-accent)' : isAnswered ? 'var(--color-success)' : 'var(--color-border)'}`, transition: 'background var(--transition-fast), border-color var(--transition-fast)' }}>
                    {i + 1}
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
