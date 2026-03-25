'use client';

import { useState, useEffect, useCallback } from 'react';
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
  totalTime: number;
  questions: Question[];
}

export default function PreExamPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: examData, isLoading, error } = useFetch<ExamData>(`/api/exam/${id}/questions`);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize timer when data loads
  useEffect(() => {
    if (examData?.totalTime && timeLeft === null) {
      setTimeLeft(examData.totalTime);
    }
  }, [examData, timeLeft]);

  // Start exam attempt
  const startExam = useCallback(async () => {
    if (started) return;
    try {
      await fetch(`/api/exam/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examType: 'pre' }),
      });
      setStarted(true);
    } catch {
      // Continue even if start fails
      setStarted(true);
    }
  }, [id, started]);

  useEffect(() => {
    if (examData && !started) {
      startExam();
    }
  }, [examData, started, startExam]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

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

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/exam/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examType: 'pre', answers }),
      });
    } catch {
      // Continue navigation even if submit fails
    } finally {
      setSubmitting(false);
      router.push(`/exam/${id}/videos`);
    }
  };

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: currentTimeLeft < 300 ? 'var(--color-error-bg)' : 'var(--color-surface-hover)' }}>
              <Clock className="h-4 w-4" style={{ color: currentTimeLeft < 300 ? 'var(--color-error)' : 'var(--color-text-muted)' }} />
              <span className="text-base font-bold" style={{ fontFamily: 'var(--font-mono)', color: currentTimeLeft < 300 ? 'var(--color-error)' : 'var(--color-text-primary)' }}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
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
                    onClick={() => setAnswers({ ...answers, [q?.id ?? 0]: opt.id })}
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
                <Button onClick={handleFinish} disabled={submitting} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)', transition: 'background var(--transition-fast)' }}>
                  <AlertTriangle className="h-4 w-4" /> {submitting ? 'Gönderiliyor...' : `Sınavı Bitir (${answeredCount}/${questions.length})`}
                </Button>
              )}
            </div>
          </div>

          {/* Question Navigator */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold">Soru Navigasyonu</h4>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const isAnswered = answers[questions[i]?.id ?? 0] !== undefined;
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
