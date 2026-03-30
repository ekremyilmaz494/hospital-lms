'use client';

import { Clock, CheckCircle, ArrowRight, Award } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface PendingEval {
  id: string;
  evaluatorType: string;
  createdAt: string;
  form: { id: string; title: string; periodEnd: string };
  subject: { firstName: string; lastName: string; departmentRel: { name: string } | null };
}

interface SubjectEval {
  id: string;
  status: string;
  form: { id: string; title: string; periodEnd: string };
  _count: { answers: number };
}

interface EvalData {
  pending: PendingEval[];
  mySubjectEvals: SubjectEval[];
}

const EVALUATOR_LABELS: Record<string, string> = {
  SELF: 'Öz Değerlendirme', MANAGER: 'Yönetici', PEER: 'Akran', SUBORDINATE: 'Ast',
};

export default function StaffEvaluationsPage() {
  const { data, isLoading } = useFetch<EvalData>('/api/staff/evaluations');
  if (isLoading && !data) return <PageLoading />;

  const pending = data?.pending ?? [];
  const mySubjectEvals = data?.mySubjectEvals ?? [];

  return (
    <div className="space-y-6">
      <BlurFade delay={0}><PageHeader title="Değerlendirmeler" subtitle="360° yetkinlik değerlendirme görevleriniz ve sonuçlarınız" /></BlurFade>

      {/* Bekleyen Değerlendirmeler */}
      <BlurFade delay={0.05}>
        <div className="rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <Clock className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Bekleyen Değerlendirmelerim</h2>
            {pending.length > 0 && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>{pending.length}</span>
            )}
          </div>
          {pending.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Bekleyen değerlendirme yok.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {pending.map(ev => (
                <div key={ev.id} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {ev.subject.firstName} {ev.subject.lastName}
                      <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                        {EVALUATOR_LABELS[ev.evaluatorType] ?? ev.evaluatorType}
                      </span>
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {ev.form.title} · Son: {new Date(ev.form.periodEnd).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <Link href={`/staff/evaluations/${ev.id}`}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
                    style={{ background: 'var(--color-primary)', color: 'white' }}>
                    Başla <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </BlurFade>

      {/* Hakkımdaki Değerlendirmeler */}
      <BlurFade delay={0.1}>
        <div className="rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <Award className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Hakkımdaki Değerlendirmeler</h2>
          </div>
          {mySubjectEvals.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz hakkınızda bir değerlendirme başlatılmadı.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {mySubjectEvals.map(ev => (
                <div key={ev.id} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{ev.form.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      Son: {new Date(ev.form.periodEnd).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: ev.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {ev.status === 'COMPLETED' ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {ev.status === 'COMPLETED' ? 'Tamamlandı' : 'Devam Ediyor'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
