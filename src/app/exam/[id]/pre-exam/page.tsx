'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const examData = {
  trainingTitle: 'İş Güvenliği Temel Eğitim',
  examType: 'Ön Sınav',
  totalTime: 1800, // 30 minutes in seconds
  questions: [
    { id: 1, text: 'İş güvenliği mevzuatına göre, işverenin temel yükümlülüğü nedir?', options: [
      { id: 'a', text: 'Sadece kazaları raporlamak' },
      { id: 'b', text: 'Çalışanların sağlık ve güvenliğini sağlamak için gerekli her türlü önlemi almak' },
      { id: 'c', text: 'Yılda bir kez denetim yapmak' },
      { id: 'd', text: 'Sadece tehlikeli işlerde koruyucu ekipman sağlamak' },
    ]},
    { id: 2, text: 'Kişisel Koruyucu Donanım (KKD) kullanımı ile ilgili hangisi doğrudur?', options: [
      { id: 'a', text: 'KKD sadece tehlikeli işlerde kullanılır' },
      { id: 'b', text: 'KKD son savunma hattıdır, önce toplu koruma önlemleri alınmalıdır' },
      { id: 'c', text: 'KKD masrafı çalışana aittir' },
      { id: 'd', text: 'KKD kullanımı isteğe bağlıdır' },
    ]},
    { id: 3, text: 'Yangın söndürücülerin kontrol periyodu ne kadardır?', options: [
      { id: 'a', text: 'Her ay' },
      { id: 'b', text: 'Her 3 ayda bir' },
      { id: 'c', text: 'Her 6 ayda bir' },
      { id: 'd', text: 'Yılda bir' },
    ]},
    { id: 4, text: 'Risk değerlendirmesi yapılırken ilk adım nedir?', options: [
      { id: 'a', text: 'Kontrol tedbirlerini belirlemek' },
      { id: 'b', text: 'Tehlikeleri belirlemek' },
      { id: 'c', text: 'Rapor yazmak' },
      { id: 'd', text: 'Eğitim vermek' },
    ]},
    { id: 5, text: 'Acil durum planında bulunması gereken en önemli bilgi nedir?', options: [
      { id: 'a', text: 'Şirket logosu' },
      { id: 'b', text: 'Tahliye yolları ve toplanma noktaları' },
      { id: 'c', text: 'Yemekhane menüsü' },
      { id: 'd', text: 'Çalışan maaş bilgileri' },
    ]},
    { id: 6, text: 'İş kazası tanımına hangisi girer?', options: [
      { id: 'a', text: 'Sadece iş yerinde meydana gelen kazalar' },
      { id: 'b', text: 'İş yerinde ve işe gidiş-gelişte meydana gelen kazalar' },
      { id: 'c', text: 'Sadece ağır yaralanmalar' },
      { id: 'd', text: 'Sadece ölümlü kazalar' },
    ]},
    { id: 7, text: 'Ergonomik risk faktörü hangisidir?', options: [
      { id: 'a', text: 'Gürültü' },
      { id: 'b', text: 'Tekrarlayan hareketler ve uygun olmayan çalışma pozisyonu' },
      { id: 'c', text: 'Kimyasal maruz kalma' },
      { id: 'd', text: 'Elektrik tehlikesi' },
    ]},
    { id: 8, text: 'İş güvenliği eğitimi ne zaman verilmelidir?', options: [
      { id: 'a', text: 'Sadece işe başlarken' },
      { id: 'b', text: 'İşe başlarken, iş değişikliğinde ve periyodik olarak' },
      { id: 'c', text: 'Sadece kaza sonrası' },
      { id: 'd', text: 'Yılda bir' },
    ]},
    { id: 9, text: 'Malzeme Güvenlik Bilgi Formu (MSDS) ne için kullanılır?', options: [
      { id: 'a', text: 'Personel devamsızlık takibi' },
      { id: 'b', text: 'Kimyasal maddelerin özelliklerini ve güvenli kullanım bilgilerini içerir' },
      { id: 'c', text: 'Makine bakım programı' },
      { id: 'd', text: 'Vardiya çizelgesi' },
    ]},
    { id: 10, text: 'İşyerinde psikolojik risk faktörü hangisidir?', options: [
      { id: 'a', text: 'Aşırı iş yükü ve zaman baskısı' },
      { id: 'b', text: 'Havalandırma sistemi' },
      { id: 'c', text: 'Aydınlatma seviyesi' },
      { id: 'd', text: 'Zemin kaplaması' },
    ]},
  ],
};

export default function PreExamPage() {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(examData.totalTime);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((currentQ + 1) / examData.questions.length) * 100;
  const q = examData.questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Exam Header */}
      <div className="sticky top-0 z-50 border-b px-6 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{examData.trainingTitle}</h3>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>{examData.examType}</span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Soru {currentQ + 1}/{examData.questions.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: timeLeft < 300 ? 'var(--color-error-bg)' : 'var(--color-surface-hover)' }}>
              <Clock className="h-4 w-4" style={{ color: timeLeft < 300 ? 'var(--color-error)' : 'var(--color-text-muted)' }} />
              <span className="text-base font-bold" style={{ fontFamily: 'var(--font-mono)', color: timeLeft < 300 ? 'var(--color-error)' : 'var(--color-text-primary)' }}>
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
              <span className="mr-2 text-sm font-bold" style={{ color: 'var(--color-primary)' }}>S{q.id}.</span>
              {q.text}
            </p>

            <div className="space-y-3">
              {q.options.map((opt) => {
                const isSelected = answers[q.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setAnswers({ ...answers, [q.id]: opt.id })}
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
              {currentQ < examData.questions.length - 1 ? (
                <Button onClick={() => setCurrentQ(currentQ + 1)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
                  Sonraki <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => router.push(`/exam/1/videos`)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)', transition: 'background var(--transition-fast)' }}>
                  <AlertTriangle className="h-4 w-4" /> Sınavı Bitir ({answeredCount}/{examData.questions.length})
                </Button>
              )}
            </div>
          </div>

          {/* Question Navigator */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Soru Navigasyonu</h4>
            <div className="grid grid-cols-5 gap-2">
              {examData.questions.map((_, i) => {
                const isAnswered = answers[examData.questions[i].id] !== undefined;
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
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)' }} /><span style={{ color: 'var(--color-text-muted)' }}>Cevaplanmamış ({examData.questions.length - answeredCount})</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
