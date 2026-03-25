'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, GraduationCap, Users, TrendingUp, Clock, Edit, Play, BarChart3,
  FileText, RotateCcw, Download, Eye, Video, CheckCircle2, XCircle, Timer,
  ChevronRight, Award
} from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';
import { Button } from '@/components/ui/button';
import { exportExcel, exportPDF } from '@/lib/export';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { motion, AnimatePresence } from 'framer-motion';
import { useFetch } from '@/hooks/use-fetch';
import { AssignStaffModal } from './assign-staff-modal';

interface TrainingDetail {
  title: string;
  category: string;
  description: string;
  passingScore: number;
  maxAttempts: number;
  examDuration: number;
  startDate: string;
  endDate: string;
  videoCount: number;
  questionCount: number;
  assignedCount: number;
  completedCount: number;
  passedCount: number;
  failedCount: number;
  avgScore: number;
  status: string;
  assignedStaff: { name: string; department: string; attempt: number; preScore: number | null; postScore: number | null; status: string; completedAt: string }[];
  videos: { title: string; duration: string; order: number }[];
  questions: { text: string; points: number }[];
}

const statusMap: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  passed: { label: 'Başarılı', bg: 'var(--color-success-bg)', text: 'var(--color-success)', icon: CheckCircle2 },
  failed: { label: 'Başarısız', bg: 'var(--color-error-bg)', text: 'var(--color-error)', icon: XCircle },
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', icon: Timer },
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)', icon: Users },
};

export default function TrainingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: training, isLoading, error, refetch } = useFetch<TrainingDetail>(id ? `/api/admin/trainings/${id}` : null);
  const [activeTab, setActiveTab] = useState('staff');
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  if (!id) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Eğitim bulunamadı</div></div>;
  }

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!training) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Eğitim bulunamadı</div></div>;
  }

  const assignedStaff = training.assignedStaff ?? [];
  const trainingVideos = training.videos ?? [];
  const trainingQuestions = training.questions ?? [];

  const tabs = [
    { id: 'staff', label: 'Personel Durumu', count: assignedStaff.length },
    { id: 'videos', label: 'Videolar', count: training.videoCount ?? 0 },
    { id: 'questions', label: 'Sorular', count: training.questionCount ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', transition: 'border-color var(--transition-fast)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {training.title}
              </h2>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                {training.status ?? 'Aktif'}
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {training.category} • Baraj: {training.passingScore}% • {training.maxAttempts} deneme hakkı • {training.examDuration} dk sınav
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <Edit className="h-4 w-4" /> Düzenle
          </Button>
          <Button onClick={() => setAssignModalOpen(true)} className="gap-2 rounded-xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), #0f4a35)', boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)' }}>
            <Users className="h-4 w-4" /> Personel Ata
          </Button>
        </div>
      </div>

      <AssignStaffModal
        trainingId={id as string}
        maxAttemptsAllowed={training.maxAttempts}
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        onSuccess={() => {
          refetch(); // refresh data
        }}
      />

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {training.description}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Atanan" value={training.assignedCount ?? 0} icon={Users} accentColor="var(--color-info)" />
        <StatCard title="Tamamlayan" value={training.completedCount ?? 0} icon={TrendingUp} accentColor="var(--color-primary)" />
        <StatCard title="Başarılı" value={training.passedCount ?? 0} icon={GraduationCap} accentColor="var(--color-success)" />
        <StatCard title="Başarısız" value={training.failedCount ?? 0} icon={GraduationCap} accentColor="var(--color-error)" />
        <StatCard title="Ort. Puan" value={training.avgScore ?? 0} icon={BarChart3} accentColor="var(--color-accent)" />
      </div>

      {/* Tabs Section */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        {/* Tab Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg)' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  background: activeTab === tab.id ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                  transition: 'background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast)',
                }}
              >
                {tab.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    background: activeTab === tab.id ? 'var(--color-primary-light)' : 'var(--color-surface-hover)',
                    color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={exportExcel}>
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={exportPDF}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Staff Tab */}
            {activeTab === 'staff' && (
              <motion.div key="staff" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {assignedStaff.length > 0 ? (
                  <div className="space-y-2">
                    {assignedStaff.map((s) => {
                      const st = statusMap[s.status] || statusMap.assigned;
                      const StatusIcon = st.icon;
                      return (
                        <div key={s.name} className="flex items-center gap-4 rounded-xl px-4 py-3.5 group" style={{ background: 'var(--color-bg)', border: '1px solid transparent', transition: 'border-color var(--transition-fast)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                        >
                          <div className="flex items-center gap-3 min-w-45">
                            <Avatar className="h-9 w-9"><AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>{s.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{s.name}</p>
                              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.department}</p>
                            </div>
                          </div>
                          <div className="min-w-17.5 text-center">
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Deneme</p>
                            <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{s.attempt}/{training.maxAttempts}</p>
                          </div>
                          <div className="min-w-17.5 text-center">
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ön Sınav</p>
                            <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)', color: s.preScore !== null ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>{s.preScore !== null ? `${s.preScore}%` : '—'}</p>
                          </div>
                          <div className="min-w-17.5 text-center">
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Son Sınav</p>
                            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: s.postScore !== null && s.postScore >= training.passingScore ? 'var(--color-success)' : s.postScore !== null ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{s.postScore !== null ? `${s.postScore}%` : '—'}</p>
                          </div>
                          <div className="min-w-30">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: st.bg, color: st.text }}>
                              <StatusIcon className="h-3 w-3" />{st.label}
                            </span>
                          </div>
                          <div className="min-w-22.5 text-center">
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Tarih</p>
                            <p className="text-xs font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{s.completedAt}</p>
                          </div>
                          <div className="ml-auto">
                            {s.status === 'failed' && (
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold rounded-lg" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                                <RotateCcw className="h-3.5 w-3.5" /> Yeni Hak Ver
                              </Button>
                            )}
                            {s.status === 'passed' && (
                              <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium opacity-0 group-hover:opacity-100" style={{ color: 'var(--color-text-muted)', transition: 'opacity var(--transition-fast)' }}>
                                <Eye className="h-3.5 w-3.5" /> Detay<ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
                )}
              </motion.div>
            )}

            {/* Videos Tab */}
            {activeTab === 'videos' && (
              <motion.div key="videos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {trainingVideos.length > 0 ? (
                  <div className="space-y-3">
                    {trainingVideos.map((v) => (
                      <div key={v.order} className="flex items-center gap-4 rounded-xl p-4 group cursor-pointer" style={{ background: 'var(--color-bg)', border: '1px solid transparent', transition: 'border-color var(--transition-fast)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                          <Play className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{v.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Video {v.order}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                            <span className="text-xs font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{v.duration}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100" style={{ color: 'var(--color-text-muted)', transition: 'opacity var(--transition-fast)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
                )}
              </motion.div>
            )}

            {/* Questions Tab */}
            {activeTab === 'questions' && (
              <motion.div key="questions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {trainingQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {trainingQuestions.map((q, i) => (
                      <div key={i} className="flex items-center gap-4 rounded-xl p-4" style={{ background: 'var(--color-bg)' }}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{i + 1}</div>
                        <div className="flex-1">
                          <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{q.text}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Award className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                          <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{q.points} puan</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
