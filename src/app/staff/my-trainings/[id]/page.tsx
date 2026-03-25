'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Video, FileQuestion, CheckCircle, Clock, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

const training = {
  id: '1', title: 'İş Güvenliği Temel Eğitim', category: 'İş Güvenliği',
  description: 'İş sağlığı ve güvenliği konusunda temel bilgileri kapsayan zorunlu eğitim programı.',
  passingScore: 70, maxAttempts: 3, examDuration: 30,
  status: 'in_progress', currentAttempt: 1, deadline: '26.03.2026',
  videos: [
    { title: 'İSG Temel Kavramlar', duration: '15:00', completed: true },
    { title: 'Risk Değerlendirme', duration: '20:00', completed: true },
    { title: 'Kişisel Koruyucu Donanım', duration: '12:00', completed: false },
    { title: 'Acil Durum Prosedürleri', duration: '18:00', completed: false },
  ],
  preExamScore: 65, preExamCompleted: true,
  videosCompleted: false, postExamCompleted: false,
};

const steps = [
  { id: 'pre_exam', label: 'Ön Sınav', icon: FileQuestion, completed: training.preExamCompleted, active: false, score: training.preExamScore },
  { id: 'videos', label: 'Eğitim Videoları', icon: Video, completed: training.videosCompleted, active: true, progress: `${training.videos.filter(v => v.completed).length}/${training.videos.length}` },
  { id: 'post_exam', label: 'Son Sınav', icon: FileQuestion, completed: training.postExamCompleted, active: false },
];

export default function TrainingDetailPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{training.title}</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{training.category} • Deneme {training.currentAttempt}/{training.maxAttempts} • Son tarih: {training.deadline}</p>
        </div>
      </div>

      <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{training.description}</p>

      {/* Step Progress */}
      <div className="grid grid-cols-3 gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="rounded-xl border p-5 text-center" style={{ background: step.active ? 'var(--color-primary-light)' : 'var(--color-surface)', borderColor: step.active ? 'var(--color-primary)' : step.completed ? 'var(--color-success)' : 'var(--color-border)', borderWidth: step.active ? '2px' : '1px', boxShadow: 'var(--shadow-sm)' }}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: step.completed ? 'var(--color-success)' : step.active ? 'var(--color-primary)' : 'var(--color-border)' }}>
                {step.completed ? <CheckCircle className="h-6 w-6 text-white" /> : <Icon className="h-6 w-6" style={{ color: step.active ? 'white' : 'var(--color-text-muted)' }} />}
              </div>
              <h4 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{step.label}</h4>
              {step.score !== undefined && <p className="mt-1 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>Puan: {step.score}%</p>}
              {step.progress && <p className="mt-1 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{step.progress} video izlendi</p>}
              {!step.completed && !step.active && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Bekliyor</p>}
            </div>
          );
        })}
      </div>

      {/* Video List */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 className="mb-4 text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Eğitim Videoları</h3>
        <div className="space-y-3">
          {training.videos.map((v, i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', background: v.completed ? 'var(--color-success-bg)' : i === training.videos.filter(x => x.completed).length ? 'var(--color-primary-light)' : 'transparent' }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: v.completed ? 'var(--color-success)' : 'var(--color-border)' }}>
                {v.completed ? <CheckCircle className="h-5 w-5 text-white" /> : <Play className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{v.title}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Video {i + 1}</p>
              </div>
              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{v.duration}</span></div>
              {!v.completed && i === training.videos.filter(x => x.completed).length && (
                <Link href={`/exam/${training.id}/videos`}><Button size="sm" className="gap-1 text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}><Play className="h-3 w-3" /> İzle</Button></Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <Link href={training.videosCompleted ? `/exam/${training.id}/post-exam` : `/exam/${training.id}/videos`}>
          <Button className="gap-2 px-8 py-3 text-base font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)' }}>
            <Play className="h-5 w-5" /> {training.videosCompleted ? 'Son Sınava Geç' : 'Videoları İzlemeye Devam Et'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
