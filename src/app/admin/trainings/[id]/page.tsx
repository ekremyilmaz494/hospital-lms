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
import { useToast } from '@/components/shared/toast';

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
  assignedStaff: { assignmentId: string; userId: string; name: string; department: string; attempt: number; preScore: number | null; postScore: number | null; status: string; completedAt: string }[];
  videos: { id: string; title: string; videoUrl: string; duration: string; order: number }[];
  questions: { id: string; text: string; points: number; options: { id: string; text: string; isCorrect: boolean; order: number }[] }[];
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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('staff');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
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
          <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={() => router.push(`/admin/trainings/${id}/edit`)}>
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
          {activeTab !== 'videos' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={() => {
                try {
                  const exportData = activeTab === 'staff'
                    ? { headers: ['Ad Soyad', 'Departman', 'Durum', 'Ön Sınav', 'Son Sınav', 'Deneme'], rows: assignedStaff.map(s => [s.name, s.department, statusMap[s.status]?.label ?? s.status, s.preScore ?? '-', s.postScore ?? '-', s.attempt]) }
                    : { headers: ['#', 'Soru', 'Puan'], rows: trainingQuestions.map((q, i) => [i + 1, q.text, q.points]) };
                  exportExcel(exportData);
                } catch (e) { toast((e as Error).message, 'error'); }
              }}>
                <Download className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={() => {
                try {
                  const exportData = activeTab === 'staff'
                    ? { headers: ['Ad Soyad', 'Departman', 'Durum', 'Ön Sınav', 'Son Sınav', 'Deneme'], rows: assignedStaff.map(s => [s.name, s.department, statusMap[s.status]?.label ?? s.status, s.preScore ?? '-', s.postScore ?? '-', s.attempt]) }
                    : { headers: ['#', 'Soru', 'Puan'], rows: trainingQuestions.map((q, i) => [i + 1, q.text, q.points]) };
                  exportPDF(exportData, training.title);
                } catch (e) { toast((e as Error).message, 'error'); }
              }}>
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          )}
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
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold rounded-lg" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/admin/trainings/${id}/assignments`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: s.userId }),
                                    });
                                    if (res.ok) refetch();
                                  } catch {}
                                }}
                              >
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
                  <div className="space-y-2">
                    {trainingVideos.map((v, vi) => {
                      const videoKey = v.id ?? `video-${vi}`;
                      const isActive = activeVideoId === videoKey;
                      return (
                        <div key={videoKey} className="rounded-2xl overflow-hidden" style={{ background: isActive ? '#0a0a0a' : 'var(--color-bg)', border: isActive ? '1px solid rgba(13,150,104,0.3)' : '1px solid transparent', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isActive ? '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(13,150,104,0.08)' : 'none' }}>
                          {/* Video Row */}
                          <div
                            className="flex items-center gap-4 px-5 py-4 cursor-pointer group relative"
                            style={{ background: isActive ? 'linear-gradient(135deg, rgba(13,150,104,0.08) 0%, rgba(13,150,104,0.02) 100%)' : 'transparent' }}
                            onClick={() => setActiveVideoId(isActive ? null : videoKey)}
                          >
                            {/* Order Number */}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ background: isActive ? 'var(--color-primary)' : 'var(--color-primary-light)', color: isActive ? 'white' : 'var(--color-primary)', transition: 'all 0.3s' }}>
                              {vi + 1}
                            </div>

                            {/* Play Icon */}
                            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: isActive ? 'rgba(255,255,255,0.1)' : 'var(--color-surface)', transition: 'all 0.3s' }}>
                              {isActive ? (
                                <Video className="h-5 w-5 text-white/90" />
                              ) : (
                                <Play className="h-4 w-4" style={{ color: 'var(--color-primary)', marginLeft: 2 }} />
                              )}
                            </div>

                            {/* Title & Meta */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: isActive ? 'white' : 'var(--color-text-primary)', transition: 'color 0.3s' }}>{v.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Clock className="h-3 w-3" style={{ color: isActive ? 'rgba(255,255,255,0.4)' : 'var(--color-text-muted)' }} />
                                <span className="text-[11px] font-medium" style={{ fontFamily: 'var(--font-mono)', color: isActive ? 'rgba(255,255,255,0.5)' : 'var(--color-text-muted)' }}>{v.duration}</span>
                              </div>
                            </div>

                            {/* Status Indicator */}
                            <div className="flex items-center gap-3 shrink-0">
                              {isActive && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                                  style={{ background: 'rgba(13,150,104,0.15)', border: '1px solid rgba(13,150,104,0.2)' }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span className="text-[10px] font-semibold tracking-wide uppercase text-emerald-400">Oynatılıyor</span>
                                </motion.span>
                              )}
                              <ChevronRight className="h-4 w-4" style={{ color: isActive ? 'rgba(255,255,255,0.3)' : 'var(--color-text-muted)', transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s, color 0.3s, opacity 0.3s', opacity: isActive ? 1 : 0 }} />
                            </div>
                          </div>

                          {/* Cinema Player */}
                          <AnimatePresence>
                            {isActive && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="relative">
                                  {/* Cinematic top fade */}
                                  <div className="absolute top-0 left-0 right-0 h-6 z-10" style={{ background: 'linear-gradient(to bottom, #0a0a0a, transparent)' }} />
                                  <video
                                    key={videoKey}
                                    src={v.videoUrl}
                                    controls
                                    className="w-full"
                                    style={{ aspectRatio: '16/9', background: '#000', display: 'block' }}
                                  />
                                  {/* Cinematic bottom fade */}
                                  <div className="absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none" style={{ background: 'linear-gradient(to top, #0a0a0a, transparent)' }} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-bg)' }}>
                      <Video className="h-6 w-6" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Henüz video eklenmemiş</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Questions Tab */}
            {activeTab === 'questions' && (
              <motion.div key="questions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {trainingQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {trainingQuestions.map((q, i) => (
                      <div key={q.id ?? `q-${i}`} className="rounded-xl p-5" style={{ background: 'var(--color-bg)' }}>
                        <div className="flex items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{i + 1}</div>
                          <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{q.text}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Award className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                            <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{q.points} puan</span>
                          </div>
                        </div>
                        {q.options.length > 0 ? (
                          <div className="mt-3 ml-13 space-y-2">
                            {q.options.map((o, oi) => (
                              <div
                                key={o.id}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                                style={{
                                  background: o.isCorrect ? 'var(--color-success-bg)' : 'var(--color-surface)',
                                  border: o.isCorrect ? '1px solid var(--color-success)' : '1px solid transparent',
                                }}
                              >
                                <span
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                                  style={{
                                    background: o.isCorrect ? 'var(--color-success)' : 'var(--color-border)',
                                    color: o.isCorrect ? 'white' : 'var(--color-text-muted)',
                                  }}
                                >
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span className="flex-1 text-sm" style={{ color: o.isCorrect ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: o.isCorrect ? 600 : 400 }}>
                                  {o.text}
                                </span>
                                {o.isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--color-success)' }} />}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 ml-13 text-xs" style={{ color: 'var(--color-text-muted)' }}>Seçenek eklenmemiş</p>
                        )}
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
