'use client';

import { useState } from 'react';
import {
  Users, GraduationCap, TrendingUp, AlertTriangle, Trophy, Activity, Clock, ArrowRight,
  Plus, Send, Download, Shield, Building2, CalendarClock, UserPlus, ShieldCheck, Grid3X3,
  Radio, BookOpen,
} from 'lucide-react';
import { useRealtimeExams } from '@/hooks/use-realtime-exams';
import type { LiveExamAttempt } from '@/hooks/use-realtime-exams';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from '@/components/shared/recharts';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface DashboardData {
  stats: { title: string; value: number | string; icon: string; accentColor: string; trend?: { value: number; label: string; isPositive: boolean } }[];
  trendData: { month: string; tamamlanan: number; atanan: number; basarisiz: number }[];
  statusDistribution: { name: string; value: number; color: string }[];
  departmentComparison: { dept: string; oran: number; puan: number }[];
  overdueTrainings: { assignmentId: string; trainingId: string; name: string; dept: string; training: string; dueDate: string; daysOverdue: number; color: string }[];
  complianceAlerts: { training: string; regulatoryBody: string; daysLeft: number; complianceRate: number; status: string }[];
  expiringCerts: { name: string; cert: string; expiryDate: string; daysLeft: number; status: string }[];
  topPerformers: { name: string; department: string; score: number; courses: number; initials: string; color: string }[];
  recentActivity: { action: string; user: string; time: string; type: string }[];
}

const iconMap: Record<string, typeof Users> = { Users, GraduationCap, TrendingUp, AlertTriangle, ShieldCheck };

interface MiniCell { trainingId: string; state: string }
interface MiniStaffRow { name: string; cells: MiniCell[] }
interface MatrixPreview { trainings: { id: string; title: string; isCompulsory?: boolean }[]; staff: MiniStaffRow[] }

const matrixStateColor: Record<string, string> = {
  passed: 'var(--color-success)',
  failed: 'var(--color-error)',
  in_progress: 'var(--color-warning)',
  assigned: 'var(--color-info)',
  unassigned: 'var(--color-border)',
};

function MatrixMiniWidget() {
  const { data, isLoading } = useFetch<{ trainings: { id: string; title: string; isCompulsory: boolean }[]; staff: { id: string; name: string; department: string; cells: MiniCell[]; completionRate: number }[] }>('/api/admin/competency-matrix');

  const cellStyles: Record<string, { bg: string; border: string; label: string }> = {
    passed:      { bg: 'var(--color-success-bg)',  border: 'var(--color-success)',  label: 'Başarılı' },
    failed:      { bg: 'var(--color-error-bg)',    border: 'var(--color-error)',    label: 'Başarısız' },
    in_progress: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', label: 'Devam' },
    assigned:    { bg: 'var(--color-info-bg)',     border: 'var(--color-info)',     label: 'Atandı' },
    unassigned:  { bg: 'transparent',              border: 'var(--color-border)',   label: 'Atanmadı' },
  };

  // Deterministic per-person avatar hue
  const nameHue = (name: string) => name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (isLoading) {
    return (
      <div className="animate-pulse overflow-hidden rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-9 w-9 rounded-xl" style={{ background: 'var(--color-border)' }} />
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded" style={{ background: 'var(--color-border)' }} />
            <div className="h-2.5 w-44 rounded" style={{ background: 'var(--color-border)' }} />
          </div>
        </div>
        <div className="space-y-2.5 p-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full" style={{ background: 'var(--color-border)' }} />
              <div className="h-2.5 w-20 rounded" style={{ background: 'var(--color-border)' }} />
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-6 w-6 rounded-full" style={{ background: 'var(--color-border)' }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const allTrainings = data?.trainings ?? [];
  const allStaff = data?.staff ?? [];
  const previewTrainings = allTrainings.slice(0, 6);
  const previewStaff = allStaff.slice(0, 8);

  if (previewStaff.length === 0 || previewTrainings.length === 0) return null;

  const totalCells = allStaff.length * allTrainings.length;
  const passedCells = allStaff.flatMap(s => s.cells).filter(c => c.state === 'passed').length;
  const coverageRate = totalCells > 0 ? Math.round((passedCells / totalCells) * 100) : 0;

  const preview: MatrixPreview = {
    trainings: previewTrainings,
    staff: previewStaff.map(s => ({
      name: s.name,
      cells: previewTrainings.map(t => s.cells.find(c => c.trainingId === t.id) ?? { trainingId: t.id, state: 'unassigned' }),
    })),
  };

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.03) 0%, transparent 70%)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-light) 0%, rgba(59,130,246,0.12) 100%)',
              boxShadow: '0 1px 4px rgba(59,130,246,0.18)',
            }}
          >
            <Grid3X3 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Yetkinlik Matrisi</h3>
            <div className="mt-1 flex items-center gap-1.5">
              {[
                { val: `${allStaff.length}`, unit: 'personel', accent: false },
                { val: `${allTrainings.length}`, unit: 'eğitim', accent: false },
                { val: `%${coverageRate}`, unit: 'tamamlandı', accent: true },
              ].map(({ val, unit, accent }) => (
                <span
                  key={unit}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: accent ? 'var(--color-success-bg)' : 'var(--color-bg)',
                    border: `1px solid ${accent ? 'var(--color-success)' : 'var(--color-border)'}`,
                    color: accent ? 'var(--color-success)' : 'var(--color-text-muted)',
                    opacity: accent ? 1 : 0.85,
                  }}
                >
                  <strong style={{ color: accent ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 700 }}>{val}</strong>
                  {unit}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link
          href="/admin/competency-matrix"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
        >
          Tümü <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Matrix ── */}
      <div className="overflow-x-auto px-5 pb-4 pt-4">
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {/* Name column spacer */}
              <th style={{ width: 116, paddingBottom: 6 }} />
              {/* Training column headers */}
              {preview.trainings.map((t) => (
                <th key={t.id} style={{ width: 34, paddingBottom: 6, paddingLeft: 3, paddingRight: 3, textAlign: 'center', verticalAlign: 'bottom' }}>
                  <div className="flex flex-col items-center gap-1">
                    <span
                      style={{
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        letterSpacing: '0.03em',
                        height: 54,
                        lineHeight: 1.25,
                        display: 'block',
                        overflow: 'hidden',
                      }}
                      title={t.title}
                    >
                      {t.title.length > 13 ? t.title.slice(0, 13) + '…' : t.title}
                    </span>
                    {/* Column color dot */}
                    <span
                      style={{
                        display: 'block',
                        width: 5, height: 5, borderRadius: '50%',
                        background: t.isCompulsory ? 'var(--color-error)' : 'var(--color-info)',
                        flexShrink: 0,
                      }}
                      title={t.isCompulsory ? 'Zorunlu eğitim' : undefined}
                    />
                  </div>
                </th>
              ))}
              {/* Progress column header */}
              <th style={{ width: 64, paddingBottom: 6, paddingLeft: 10, textAlign: 'left', verticalAlign: 'bottom' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>ORAN</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.staff.map((s, si) => {
              const staffFull = allStaff.find(st => st.name === s.name);
              const rate = staffFull?.completionRate ?? 0;
              const rateColor = rate >= 80 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
              const hue = nameHue(s.name);
              return (
                <tr key={s.name} style={{ borderTop: si > 0 ? '1px solid var(--color-border)' : 'none' }}>
                  {/* Person */}
                  <td style={{ paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${hue}, 52%, 52%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, color: '#fff',
                          boxShadow: `0 1px 4px hsl(${hue}, 52%, 52%, 0.4)`,
                        }}
                      >
                        {s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={s.name}
                      >
                        {s.name.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </div>
                  </td>

                  {/* Cells */}
                  {s.cells.map((cell, ci) => {
                    const cs = cellStyles[cell.state] ?? cellStyles.unassigned;
                    const isUnset = cell.state === 'unassigned';
                    return (
                      <td key={ci} style={{ padding: '6px 3px', textAlign: 'center' }}>
                        <div
                          title={cs.label}
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: cs.bg,
                            border: `2px solid ${cs.border}`,
                            opacity: isUnset ? 0.35 : 1,
                            margin: '0 auto',
                            boxShadow: isUnset ? 'none' : `0 1px 4px rgba(0,0,0,0.08)`,
                            cursor: 'default',
                          }}
                        />
                      </td>
                    );
                  })}

                  {/* Completion bar */}
                  <td style={{ paddingLeft: 10, paddingTop: 6, paddingBottom: 6 }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 38, height: 5, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', width: `${rate}%`, borderRadius: 3, background: rateColor, transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: rateColor, minWidth: 28 }}>
                        %{rate}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ── */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3"
        style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
      >
        {[
          { state: 'passed',      label: 'Başarılı' },
          { state: 'in_progress', label: 'Devam' },
          { state: 'assigned',    label: 'Atandı' },
          { state: 'failed',      label: 'Başarısız' },
        ].map(({ state, label }) => {
          const cs = cellStyles[state];
          return (
            <div key={state} className="flex items-center gap-1.5">
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: cs.bg, border: `2px solid ${cs.border}` }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>{label}</span>
            </div>
          );
        })}
        {allStaff.length > 8 && (
          <span className="ml-auto text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            +{allStaff.length - 8} personel daha
          </span>
        )}
      </div>
    </div>
  );
}
const typeColors: Record<string, string> = { success: 'var(--color-success)', error: 'var(--color-error)', info: 'var(--color-info)', warning: 'var(--color-warning)' };

const examStatusLabel: Record<string, { label: string; color: string; bg: string }> = {
  pre_exam: { label: 'Ön sınav', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
  watching_videos: { label: 'Video izliyor', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  post_exam: { label: 'Sınav', color: 'var(--color-accent)', bg: 'var(--color-warning-bg)' },
};

function elapsedLabel(startedAt: string): string {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  return `${Math.floor(mins / 60)} sa önce`;
}

/** G7.6 — Realtime in-progress exam list for admin dashboard */
function LiveExamsWidget() {
  const { attempts, isLoading, activeCount } = useRealtimeExams();

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
            <Radio className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
            {activeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-success)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            )}
          </div>
          <div>
            <h3 className="text-[15px] font-bold">Anlık Sınavlar</h3>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Şu an sınav yapan personel</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: activeCount > 0 ? 'var(--color-success-bg)' : 'var(--color-bg)' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: activeCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
          <span className="text-[12px] font-semibold" style={{ color: activeCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            {isLoading ? '...' : `${activeCount} aktif`}
          </span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--color-bg)' }} />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3" style={{ background: 'var(--color-bg)' }}>
            <BookOpen className="h-6 w-6" style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Şu an aktif sınav yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attempts.slice(0, 8).map((attempt: LiveExamAttempt) => {
            const st = examStatusLabel[attempt.status] ?? examStatusLabel.pre_exam;
            return (
              <div
                key={attempt.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
              >
                {/* Avatar initials */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {attempt.user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-semibold">{attempt.user.name}</p>
                  <p className="truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {attempt.training.title.length > 32 ? attempt.training.title.slice(0, 32) + '…' : attempt.training.title}
                  </p>
                </div>

                {/* Status + elapsed */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {st.label}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {elapsedLabel(attempt.startedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const quickActions = [
  { label: 'Yeni Eğitim', desc: 'Video tabanlı eğitim oluştur', icon: Plus, href: '/admin/trainings/new', color: 'var(--color-primary)', gradient: 'linear-gradient(135deg, rgba(13,150,104,0.08) 0%, rgba(13,150,104,0.02) 100%)', glowColor: 'rgba(13,150,104,0.06)' },
  { label: 'Personel Ekle', desc: 'Yeni personel kaydı', icon: UserPlus, href: '/admin/staff', color: 'var(--color-info)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)', glowColor: 'rgba(59,130,246,0.06)' },
  { label: 'Hatırlatma Gönder', desc: 'Toplu bildirim gönder', icon: Send, href: '/admin/notifications', color: 'var(--color-accent)', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)', glowColor: 'rgba(245,158,11,0.06)' },
  { label: 'Rapor İndir', desc: 'Excel ve PDF raporları', icon: Download, href: '/admin/reports', color: 'var(--color-success)', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.02) 100%)', glowColor: 'rgba(34,197,94,0.06)' },
];

const chartTooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px', boxShadow: 'var(--shadow-md)' };

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const handleSendReminder = async (assignmentId: string, staffName: string) => {
    setSendingReminder(assignmentId);
    try {
      const res = await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentIds: [assignmentId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${staffName} için email ve bildirim gönderildi`, 'success');
    } catch {
      toast('Hatırlatma gönderilemedi', 'error');
    } finally {
      setSendingReminder(null);
    }
  };
  const { data, isLoading, error, refetch } = useFetch<DashboardData>('/api/admin/dashboard');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--color-error-bg)' }}>
            <AlertTriangle className="h-6 w-6" style={{ color: 'var(--color-error)' }} />
          </div>
          <p className="mb-1 text-sm font-semibold">Veriler yüklenemedi</p>
          <p className="mb-5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{error}</p>
          <Button onClick={refetch} variant="outline" className="gap-2 rounded-xl text-sm" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
            <TrendingUp className="h-4 w-4" /> Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  const stats = (data?.stats ?? []).map(s => ({ ...s, icon: iconMap[s.icon] || Users }));
  const trendData = data?.trendData ?? [];
  const statusDistribution = data?.statusDistribution ?? [];
  const departmentComparison = data?.departmentComparison ?? [];
  const overdueTrainings = data?.overdueTrainings ?? [];
  const expiringCerts = data?.expiringCerts ?? [];
  const topPerformers = data?.topPerformers ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const complianceAlerts = data?.complianceAlerts ?? [];

  const totalAssignments = statusDistribution.reduce((s, d) => s + d.value, 0);
  const hasTrendData = trendData.some(t => t.atanan > 0 || t.tamamlanan > 0 || t.basarisiz > 0);

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <PageHeader title="Dashboard" subtitle={`${user?.department || 'Hastane'} genel durumu`} />
      </BlurFade>

      {/* Quick Actions */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="group flex items-center gap-3 rounded-xl border px-4 py-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:duration-75"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-[transform] duration-200 group-hover:scale-110"
                style={{ background: `color-mix(in srgb, ${a.color} 12%, transparent)` }}
              >
                <a.icon className="h-[18px] w-[18px]" style={{ color: a.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-tight">{a.label}</p>
                <p className="text-[11px] leading-tight truncate" style={{ color: 'var(--color-text-muted)' }}>{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </BlurFade>

      {/* G7.6 — Live In-Progress Exams */}
      <BlurFade delay={0.045}>
        <LiveExamsWidget />
      </BlurFade>

      {/* Warning Banner */}
      {(overdueTrainings.length > 0 || expiringCerts.filter(c => c.daysLeft <= 7).length > 0) && (
        <BlurFade delay={0.05}>
          <div className="relative overflow-hidden flex items-center gap-4 rounded-2xl px-6 py-4" style={{ background: 'linear-gradient(135deg, var(--color-accent), #92400e)', boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)' }}>
            <BorderBeam size={100} duration={8} colorFrom="#fbbf24" colorTo="#f59e0b" />
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{overdueTrainings.length} personelin eğitimi gecikmiş, {expiringCerts.filter(c => c.daysLeft <= 7).length} sertifika süresi dolmak üzere!</p>
              <p className="text-xs text-white/60">Acil müdahale gerekiyor.</p>
            </div>
            <Link href="/admin/reports" className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              Detayları Gör <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </BlurFade>
      )}

      {/* Acil Aksiyon Widget — Compliance Alarmları */}
      {complianceAlerts.length > 0 && (
        <BlurFade delay={0.06}>
          <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-error-bg)' }}>
                  <Shield className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Uyum Alarmları</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Zorunlu eğitim deadline yaklaşıyor</p>
                </div>
              </div>
              <Link href="/admin/compliance" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                Tümünü Gör →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {complianceAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl p-3" style={{
                  background: alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error-bg)' : 'var(--color-warning-bg, #fffbeb)',
                  border: `1px solid ${alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)'}30`,
                }}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{alert.training}</p>
                    {alert.regulatoryBody && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{alert.regulatoryBody}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold" style={{ color: alert.status === 'critical' || alert.status === 'overdue' ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)' }}>
                        {alert.status === 'overdue' ? 'Süre Doldu!' : `${alert.daysLeft} gün`}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>· %{alert.complianceRate} uyumlu</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, i) => (
          <BlurFade key={stat.title} delay={0.1 + i * 0.05}><StatCard {...stat} /></BlurFade>
        ))}
      </div>

      {/* Row: Trend Chart + Status Donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BlurFade delay={0.3} className="lg:col-span-2">
          <ChartCard title="Aylık Eğitim Trendi" icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
            {hasTrendData ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTamamlanan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="tamamlanan" name="Tamamlanan" stroke="var(--color-success)" fill="url(#gTamamlanan)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-success)', strokeWidth: 2, stroke: 'var(--color-surface)' }} />
                  <Area type="monotone" dataKey="atanan" name="Atanan" stroke="var(--color-info)" fill="transparent" strokeWidth={1.5} strokeDasharray="5 5" />
                  <Bar dataKey="basarisiz" name="Başarısız" fill="var(--color-error)" radius={[3, 3, 0, 0]} barSize={14} opacity={0.8} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz eğitim ataması yapılmamış. Personele eğitim atadıkça burada aylık trend görünecek.</div>
            )}
          </ChartCard>
        </BlurFade>

        {/* Status Donut */}
        <BlurFade delay={0.35}>
          <div className="rounded-2xl border p-6 h-full" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="text-sm font-bold mb-4">Eğitim Durum Dağılımı</h3>
            {totalAssignments > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                        {statusDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(value: unknown, name: unknown) => [`${Number(value)} (${totalAssignments > 0 ? Math.round(Number(value) / totalAssignments * 100) : 0}%)`, String(name)]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {statusDistribution.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        <span style={{ color: 'var(--color-text-secondary)' }}>{s.name}</span>
                      </div>
                      <span className="font-mono font-semibold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-center px-4" style={{ color: 'var(--color-text-muted)' }}>Personele eğitim atandığında durum dağılımı burada görünecek</div>
            )}
          </div>
        </BlurFade>
      </div>

      {/* Row: Department Comparison + Certificate Expiry */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Department Comparison */}
        <BlurFade delay={0.4}>
          <ChartCard title="Departman Karşılaştırması" icon={<Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
            {departmentComparison.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={departmentComparison} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis dataKey="dept" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="oran" name="Tamamlanma %" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-center px-4" style={{ color: 'var(--color-text-muted)' }}>Personele eğitim atandığında departman karşılaştırması burada görünecek</div>
            )}
          </ChartCard>
        </BlurFade>

        {/* Certificate Expiry Tracker */}
        <BlurFade delay={0.45}>
          <MagicCard gradientColor="rgba(220, 38, 38, 0.04)" gradientOpacity={0.4} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-error-bg)' }}>
                    <Shield className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Sertifika Süreleri</h3>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Yaklaşan sertifika yenilemeleri</p>
                  </div>
                </div>
              </div>
              {expiringCerts.length > 0 ? (
                <div className="space-y-3">
                  {expiringCerts.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 rounded-xl p-3 transition-colors duration-150 hover:bg-(--color-surface-hover)" style={{ border: '1px solid var(--color-border)' }}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: c.status === 'critical' ? 'var(--color-error-bg)' : c.status === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)' }}>
                        <CalendarClock className="h-5 w-5" style={{ color: c.status === 'critical' ? 'var(--color-error)' : c.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{c.name}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{c.cert}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{c.expiryDate}</p>
                        <p className="text-xs font-bold" style={{ color: c.status === 'critical' ? 'var(--color-error)' : c.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          {c.daysLeft} gün
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
              )}
            </div>
          </MagicCard>
        </BlurFade>
      </div>

      {/* Row: Overdue Table */}
      {overdueTrainings.length > 0 && (
        <BlurFade delay={0.5}>
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-error-bg)' }}>
                  <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Geciken Eğitimler</h3>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{overdueTrainings.length} personel eğitim süresini aşmış</p>
                </div>
              </div>
              <Link href="/admin/reports" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                Tümünü Gör
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Departman</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Tarih</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Gecikme</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {overdueTrainings.map((t, i) => (
                  <tr key={i} className="clickable-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px] font-bold text-white" style={{ background: t.color }}>{t.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                        <span className="font-semibold">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5" style={{ color: 'var(--color-text-secondary)' }}>{t.dept}</td>
                    <td className="px-4 py-3.5">{t.training}</td>
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.dueDate}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                        {t.daysOverdue} gün gecikmiş
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-lg text-xs"
                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                        disabled={sendingReminder === t.assignmentId}
                        onClick={() => handleSendReminder(t.assignmentId, t.name)}
                      >
                        <Send className="h-3 w-3" />
                        {sendingReminder === t.assignmentId ? 'Gönderiliyor...' : 'Hatırlat'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BlurFade>
      )}

      {/* Competency Matrix Widget */}
      <BlurFade delay={0.52}>
        <MatrixMiniWidget />
      </BlurFade>

      {/* Row: Top Performers + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BlurFade delay={0.55}>
          <MagicCard gradientColor="rgba(245, 158, 11, 0.04)" gradientOpacity={0.4} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent-light)' }}>
                    <Trophy className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <h3 className="text-sm font-bold">En Başarılı Personeller</h3>
                </div>
                <Link href="/admin/staff" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Tümü</Link>
              </div>
              {topPerformers.length > 0 ? (
                <div className="space-y-2">
                  {topPerformers.map((p, idx) => (
                    <div key={p.name} className="clickable-row flex items-center gap-3 rounded-xl px-3 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: idx < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{idx + 1}</div>
                      <Avatar className="h-9 w-9"><AvatarFallback className="text-xs font-semibold text-white" style={{ background: p.color }}>{p.initials}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.department}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono" style={{ color: p.score >= 95 ? 'var(--color-success)' : 'var(--color-text-primary)' }}>{p.score}%</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{p.courses} eğitim</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
              )}
            </div>
          </MagicCard>
        </BlurFade>

        <BlurFade delay={0.6}>
          <MagicCard gradientColor="rgba(13, 150, 104, 0.04)" gradientOpacity={0.4} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                    <Activity className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <h3 className="text-sm font-bold">Son Aktiviteler</h3>
                </div>
                <Link href="/admin/audit-logs" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Tümü</Link>
              </div>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${typeColors[item.type] ?? 'var(--color-info)'}15` }}>
                        <div className="h-2 w-2 rounded-full" style={{ background: typeColors[item.type] ?? 'var(--color-info)' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm"><span className="font-semibold">{item.user}</span> <span style={{ color: 'var(--color-text-secondary)' }}>{item.action}</span></p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                          <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{item.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
              )}
            </div>
          </MagicCard>
        </BlurFade>
      </div>
    </div>
  );
}
