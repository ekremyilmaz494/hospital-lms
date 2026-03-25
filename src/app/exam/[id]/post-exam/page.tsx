'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const examData = {
  trainingTitle: 'İş Güvenliği Temel Eğitim',
  examType: 'Son Sınav',
  questions: [
    { id: 1, text: 'İSG mevzuatına göre risk değerlendirmesi hangi sıklıkta yenilenmelidir?', options: [
      { id: 'a', text: 'Her yıl' }, { id: 'b', text: 'Her 2 yılda bir' }, { id: 'c', text: 'Tehlike oluştuğunda ve en geç 6 yılda bir' }, { id: 'd', text: 'Sadece kaza sonrası' },
    ]},
    { id: 2, text: 'Yangın sınıflarından "B sınıfı yangın" neyi ifade eder?', options: [
      { id: 'a', text: 'Katı madde yangınları' }, { id: 'b', text: 'Sıvı madde yangınları' }, { id: 'c', text: 'Gaz yangınları' }, { id: 'd', text: 'Metal yangınları' },
    ]},
    { id: 3, text: 'İş kazasının SGK\'ya bildirilme süresi nedir?', options: [
      { id: 'a', text: '1 gün' }, { id: 'b', text: '3 iş günü' }, { id: 'c', text: '1 hafta' }, { id: 'd', text: '1 ay' },
    ]},
    { id: 4, text: 'Gürültü seviyesi kaç dB üzerinde işitme kaybı riski oluşturur?', options: [
      { id: 'a', text: '60 dB' }, { id: 'b', text: '75 dB' }, { id: 'c', text: '85 dB' }, { id: 'd', text: '100 dB' },
    ]},
    { id: 5, text: 'Kimyasal madde etiketindeki GHS sembollerinin amacı nedir?', options: [
      { id: 'a', text: 'Marka tanıtımı' }, { id: 'b', text: 'Tehlike sınıfını ve türünü görsel olarak bildirmek' }, { id: 'c', text: 'Fiyat bilgisi' }, { id: 'd', text: 'Üretim tarihi' },
    ]},
  ],
};

export default function PostExamPage() {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft] = useState(1800);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((currentQ + 1) / examData.questions.length) * 100;
  const q = examData.questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="sticky top-0 z-50 border-b px-6 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{examData.trainingTitle}</h3>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{examData.examType}</span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Soru {currentQ + 1}/{examData.questions.length}</span>
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
              <span className="mr-2 text-sm font-bold" style={{ color: 'var(--color-accent)' }}>S{q.id}.</span>{q.text}
            </p>
            <div className="space-y-3">
              {q.options.map((opt) => {
                const isSelected = answers[q.id] === opt.id;
                return (
                  <button key={opt.id} onClick={() => setAnswers({ ...answers, [q.id]: opt.id })} className="flex w-full items-center gap-3 rounded-lg border p-4 text-left" style={{ borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)', background: isSelected ? 'var(--color-accent-light)' : 'var(--color-surface)', transition: 'border-color var(--transition-fast), background var(--transition-fast)' }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: isSelected ? 'var(--color-accent)' : 'var(--color-border)', color: isSelected ? 'white' : 'var(--color-text-muted)' }}>{opt.id.toUpperCase()}</div>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)', fontWeight: isSelected ? 600 : 400 }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><ChevronLeft className="h-4 w-4" /> Önceki</Button>
              {currentQ < examData.questions.length - 1 ? (
                <Button onClick={() => setCurrentQ(currentQ + 1)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)', transition: 'background var(--transition-fast)' }}>Sonraki <ChevronRight className="h-4 w-4" /></Button>
              ) : (
                <Button onClick={() => router.push('/staff/my-trainings')} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-success)', transition: 'background var(--transition-fast)' }}><AlertTriangle className="h-4 w-4" /> Sınavı Bitir ({answeredCount}/{examData.questions.length})</Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Soru Navigasyonu</h4>
            <div className="grid grid-cols-5 gap-2">
              {examData.questions.map((_, i) => {
                const isAnswered = answers[examData.questions[i].id] !== undefined;
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
