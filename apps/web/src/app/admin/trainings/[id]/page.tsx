'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, GraduationCap, Users, TrendingUp, Clock, Edit, Play, BarChart3,
  FileText, RotateCcw, Download, Eye, Video, CheckCircle2, XCircle, Timer,
  ChevronRight, Award, FileDown, MessageSquare, Search, X, MoreHorizontal,
  Loader2, UserMinus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { PageLoading } from '@/components/shared/page-loading';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { motion, AnimatePresence } from 'framer-motion';
import { useFetch } from '@/hooks/use-fetch';
import { resolveCategoryMeta } from '@/lib/training-categories';
import { AssignStaffModal } from './assign-staff-modal';
import { IncompleteSegmentsModal } from './incomplete-segments-modal';
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
  status: string;
  statusBreakdown: { passed: number; failed: number; in_progress: number; assigned: number };
  videos: { id: string; title: string; videoUrl: string; duration: string; order: number; contentType: string }[];
  questions: { id: string; text: string; points: number; options: { id: string; text: string; isCorrect: boolean; order: number }[] }[];
}

// Personel listesi ayrı, sayfalı endpoint'ten (`[id]/staff`) gelir.
interface StaffRow {
  assignmentId: string;
  userId: string;
  name: string;
  department: string;
  attempt: number;
  progress: number;
  preScore: number | null;
  postScore: number | null;
  status: string;
  completedAt: string;
  signedAt: string | null;
  signatureMethod: string | null;
}

const statusMap: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  passed: { label: 'Başarılı', bg: K.SUCCESS_BG, text: K.PRIMARY, icon: CheckCircle2 },
  failed: { label: 'Başarısız', bg: K.ERROR_BG, text: '#b91c1c', icon: XCircle },
  in_progress: { label: 'Devam Ediyor', bg: K.WARNING_BG, text: '#b45309', icon: Timer },
  assigned: { label: 'Atandı', bg: K.INFO_BG, text: '#1d4ed8', icon: Users },
};

type StaffStatusFilter = 'all' | 'completed' | 'incomplete';

const STATUS_FILTERS: { value: StaffStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'completed', label: 'Tamamladı' },
  { value: 'incomplete', label: 'Tamamlamadı' },
];

export default function TrainingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: training, isLoading, error, refetch } = useFetch<TrainingDetail>(id ? `/api/admin/trainings/${id}` : null);
  // Kategori slug'ını etiket+renge çöz (silinmiş kategori → "Kategorisiz")
  const { data: catData } = useFetch<{ value: string; label: string }[]>('/api/admin/training-categories');
  const dbCategories = catData ?? [];
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('staff');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [downloadingCompletion, setDownloadingCompletion] = useState<'pdf' | 'excel' | null>(null);
  const [downloadingAnnouncement, setDownloadingAnnouncement] = useState(false);
  const [downloadingTab, setDownloadingTab] = useState<'pdf' | 'excel' | 'pdf-completed' | 'pdf-incomplete' | null>(null);
  const [resetTarget, setResetTarget] = useState<{ userId: string; name: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ assignmentId: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<StaffStatusFilter>('all');

  // Personel tablosu sticky header — içerik header altına girince subtle
  // box-shadow ile elevation cue ver. Scroll cue yoksa header "düz" hisseder.
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [headerStuck, setHeaderStuck] = useState(false);
  useEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderStuck(entry.intersectionRatio < 1),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hooks early return'lerden ÖNCE çağrılmalı (React Rules of Hooks). training
  // henüz yüklenmediğinde boş array üzerinde hesap döner; yüklendiğinde gerçek
  // sayımı verir — render iterasyonları arasında hook sırası sabit kalır.
  // Personel listesi sunucu-taraflı sayfalanır/aranır (büyük org'larda tüm
  // atamaları çekmek ağırdı). Stat sayaçları ayrı sunucu agregasyonundan
  // (statusBreakdown) gelir → sayfalamadan etkilenmez.
  const STAFF_LIMIT = 20;
  const [staffPage, setStaffPage] = useState(1);
  const [debouncedStaffSearch, setDebouncedStaffSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedStaffSearch(staffSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [staffSearch]);

  const staffQs = new URLSearchParams({ page: String(staffPage), limit: String(STAFF_LIMIT) });
  if (debouncedStaffSearch) staffQs.set('search', debouncedStaffSearch);
  if (staffStatusFilter !== 'all') staffQs.set('status', staffStatusFilter);
  const { data: staffData, isLoading: staffLoading } = useFetch<{
    assignedStaff: StaffRow[]; total: number; page: number; limit: number;
  }>(id ? `/api/admin/trainings/${id}/staff?${staffQs.toString()}` : null);

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

  const trainingVideos = training.videos ?? [];
  const trainingQuestions = training.questions ?? [];
  const catMeta = resolveCategoryMeta(training.category, dbCategories);

  // Sayfalama/filtre/arama için türetilenler
  const statusBreakdown = training.statusBreakdown ?? { passed: 0, failed: 0, in_progress: 0, assigned: 0 };
  const statusCounts = {
    completed: statusBreakdown.passed + statusBreakdown.failed,
    incomplete: statusBreakdown.in_progress + statusBreakdown.assigned,
  };
  const totalAssigned = training.assignedCount ?? 0;
  const staffRows = staffData?.assignedStaff ?? [];
  const staffTotal = staffData?.total ?? 0;
  const staffTotalPages = Math.max(1, Math.ceil(staffTotal / STAFF_LIMIT));
  // PDF içerikler son sınava geçişi tetiklemez — atama ancak en az 1 video/ses varsa yapılabilir
  const hasPlayableContent = trainingVideos.some(v => v.contentType === 'video' || v.contentType === 'audio');

  const tabs = [
    { id: 'staff', label: 'Personel Durumu', count: totalAssigned },
    { id: 'videos', label: 'Videolar', count: training.videoCount ?? 0 },
    { id: 'questions', label: 'Sorular', count: training.questionCount ?? 0 },
  ];

  const ghostBtnStyle = { borderColor: K.BORDER, color: K.TEXT_SECONDARY, background: K.SURFACE };

  const downloadCompletionPdf = async () => {
    setDownloadingCompletion('pdf');
    try {
      const res = await fetch(`/api/admin/trainings/${id}/completion-report`);
      if (!res.ok) throw new Error('Katılım formu oluşturulamadı');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'egitim_katilim_formu.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast('Eğitim Katılım Formu indirilemedi', 'error'); }
    finally { setDownloadingCompletion(null); }
  };

  const downloadAnnouncementForm = async () => {
    setDownloadingAnnouncement(true);
    try {
      const res = await fetch(`/api/admin/trainings/${id}/announcement-form`);
      if (!res.ok) throw new Error('Duyuru formu oluşturulamadı');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'egitim_duyuru_formu.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast('Eğitim Duyuru Formu indirilemedi', 'error'); }
    finally { setDownloadingAnnouncement(false); }
  };

  // Tab-export raporu indir (PDF/Excel). status verilirse personel sekmesinde
  // sadece tamamlayan/tamamlamayan personeli içeren rapor üretir.
  const downloadReport = async (
    key: 'pdf' | 'excel' | 'pdf-completed' | 'pdf-incomplete',
    format: 'pdf' | 'excel',
    filename: string,
    status?: 'completed' | 'incomplete',
  ) => {
    setDownloadingTab(key);
    try {
      const statusQs = status ? `&status=${status}` : '';
      const res = await fetch(`/api/admin/trainings/${id}/tab-export?tab=${activeTab}&format=${format}${statusQs}`);
      if (!res.ok) throw new Error('Rapor oluşturulamadı');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast(`${format === 'pdf' ? 'PDF' : 'Excel'} raporu indirilemedi`, 'error'); }
    finally { setDownloadingTab(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header — tek bütün card: breadcrumb satırı / hero title + meta / action footer.
          Eski layout uzun başlıkta dikey yığılıp butonları sağa sıkıştırıyordu;
          burada title ile actions farklı satırlarda yer aldığı için sıkışma yok. */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, boxShadow: K.SHADOW_CARD }}
      >
        {/* Üst satır: geri + breadcrumb · status pill */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Geri"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-stone-100"
              style={{ background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`, color: K.TEXT_SECONDARY }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <nav className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>
              <span>Eğitimler</span>
              {training.category ? (
                <>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="truncate" style={{ color: K.TEXT_SECONDARY }}>{catMeta.label}</span>
                </>
              ) : null}
            </nav>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: K.SUCCESS_BG, color: K.PRIMARY }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: K.SUCCESS }} />
            {training.status ?? 'Aktif'}
          </span>
        </div>

        {/* Hero: büyük başlık (en fazla 2 satır) + meta chip cluster */}
        <div className="px-6 pt-5 pb-6">
          <h1
            className="text-[26px] font-bold leading-[1.2] tracking-tight md:text-[30px]"
            style={{ fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            title={training.title}
          >
            {training.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {training.category ? <MetaChip icon={GraduationCap} label={catMeta.label} /> : null}
            <MetaChip icon={Award} label={`Baraj %${training.passingScore}`} />
            <MetaChip icon={RotateCcw} label={`${training.maxAttempts} deneme`} />
            {training.examDuration ? <MetaChip icon={Clock} label={`${training.examDuration} dk sınav`} /> : null}
          </div>
        </div>

        {/* Action footer: secondary + primary actions */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg font-medium"
              style={ghostBtnStyle}
              onClick={() => router.push(`/admin/trainings/${id}/edit`)}
            >
              <Edit className="h-4 w-4" /> Düzenle
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg font-medium"
              style={ghostBtnStyle}
              disabled={downloadingCompletion === 'pdf'}
              onClick={downloadCompletionPdf}
            >
              {downloadingCompletion === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {downloadingCompletion === 'pdf' ? 'Katılım formu hazırlanıyor...' : 'Eğitim Katılım Formu'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg font-medium"
              style={ghostBtnStyle}
              disabled={downloadingAnnouncement}
              onClick={downloadAnnouncementForm}
            >
              {downloadingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {downloadingAnnouncement ? 'Duyuru formu hazırlanıyor...' : 'Eğitim Duyuru Formu'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-[background,box-shadow] duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--color-text-primary,#000)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#0d9668)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg,#f1f5f9)]"
                style={{ ...ghostBtnStyle, border: `1px solid ${K.BORDER}` }}
              >
                <MoreHorizontal className="h-4 w-4" /> Diğer İşlemler
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]">

                <DropdownMenuItem
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
                  {downloadingCompletion === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>{downloadingCompletion === 'excel' ? 'Excel hazırlanıyor…' : 'Excel Rapor indir'}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => router.push(`/admin/feedback-forms/responses?trainingId=${id}`)}>
                  <MessageSquare className="h-4 w-4" />
                  <span>Geri bildirimler</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!hasPlayableContent}
                  onClick={() => setReassignModalOpen(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Tamamlamayanları yeniden ata</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            onClick={() => setAssignModalOpen(true)}
            disabled={!hasPlayableContent}
            title={hasPlayableContent ? undefined : 'Atama için en az bir video veya ses içeriği eklenmelidir.'}
            className="gap-2 rounded-lg font-semibold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: hasPlayableContent ? K.PRIMARY : K.TEXT_MUTED }}
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

      <IncompleteSegmentsModal
        trainingId={id as string}
        open={reassignModalOpen}
        onOpenChange={setReassignModalOpen}
        onSuccess={() => {
          refetch();
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

      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open && !removing) setRemoveTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 18, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}>Personeli eğitimden çıkar</DialogTitle>
            <DialogDescription style={{ color: K.TEXT_SECONDARY }}>
              {removeTarget?.name} bu eğitimden çıkarılacak. İlgili sınav denemeleri de silinir. Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={removing} onClick={() => setRemoveTarget(null)} style={ghostBtnStyle}>Vazgeç</Button>
            <Button
              disabled={removing}
              style={{ background: K.ERROR, color: 'white' }}
              onClick={async () => {
                if (!removeTarget) return;
                setRemoving(true);
                try {
                  const res = await fetch(`/api/admin/trainings/${id}/assignments`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assignmentId: removeTarget.assignmentId }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => null) as { error?: string } | null;
                    throw new Error(data?.error || 'İşlem başarısız oldu');
                  }
                  toast(`${removeTarget.name} eğitimden çıkarıldı`, 'success');
                  setRemoveTarget(null);
                  refetch();
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'İşlem başarısız oldu.', 'error');
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {removing ? 'Çıkarılıyor...' : 'Evet, çıkar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: K.TEXT_SECONDARY }}>
        {training.description}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Atanan" value={training.assignedCount ?? 0} icon={Users} accentColor={K.INFO} />
        <StatCard title="Tamamlayan" value={training.completedCount ?? 0} icon={TrendingUp} accentColor={K.PRIMARY} />
        <StatCard title="Başarılı" value={training.passedCount ?? 0} icon={GraduationCap} accentColor={K.SUCCESS} />
        <StatCard title="Başarısız" value={training.failedCount ?? 0} icon={GraduationCap} accentColor={K.ERROR} />
        <StatCard title="Ort. Puan" value={training.avgScore ?? 0} icon={BarChart3} accentColor={K.ACCENT} />
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg"
                style={ghostBtnStyle}
                disabled={downloadingTab === 'excel'}
                onClick={() => downloadReport('excel', 'excel', `${activeTab === 'staff' ? 'personel_durumu' : 'sorular'}.xlsx`)}
              >
                <Download className="h-3.5 w-3.5" /> {downloadingTab === 'excel' ? 'Hazırlanıyor...' : 'Excel'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-lg"
                style={ghostBtnStyle}
                disabled={downloadingTab === 'pdf'}
                onClick={() => downloadReport('pdf', 'pdf', `${activeTab === 'staff' ? 'personel_durumu' : 'sorular'}.pdf`)}
              >
                <FileText className="h-3.5 w-3.5" /> {downloadingTab === 'pdf' ? 'Hazırlanıyor...' : `PDF${activeTab === 'staff' ? ' (Tümü)' : ''}`}
              </Button>
              {activeTab === 'staff' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs rounded-lg"
                    style={{ borderColor: K.SUCCESS, color: K.PRIMARY, background: K.SURFACE }}
                    disabled={downloadingTab === 'pdf-completed'}
                    onClick={() => downloadReport('pdf-completed', 'pdf', 'tamamlayanlar.pdf', 'completed')}
                  >
                    <FileText className="h-3.5 w-3.5" /> {downloadingTab === 'pdf-completed' ? 'Hazırlanıyor...' : 'Tamamlayanlar PDF'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs rounded-lg"
                    style={{ borderColor: K.WARNING, color: '#b45309', background: K.SURFACE }}
                    disabled={downloadingTab === 'pdf-incomplete'}
                    onClick={() => downloadReport('pdf-incomplete', 'pdf', 'tamamlamayanlar.pdf', 'incomplete')}
                  >
                    <FileText className="h-3.5 w-3.5" /> {downloadingTab === 'pdf-incomplete' ? 'Hazırlanıyor...' : 'Tamamlamayanlar PDF'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Staff Tab */}
            {activeTab === 'staff' && (
              <motion.div key="staff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {(() => {
                  const filterActive = staffStatusFilter !== 'all' || debouncedStaffSearch.length > 0;
                  return (
                  <div>
                    {/* Status Filter Chips */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {STATUS_FILTERS.map(f => {
                        const isActive = staffStatusFilter === f.value;
                        const count = f.value === 'all'
                          ? totalAssigned
                          : f.value === 'completed'
                            ? statusCounts.completed
                            : statusCounts.incomplete;
                        const palette = f.value === 'all'
                          ? { bg: K.SURFACE_HOVER, text: K.TEXT_PRIMARY, activeBg: K.TEXT_PRIMARY, activeText: '#ffffff' }
                          : f.value === 'completed'
                            ? { bg: K.SURFACE, text: K.TEXT_SECONDARY, activeBg: K.SUCCESS_BG, activeText: K.PRIMARY }
                            : { bg: K.SURFACE, text: K.TEXT_SECONDARY, activeBg: K.WARNING_BG, activeText: '#b45309' };
                        return (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => { setStaffStatusFilter(f.value); setStaffPage(1); }}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{
                              background: isActive ? palette.activeBg : palette.bg,
                              color: isActive ? palette.activeText : palette.text,
                              border: `1px solid ${isActive ? 'transparent' : K.BORDER_LIGHT}`,
                            }}
                          >
                            {f.label}
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: isActive ? 'rgba(255,255,255,0.25)' : K.BG, color: isActive ? palette.activeText : K.TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Search */}
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: K.TEXT_MUTED }} />
                        <input
                          type="text"
                          value={staffSearch}
                          onChange={e => { setStaffSearch(e.target.value); setStaffPage(1); }}
                          placeholder="İsim veya e-posta ara..."
                          className="w-full rounded-lg pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-0"
                          style={{ border: `1px solid ${K.BORDER}`, background: K.SURFACE, color: K.TEXT_PRIMARY }}
                        />
                        {staffSearch && (
                          <button
                            type="button"
                            onClick={() => { setStaffSearch(''); setStaffPage(1); }}
                            aria-label="Aramayı temizle"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1"
                            style={{ color: K.TEXT_MUTED }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {filterActive && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>
                            {staffTotal} personel bulundu
                          </span>
                          <button
                            type="button"
                            onClick={() => { setStaffStatusFilter('all'); setStaffSearch(''); setStaffPage(1); }}
                            className="text-xs font-semibold underline"
                            style={{ color: K.PRIMARY }}
                          >
                            Filtreleri temizle
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Header Row — sticky: içerik altına girince subtle shadow ile elevation cue */}
                    <div
                      ref={stickyHeaderRef}
                      data-stuck={headerStuck || undefined}
                      className="grid items-center px-4 py-3 mb-1 transition-[box-shadow] duration-150 ease-out data-[stuck]:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.06)]"
                      style={{
                        gridTemplateColumns: 'minmax(140px, 2fr) 55px minmax(70px, 1fr) 72px 72px 95px 75px 90px',
                        gap: '8px',
                        color: K.TEXT_MUTED,
                        background: K.BG,
                        borderBottom: `1px solid ${K.BORDER_LIGHT}`,
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Personel</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center whitespace-nowrap">Deneme</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">İlerleme</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center whitespace-nowrap">Ön Sınav</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center whitespace-nowrap">Son Sınav</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Durum</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-center whitespace-nowrap">Tarih</span>
                      <span />
                    </div>
                    {/* Data Rows */}
                    <div>
                      {staffLoading ? (
                        <div className="flex items-center justify-center gap-2 text-sm py-8" style={{ color: K.TEXT_MUTED }}>
                          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
                        </div>
                      ) : staffRows.length === 0 ? (
                        <div className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>
                          {totalAssigned === 0
                            ? 'Bu eğitime henüz personel atanmadı.'
                            : filterActive
                              ? 'Aramaya/filtreye uyan personel bulunamadı.'
                              : 'Personel bulunamadı.'}
                        </div>
                      ) : staffRows.map((s) => {
                        const st = statusMap[s.status] || statusMap.assigned;
                        const StatusIcon = st.icon;
                        return (
                          <div key={s.assignmentId} className="grid items-center px-4 py-3 group" style={{ gridTemplateColumns: 'minmax(140px, 2fr) 55px minmax(70px, 1fr) 72px 72px 95px 75px 90px', gap: '8px', background: K.SURFACE, borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
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
                            <div className="flex items-center">
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: K.BORDER_LIGHT }}>
                                <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: s.progress === 0 ? K.TEXT_MUTED : s.progress === 100 ? K.SUCCESS : K.INFO }} />
                              </div>
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
                            {/* Actions */}
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent" aria-label="Personel işlemleri">
                                  <MoreHorizontal className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/staff/${s.userId}`)}>
                                    <Eye className="h-4 w-4" /> Detay Görüntüle
                                  </DropdownMenuItem>
                                  {s.status === 'failed' && (
                                    <DropdownMenuItem className="gap-2" onClick={() => setResetTarget({ userId: s.userId, name: s.name })}>
                                      <RotateCcw className="h-4 w-4" style={{ color: K.PRIMARY }} /> Yeni Hak Ver
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="gap-2"
                                    style={{ color: K.ERROR }}
                                    onClick={() => setRemoveTarget({ assignmentId: s.assignmentId, name: s.name })}
                                  >
                                    <UserMinus className="h-4 w-4" /> Eğitimden Çıkar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Sayfalama */}
                    {staffTotal > STAFF_LIMIT && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs" style={{ color: K.TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
                          Sayfa {staffPage} / {staffTotalPages} · {staffTotal} personel
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={staffPage <= 1 || staffLoading}
                            onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                            style={{ border: `1px solid ${K.BORDER}`, background: K.SURFACE, color: K.TEXT_SECONDARY }}
                          >
                            Önceki
                          </button>
                          <button
                            type="button"
                            disabled={staffPage >= staffTotalPages || staffLoading}
                            onClick={() => setStaffPage((p) => Math.min(staffTotalPages, p + 1))}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                            style={{ border: `1px solid ${K.BORDER}`, background: K.SURFACE, color: K.TEXT_SECONDARY }}
                          >
                            Sonraki
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })()}
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

function MetaChip({ icon: Icon, label }: { icon: typeof GraduationCap; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: K.SURFACE,
        border: `1px solid ${K.BORDER_LIGHT}`,
        color: K.TEXT_SECONDARY,
      }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: K.TEXT_MUTED }} />
      {label}
    </span>
  );
}
