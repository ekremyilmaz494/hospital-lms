'use client';

import { useState, useMemo } from 'react';
import { Users, CheckCircle, Clock, Download, Check, X, Plus, Loader2, FileText, ChevronRight } from 'lucide-react';
import { KStatCard } from '@/components/admin/k-stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { exportExcel } from '@/lib/export';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/shared/toast';
import { CertificateViewerModal } from './components/certificate-viewer-modal';
import { CategoriesTab } from './components/categories-tab';
import { TargetsTab } from './components/targets-tab';
import { InspectionReportTab } from './components/inspection-report-tab';

interface SmgPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  requiredPoints: number;
  isActive: boolean;
}

interface StaffRow {
  userId: string;
  name: string;
  department: string;
  earnedPoints: number;
  requiredPoints: number;
  progress: number;
  isCompleted: boolean;
}

interface PendingActivity {
  id: string;
  title: string;
  activityType: string;
  smgPoints: number;
  completionDate: string;
  certificateUrl: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    departmentRel: { name: string } | null;
  };
}

interface ReportData {
  period: SmgPeriod | null;
  report: StaffRow[];
  stats: { totalStaff: number; completedCount: number; completionRate: number };
}

interface ActivitiesData {
  activities: PendingActivity[];
  total: number;
}

interface PeriodsData {
  periods: SmgPeriod[];
}

const activityTypeLabels: Record<string, string> = {
  EXTERNAL_TRAINING: 'Harici Eğitim',
  CONFERENCE: 'Konferans',
  PUBLICATION: 'Yayın',
  COURSE_COMPLETION: 'Kurs Tamamlama',
};

export default function AdminSmgPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'staff' | 'pending' | 'categories' | 'targets' | 'inspection'>('staff');
  const [approving, setApproving] = useState<string | null>(null);
  const [certificateActivityId, setCertificateActivityId] = useState<string | null>(null);

  // Period modal state
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [periodSubmitting, setPeriodSubmitting] = useState(false);
  const [periodForm, setPeriodForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    requiredPoints: '',
  });

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectActivityId, setRejectActivityId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Bulk approval state
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const { toast } = useToast();

  const { data: periodsData, refetch: refetchPeriods } = useFetch<PeriodsData>('/api/admin/smg/periods');
  const reportUrl = `/api/admin/smg/report${selectedPeriodId ? `?periodId=${selectedPeriodId}` : ''}`;
  const { data: reportData, isLoading: reportLoading } = useFetch<ReportData>(reportUrl);
  const activitiesUrl = activeTab === 'pending' ? '/api/admin/smg/activities?status=PENDING' : null;
  const { data: activitiesData, isLoading: activitiesLoading, refetch: refetchActivities } = useFetch<ActivitiesData>(activitiesUrl);

  const periods = periodsData?.periods ?? [];
  const report = reportData?.report ?? [];
  const stats = reportData?.stats;
  const activities = activitiesData?.activities ?? [];

  const allSelected = useMemo(
    () => activities.length > 0 && selectedActivities.size === activities.length,
    [activities.length, selectedActivities.size]
  );

  const handleApprove = async (activityId: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    setApproving(activityId);
    try {
      await fetch(`/api/admin/smg/activities/${activityId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(status === 'REJECTED' && reason ? { rejectionReason: reason } : {}),
        }),
      });
      setSelectedActivities(prev => {
        if (!prev.has(activityId)) return prev;
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
      refetchActivities?.();
    } finally {
      setApproving(null);
    }
  };

  const handleRejectClick = (activityId: string) => {
    setRejectActivityId(activityId);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectActivityId) return;
    setRejectModalOpen(false);
    await handleApprove(rejectActivityId, 'REJECTED', rejectionReason || undefined);
    setRejectActivityId(null);
    setRejectionReason('');
  };

  const handleBulkApprove = async () => {
    if (selectedActivities.size === 0) return;
    setBulkApproving(true);
    try {
      const ids = Array.from(selectedActivities);
      await Promise.all(
        ids.map(id =>
          fetch(`/api/admin/smg/activities/${id}/approve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'APPROVED' }),
          })
        )
      );
      toast(`${ids.length} aktivite onaylandı.`, 'success');
      setSelectedActivities(new Set());
      refetchActivities?.();
    } finally {
      setBulkApproving(false);
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedActivities(new Set());
    } else {
      setSelectedActivities(new Set(activities.map(a => a.id)));
    }
  };

  const toggleSelectActivity = (id: string) => {
    setSelectedActivities(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePeriodSubmit = async () => {
    if (!periodForm.name || !periodForm.startDate || !periodForm.endDate || !periodForm.requiredPoints) {
      toast('Tüm alanlar zorunludur.', 'error');
      return;
    }
    if (new Date(periodForm.startDate) >= new Date(periodForm.endDate)) {
      toast('Bitiş tarihi, başlangıç tarihinden sonra olmalıdır.', 'error');
      return;
    }
    if (Number(periodForm.requiredPoints) < 1) {
      toast('Hedef puan en az 1 olmalıdır.', 'error');
      return;
    }
    setPeriodSubmitting(true);
    try {
      const res = await fetch('/api/admin/smg/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: periodForm.name,
          startDate: periodForm.startDate,
          endDate: periodForm.endDate,
          requiredPoints: Number(periodForm.requiredPoints),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error ?? 'Dönem oluşturulurken hata oluştu.', 'error');
        return;
      }
      toast('Dönem başarıyla oluşturuldu.', 'success');
      setPeriodModalOpen(false);
      setPeriodForm({ name: '', startDate: '', endDate: '', requiredPoints: '' });
      refetchPeriods?.();
    } finally {
      setPeriodSubmitting(false);
    }
  };

  const handleExport = () => {
    exportExcel({
      headers: ['Ad Soyad', 'Departman', 'Kazanılan Puan', 'Hedef Puan', 'İlerleme %', 'Durum'],
      rows: report.map(r => [
        r.name,
        r.department,
        r.earnedPoints,
        r.requiredPoints,
        r.progress,
        r.isCompleted ? 'Tamamlandı' : 'Devam Ediyor',
      ]),
    });
  };

  if (reportLoading && !reportData) return <PageLoading />;

  const tabs = [
    { key: 'staff' as const, label: 'Personel İlerlemesi' },
    { key: 'pending' as const, label: `Bekleyen Onaylar${activities.length > 0 ? ` (${activities.length})` : ''}` },
    { key: 'categories' as const, label: 'Kategoriler' },
    { key: 'targets' as const, label: 'Hedefler' },
    { key: 'inspection' as const, label: 'SKS Denetim Raporu' },
  ];

  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span data-current="true">SMG Takibi</span>
            </div>
            <h1 className="k-page-title">SMG Takibi</h1>
            <p className="k-page-subtitle">Sürekli Mesleki Gelişim puan takibi ve dönem yönetimi.</p>
          </div>
          <div className="flex items-center gap-2">
            {periods.length > 0 && (
              <select
                value={selectedPeriodId}
                onChange={e => setSelectedPeriodId(e.target.value)}
                className="k-btn k-btn-ghost"
                style={{ paddingRight: 28 }}
              >
                <option value="">Aktif Dönem</option>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button onClick={() => setPeriodModalOpen(true)} className="k-btn k-btn-ghost">
              <Plus size={15} /> Dönem Ekle
            </button>
            <button onClick={handleExport} className="k-btn k-btn-primary">
              <Download size={15} /> Excel
            </button>
          </div>
        </header>
      </BlurFade>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BlurFade delay={0.05}>
          <KStatCard
            title="Toplam Personel"
            value={stats?.totalStaff ?? 0}
            icon={Users}
            accentColor="var(--k-primary)"
          />
        </BlurFade>
        <BlurFade delay={0.08}>
          <KStatCard
            title="Hedefe Ulaşan"
            value={`${stats?.completedCount ?? 0} (%${stats?.completionRate ?? 0})`}
            icon={CheckCircle}
            accentColor="var(--k-success)"
          />
        </BlurFade>
        <BlurFade delay={0.11}>
          <KStatCard
            title="Bekleyen Onay"
            value={activitiesData?.total ?? 0}
            icon={Clock}
            accentColor="var(--k-warning)"
          />
        </BlurFade>
      </div>

      <BlurFade delay={0.15}>
        <div className="k-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tabs */}
          <div className="k-tabs" style={{ borderBottom: '1px solid var(--k-border)', overflowX: 'auto' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="k-tab"
                data-active={activeTab === tab.key}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Personel İlerlemesi */}
          {activeTab === 'staff' && (
            <div className="overflow-x-auto">
              {reportLoading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>Yükleniyor...</div>
              ) : report.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>
                  {reportData?.period ? 'Bu dönemde henüz SMG aktivitesi kaydedilmemiş.' : 'Aktif dönem bulunamadı. Lütfen önce bir SMG dönemi oluşturun.'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface-hover)' }}>
                      {['Ad Soyad', 'Departman', 'Kazanılan', 'Hedef', 'İlerleme', 'Durum'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--k-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.map(row => (
                      <tr key={row.userId} className="transition-colors" style={{ borderBottom: '1px solid var(--k-border)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--k-text-primary)' }}>{row.name}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>{row.department}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--k-primary)' }}>{row.earnedPoints} puan</td>
                        <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>{row.requiredPoints} puan</td>
                        <td className="px-4 py-3" style={{ minWidth: 120 }}>
                          <div className="flex items-center gap-2">
                            <div className="k-progress flex-1">
                              <div
                                className="k-progress-fill"
                                data-variant={row.isCompleted ? 'success' : 'primary'}
                                style={{ width: `${row.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-9 text-right" style={{ color: 'var(--k-text-secondary)' }}>%{row.progress}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`k-badge ${row.isCompleted ? 'k-badge-success' : 'k-badge-warning'}`}>
                            {row.isCompleted ? 'Tamamlandı' : 'Devam Ediyor'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'targets' && <TargetsTab periods={periods} />}
          {activeTab === 'inspection' && <InspectionReportTab periods={periods} />}

          {/* Bekleyen Onaylar */}
          {activeTab === 'pending' && (
            <div className="overflow-x-auto">
              {/* Bulk actions bar */}
              {activities.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface-hover)' }}>
                  <button
                    onClick={handleBulkApprove}
                    disabled={selectedActivities.size === 0 || bulkApproving}
                    className="k-btn k-btn-primary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {bulkApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Tümünü Onayla ({selectedActivities.size})
                  </button>
                  <span className="text-xs" style={{ color: 'var(--k-text-muted)' }}>
                    {selectedActivities.size > 0 ? `${selectedActivities.size} seçili` : 'Onaylamak için seçin'}
                  </span>
                </div>
              )}
              {activitiesLoading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>Yükleniyor...</div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>Bekleyen aktivite onayı yok.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface-hover)' }}>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="rounded cursor-pointer"
                          style={{ accentColor: 'var(--k-primary)' }}
                        />
                      </th>
                      {['Aktivite', 'Personel', 'Departman', 'Tip', 'Puan', 'Tarih', 'Sertifika', 'İşlem'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--k-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--k-border)' }}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedActivities.has(a.id)}
                            onChange={() => toggleSelectActivity(a.id)}
                            className="rounded cursor-pointer"
                            style={{ accentColor: 'var(--k-primary)' }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium max-w-xs truncate" style={{ color: 'var(--k-text-primary)' }}>{a.title}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>{a.user.firstName} {a.user.lastName}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>{a.user.departmentRel?.name ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span className="k-badge k-badge-muted">
                            {activityTypeLabels[a.activityType] ?? a.activityType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--k-primary)' }}>{a.smgPoints}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--k-text-muted)' }}>
                          {new Date(a.completionDate).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-4 py-3">
                          {a.certificateUrl ? (
                            <button
                              onClick={() => setCertificateActivityId(a.id)}
                              className="k-btn k-btn-ghost"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                            >
                              <FileText className="h-3.5 w-3.5" /> Görüntüle
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--k-text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={approving === a.id}
                              onClick={() => handleApprove(a.id, 'APPROVED')}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{ background: 'color-mix(in srgb, var(--k-success) 14%, transparent)', color: 'var(--k-success)' }}
                            >
                              <Check className="h-3.5 w-3.5" /> Onayla
                            </button>
                            <button
                              disabled={approving === a.id}
                              onClick={() => handleRejectClick(a.id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{ background: 'color-mix(in srgb, var(--k-error) 14%, transparent)', color: 'var(--k-error)' }}
                            >
                              <X className="h-3.5 w-3.5" /> Reddet
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </BlurFade>

      {/* Dönem Ekle Modal */}
      <Dialog open={periodModalOpen} onOpenChange={setPeriodModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Dönem Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--k-text-secondary)' }}>Dönem Adı *</label>
              <input
                type="text"
                value={periodForm.name}
                onChange={e => setPeriodForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Örn: 2026 Yılı SMG Dönemi"
                className="k-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--k-text-secondary)' }}>Başlangıç Tarihi *</label>
                <input
                  type="date"
                  value={periodForm.startDate}
                  onChange={e => setPeriodForm(f => ({ ...f, startDate: e.target.value }))}
                  className="k-input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--k-text-secondary)' }}>Bitiş Tarihi *</label>
                <input
                  type="date"
                  value={periodForm.endDate}
                  onChange={e => setPeriodForm(f => ({ ...f, endDate: e.target.value }))}
                  className="k-input"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--k-text-secondary)' }}>Hedef Puan *</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={periodForm.requiredPoints}
                onChange={e => setPeriodForm(f => ({ ...f, requiredPoints: e.target.value }))}
                placeholder="Örn: 50"
                className="k-input"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPeriodModalOpen(false)}
              disabled={periodSubmitting}
              className="k-btn k-btn-ghost"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handlePeriodSubmit}
              disabled={periodSubmitting}
              className="k-btn k-btn-primary"
            >
              {periodSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Oluştur
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sertifika Görüntüleyici */}
      <CertificateViewerModal
        activityId={certificateActivityId}
        open={certificateActivityId !== null}
        onOpenChange={(open) => { if (!open) setCertificateActivityId(null); }}
      />

      {/* Reddet Nedeni Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Aktiviteyi Reddet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--k-text-secondary)' }}>Red Nedeni (opsiyonel)</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reddetme nedeninizi yazın..."
                maxLength={500}
                rows={3}
                className="k-input"
                style={{ resize: 'none' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--k-text-muted)' }}>{rejectionReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="k-btn k-btn-ghost"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleRejectConfirm}
              className="k-btn k-btn-primary"
              style={{ background: 'var(--k-error)' }}
            >
              <X className="h-4 w-4" /> Reddet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
