'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, GraduationCap, Users, TrendingUp, Clock, Edit, Play, BarChart3,
  FileText, RotateCcw, Download, Eye, Video, CheckCircle2, XCircle, Timer,
  ChevronRight, Award, PenLine, FileDown, MessageSquare
} from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { motion, AnimatePresence } from 'framer-motion';
import { useFetch } from '@/hooks/use-fetch';
import { AssignStaffModal } from './assign-staff-modal';
import { useToast } from '@/components/shared/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

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
  signedCount: number;
  status: string;
  assignedStaff: { assignmentId: string; userId: string; name: string; department: string; attempt: number; progress: number; preScore: number | null; postScore: number | null; status: string; completedAt: string; signedAt: string | null; signatureMethod: string | null }[];
  videos: { id: string; title: string; videoUrl: string; duration: string; order: number; contentType: string }[];
  questions: { id: string; text: string; points: number; options: { id: string; text: string; isCorrect: boolean; order: number }[] }[];
}

const statusMap: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  passed: { label: 'Başarılı', bg: K.SUCCESS_BG, text: K.PRIMARY, icon: CheckCircle2 },
  failed: { label: 'Başarısız', bg: K.ERROR_BG, text: '#b91c1c', icon: XCircle },
  in_progress: { label: 'Devam Ediyor', bg: K.WARNING_BG, text: '#b45309', icon: Timer },
  assigned: { label: 'Atandı', bg: K.INFO_BG, text: '#1d4ed8', icon: Users },
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
  const [downloadingCompletion, setDownloadingCompletion] = useState<'pdf' | 'excel' | null>(null);
  const [downloadingTab, setDownloadingTab] = useState<'pdf' | 'excel' | null>(null);
  const [resetTarget, setResetTarget] = useState<{ userId: string; name: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  if (!id) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: K.TEXT_MUTED }}>Eğitim bulunamadı</div></div>;
  }

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: K.ERROR }}>{error}</div></div>;
  }

  if (!training) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: K.TEXT_MUTED }}>Eğitim bulunamadı</div></div>;
  }

  const assignedStaff = training.assignedStaff ?? [];
  const trainingVideos = training.videos ?? [];
  const trainingQuestions = training.questions ?? [];
  // PDF içerikler son sınava geçişi tetiklemez — atama ancak en az 1 video/ses varsa yapılabilir
  const hasPlayableContent = trainingVideos.some(v => v.contentType === 'video' || v.contentType === 'audio');

  const tabs = [
    { id: 'staff', label: 'Personel Durumu', count: assignedStaff.length },
    { id: 'videos', label: 'Videolar', count: training.videoCount ?? 0 },
    { id: 'questions', label: 'Sorular', count: training.questionCount ?? 0 },
  ];

  const ghostBtnStyle = { borderColor: K.BORDER, color: K.TEXT_SECONDARY, background: K.SURFACE };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}>
                {training.title}
              </h2>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: K.SUCCESS_BG, color: K.PRIMARY }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: K.SUCCESS }} />
                {training.status ?? 'Aktif'}
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: K.TEXT_MUTED }}>
              {training.category} • Baraj: {training.passingScore}% • {training.maxAttempts} deneme hakkı • {training.examDuration} dk sınav
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            style={ghostBtnStyle}
            disabled={downloadingCompletion === 'pdf'}
            onClick={async () => {
              setDownloadingCompletion('pdf');
              try {
                const res = await fetch(`/api/admin/trainings/${id}/completion-report`);
                if (!res.ok) throw new Error('Rapor oluşturulamadı');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'tamamlama_raporu.pdf';
                a.click();
                URL.revokeObjectURL(url);
              } catch { toast('PDF raporu indirilemedi', 'error'); }
              finally { setDownloadingCompletion(null); }
            }}
          >
            <FileDown className="h-4 w-4" /> {downloadingCompletion === 'pdf' ? 'Hazırlanıyor...' : 'PDF Rapor'}
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            style={ghostBtnStyle}
            disabled={downloadingCompletion === 'excel'}
            onClick={async () => {
              setDownloadingCompletion('excel');
              try {
                const res = await fetch(`/api/admin/trainings/${id}/completion-report/excel`);
                if (!res.ok) throw new Error('Rapor oluşturulamadı');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'tamamlama_raporu.xlsx';
                a.click();
                URL.revokeObjectURL(url);
              } catch { toast('Excel raporu indirilemedi', 'error'); }
              finally { setDownloadingCompletion(null); }
            }}
          >
            <Download className="h-4 w-4" /> {downloadingCompletion === 'excel' ? 'Hazırlanıyor...' : 'Excel Rapor'}
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" style={ghostBtnStyle} onClick={() => router.push(`/admin/feedback-forms/responses?trainingId=${id}`)}>
            <MessageSquare className="h-4 w-4" /> Geri Bildirimler
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" style={ghostBtnStyle} onClick={() => router.push(`/admin/trainings/${id}/edit`)}>
            <Edit className="h-4 w-4" /> Düzenle
          </Button>
          <Button
            onClick={() => setAssignModalOpen(true)}
            disabled={!hasPlayableContent}
            title={hasPlayableContent ? undefined : 'Atama için en az bir video veya ses içeriği eklenmelidir.'}
            className="gap-2 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: hasPlayableContent ? K.PRIMARY : K.TEXT_MUTED,
            }}
          >
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

      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open && !resetting) setResetTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 18, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}>Yeni deneme hakkı ver</DialogTitle>
            <DialogDescription style={{ color: K.TEXT_SECONDARY }}>
              {resetTarget?.name} için yeni bir deneme hakkı eklenecek. Bu işlem iptal edilemez. Devam etmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={resetting} onClick={() => setResetTarget(null)} style={ghostBtnStyle}>Vazgeç</Button>
            <Button
              disabled={resetting}
              style={{ background: K.PRIMARY, color: 'white' }}
              onClick={async () => {
                if (!resetTarget) return;
                setResetting(true);
                try {
                  const res = await fetch(`/api/admin/trainings/${id}/assignments`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: resetTarget.userId }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => null) as { error?: string } | null;
                    throw new Error(data?.error || 'İşlem başarısız oldu');
                  }
                  toast(`${resetTarget.name} için yeni hak verildi`, 'success');
                  setResetTarget(null);
                  refetch();
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'İşlem başarısız oldu.', 'error');
                } finally {
                  setResetting(false);
                }
              }}
            >
              {resetting ? 'İşleniyor...' : 'Evet, hak ver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: K.TEXT_SECONDARY }}>
        {training.description}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard title="Atanan" value={training.assignedCount ?? 0} icon={Users} accentColor={K.INFO} />
        <StatCard title="Tamamlayan" value={training.completedCount ?? 0} icon={TrendingUp} accentColor={K.PRIMARY} />
        <StatCard title="Başarılı" value={training.passedCount ?? 0} icon={GraduationCap} accentColor={K.SUCCESS} />
        <StatCard title="Başarısız" value={training.failedCount ?? 0} icon={GraduationCap} accentColor={K.ERROR} />
        <StatCard title="Ort. Puan" value={training.avgScore ?? 0} icon={BarChart3} accentColor={K.ACCENT} />
        <StatCard title="İmzalanan" value={`${training.signedCount ?? 0}/${training.passedCount ?? 0}`} icon={PenLine} accentColor={K.PRIMARY} />
      </div>

      {/* Tabs Section */}
      <div className="overflow-hidden" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
        {/* Tab Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: K.BG }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  background: activeTab === tab.id ? K.SURFACE : 'transparent',
                  color: activeTab === tab.id ? K.TEXT_PRIMARY : K.TEXT_MUTED,
                  boxShadow: activeTab === tab.id ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                }}
              >
                {tab.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    background: activeTab === tab.id ? K.PRIMARY_LIGHT : K.SURFACE_HOVER,
                    color: activeTab === tab.id ? K.PRIMARY : K.TEXT_MUTED,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          {activeTab !== 'videos' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg"
                style={ghostBtnStyle}
                disabled={downloadingTab === 'excel'}
                onClick={async () => {
                  setDownloadingTab('excel');
                  try {
                    const res = await fetch(`/api/admin/trainings/${id}/tab-export?tab=${activeTab}&format=excel`);
                    if (!res.ok) throw new Error('Rapor oluşturulamadı');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeTab === 'staff' ? 'personel_durumu' : 'sorular'}.xlsx`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch { toast('Excel raporu indirilemedi', 'error'); }
                  finally { setDownloadingTab(null); }
                }}
              >
                <Download className="h-3.5 w-3.5" /> {downloadingTab === 'excel' ? 'Hazırlanıyor...' : 'Excel'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg"
                style={ghostBtnStyle}
                disabled={downloadingTab === 'pdf'}
                onClick={async () => {
                  setDownloadingTab('pdf');
                  try {
                    const res = await fetch(`/api/admin/trainings/${id}/tab-export?tab=${activeTab}&format=pdf`);
                    if (!res.ok) throw new Error('Rapor oluşturulamadı');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeTab === 'staff' ? 'personel_durumu' : 'sorular'}.pdf`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch { toast('PDF raporu indirilemedi', 'error'); }
                  finally { setDownloadingTab(null); }
                }}
              >
                <FileText className="h-3.5 w-3.5" /> {downloadingTab === 'pdf' ? 'Hazırlanıyor...' : 'PDF'}
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
                  <div>
                    {/* Header Row */}
                    <div className="grid items-center px-4 py-2 mb-1" style={{ gridTemplateColumns: 'minmax(140px, 2fr) 55px minmax(70px, 1fr) 60px 60px 95px 75px 90px 90px', gap: '8px', color: K.TEXT_MUTED, background: K.BG, borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                      <span className="text-[11px] font-semibold uppercase tracking-wide">Personel</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center">Deneme</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide">İlerleme</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center">Ön Sınav</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center">Son Sınav</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide">Durum</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center">Tarih</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center">İmza</span>
                      <span />
                    </div>
                    {/* Data Rows */}
                    <div>
                      {assignedStaff.map((s) => {
                        const st = statusMap[s.status] || statusMap.assigned;
                        const StatusIcon = st.icon;
                        return (
                          <div key={s.name} className="grid items-center px-4 py-3 group" style={{ gridTemplateColumns: 'minmax(140px, 2fr) 55px minmax(70px, 1fr) 60px 60px 95px 75px 90px 90px', gap: '8px', background: K.SURFACE, borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE; }}
                          >
                            {/* Personel */}
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs font-semibold text-white" style={{ background: K.PRIMARY }}>{s.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate" title={s.name} style={{ color: K.TEXT_PRIMARY }}>{s.name}</p>
                                <p className="text-xs truncate" title={s.department} style={{ color: K.TEXT_MUTED }}>{s.department}</p>
                              </div>
                            </div>
                            {/* Deneme */}
                            <p className="text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-mono)', color: K.TEXT_SECONDARY }}>{s.attempt}/{training.maxAttempts}</p>
                            {/* İlerleme */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: K.BORDER_LIGHT }}>
                                <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: s.progress === 0 ? K.TEXT_MUTED : s.progress === 100 ? K.SUCCESS : K.INFO }} />
                              </div>
                              <span className="text-xs font-semibold shrink-0" style={{ fontFamily: 'var(--font-mono)', color: s.progress === 100 ? K.SUCCESS : s.progress > 0 ? K.INFO : K.TEXT_MUTED }}>{s.progress}%</span>
                            </div>
                            {/* Ön Sınav */}
                            <p className="text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-mono)', color: s.preScore !== null ? K.TEXT_SECONDARY : K.TEXT_MUTED }}>{s.preScore !== null ? `${s.preScore}%` : '—'}</p>
                            {/* Son Sınav */}
                            <p className="text-sm font-bold text-center" style={{ fontFamily: 'var(--font-mono)', color: s.postScore !== null && s.postScore >= training.passingScore ? K.SUCCESS : s.postScore !== null ? K.ERROR : K.TEXT_MUTED }}>{s.postScore !== null ? `${s.postScore}%` : '—'}</p>
                            {/* Durum */}
                            <div>
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.text }}>
                                <StatusIcon className="h-3 w-3" />{st.label}
                              </span>
                            </div>
                            {/* Tarih */}
                            <p className="text-xs font-medium text-center" style={{ fontFamily: 'var(--font-mono)', color: K.TEXT_SECONDARY }}>{s.completedAt ? new Date(s.completedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</p>
                            {/* İmza */}
                            <div className="text-center">
                              {s.signedAt ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: K.SUCCESS_BG, color: K.PRIMARY }}>
                                  <CheckCircle2 className="h-3 w-3" />
                                  {new Date(s.signedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              ) : s.status === 'passed' ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: K.WARNING_BG, color: '#b45309' }}>
                                  Bekleniyor
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: K.TEXT_MUTED }}>—</span>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex justify-end">
                              {s.status === 'failed' && (
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold rounded-lg" style={{ borderColor: K.PRIMARY, color: K.PRIMARY, background: K.SURFACE }}
                                  onClick={() => setResetTarget({ userId: s.userId, name: s.name })}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Yeni Hak Ver
                                </Button>
                              )}
                              <button onClick={() => router.push(`/admin/staff/${s.userId}`)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ color: K.TEXT_MUTED }}>
                                <Eye className="h-3.5 w-3.5" /> Detay<ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Bu eğitime henüz personel atanmadı.</div>
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
                        <div key={videoKey} className="overflow-hidden" style={{ background: K.SURFACE, border: isActive ? `1.5px solid ${K.PRIMARY}` : `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: isActive ? K.SHADOW_CARD : 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}>
                          {/* Video Row */}
                          <div
                            className="flex items-center gap-4 px-5 py-4 cursor-pointer group relative"
                            style={{ background: 'transparent' }}
                            onClick={() => setActiveVideoId(isActive ? null : videoKey)}
                          >
                            {/* Order Number */}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ background: isActive ? K.PRIMARY : K.PRIMARY_LIGHT, color: isActive ? 'white' : K.PRIMARY }}>
                              {vi + 1}
                            </div>

                            {/* Play Icon */}
                            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: isActive ? K.PRIMARY : K.BG }}>
                              {isActive ? (
                                <Video className="h-5 w-5" style={{ color: 'white' }} />
                              ) : (
                                <Play className="h-4 w-4" style={{ color: K.PRIMARY, marginLeft: 2 }} />
                              )}
                            </div>

                            {/* Title & Meta */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: K.TEXT_PRIMARY }}>{v.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Clock className="h-3 w-3" style={{ color: K.TEXT_MUTED }} />
                                <span className="text-[11px] font-medium" style={{ fontFamily: 'var(--font-mono)', color: K.TEXT_MUTED }}>{v.duration}</span>
                              </div>
                            </div>

                            {/* Status Indicator */}
                            <div className="flex items-center gap-3 shrink-0">
                              {isActive && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                                  style={{ background: K.PRIMARY_LIGHT, border: `1px solid ${K.PRIMARY}` }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: K.PRIMARY }} />
                                  <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: K.PRIMARY }}>Oynatılıyor</span>
                                </motion.span>
                              )}
                              <ChevronRight className="h-4 w-4" style={{ color: K.TEXT_MUTED, transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
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
                                <div className="px-6 pb-6 pt-2">
                                  {!v.videoUrl ? (
                                    <div
                                      className="mx-auto rounded-xl px-6 py-8 text-center"
                                      style={{ maxWidth: '640px', background: K.BG, border: `1px dashed ${K.BORDER}`, color: K.TEXT_MUTED }}
                                    >
                                      <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>İçerik şu anda yüklenemiyor</p>
                                      <p className="text-xs mt-1">İçerik dosyası bulunamadı veya bağlantı oluşturulamadı. Lütfen yöneticiye haber verin.</p>
                                    </div>
                                  ) : v.contentType === 'pdf' ? (
                                    <div className="mx-auto rounded-xl overflow-hidden" style={{ maxWidth: '720px', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
                                      <iframe
                                        key={videoKey}
                                        src={v.videoUrl}
                                        className="w-full"
                                        style={{ aspectRatio: '4/5', display: 'block', border: 'none' }}
                                        title={v.title}
                                      />
                                    </div>
                                  ) : v.contentType === 'audio' ? (
                                    <div className="mx-auto rounded-xl px-5 py-4" style={{ maxWidth: '640px', background: K.BG, border: `1px solid ${K.BORDER}` }}>
                                      <audio
                                        key={videoKey}
                                        src={v.videoUrl}
                                        controls
                                        className="w-full"
                                      />
                                    </div>
                                  ) : (
                                    <div className="mx-auto rounded-xl overflow-hidden" style={{ maxWidth: '640px', background: '#000', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                                      <video
                                        key={videoKey}
                                        src={v.videoUrl}
                                        controls
                                        className="w-full"
                                        style={{ aspectRatio: '16/9', display: 'block' }}
                                      />
                                    </div>
                                  )}
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
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: K.BG }}>
                      <Video className="h-6 w-6" style={{ color: K.TEXT_MUTED }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: K.TEXT_MUTED }}>Eğitime video veya PDF eklemek için &apos;İçerik Ekle&apos; butonunu kullanın.</p>
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
                      <div key={q.id ?? `q-${i}`} className="p-5" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
                        <div className="flex items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: K.PRIMARY_LIGHT, color: K.ACCENT }}>{i + 1}</div>
                          <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>{q.text}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Award className="h-3.5 w-3.5" style={{ color: K.ACCENT }} />
                            <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: K.ACCENT }}>{q.points} puan</span>
                          </div>
                        </div>
                        {q.options.length > 0 ? (
                          <div className="mt-3 ml-13 space-y-2">
                            {q.options.map((o, oi) => (
                              <div
                                key={o.id}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                                style={{
                                  background: o.isCorrect ? K.SUCCESS_BG : K.BG,
                                  border: o.isCorrect ? `1px solid ${K.SUCCESS}` : `1px solid ${K.BORDER_LIGHT}`,
                                }}
                              >
                                <span
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                                  style={{
                                    background: o.isCorrect ? K.SUCCESS : K.BORDER_LIGHT,
                                    color: o.isCorrect ? 'white' : K.TEXT_MUTED,
                                  }}
                                >
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span className="flex-1 text-sm" style={{ color: o.isCorrect ? K.PRIMARY : K.TEXT_SECONDARY, fontWeight: o.isCorrect ? 600 : 400 }}>
                                  {o.text}
                                </span>
                                {o.isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: K.SUCCESS }} />}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 ml-13 text-xs" style={{ color: K.TEXT_MUTED }}>Seçenek eklenmemiş</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Bu eğitime henüz soru eklenmemiş.</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
