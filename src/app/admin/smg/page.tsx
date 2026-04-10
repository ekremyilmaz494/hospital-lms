'use client';

import { useState, useMemo } from 'react';
import { Star, Users, CheckCircle, Clock, Download, Check, X, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { exportExcel } from '@/lib/export';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';

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
  const [activeTab, setActiveTab] = useState<'staff' | 'pending'>('staff');
  const [approving, setApproving] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="relative overflow-hidden rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10" style={{ background: 'white' }} />
          <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Star className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">SMG Takibi</h1>
                <p className="text-indigo-200 text-sm">Sürekli Mesleki Gelişim puan takibi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {periods.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedPeriodId}
                    onChange={e => setSelectedPeriodId(e.target.value)}
                    className="appearance-none text-sm font-medium rounded-xl px-4 py-2 pr-8 border-0 outline-none cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
                  >
                    <option value="" style={{ background: '#4f46e5' }}>Aktif Dönem</option>
                    {periods.map(p => (
                      <option key={p.id} value={p.id} style={{ background: '#4f46e5' }}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-white pointer-events-none" />
                </div>
              )}
              <button
                onClick={() => setPeriodModalOpen(true)}
                className="flex items-center gap-1.5 text-sm font-medium rounded-xl px-4 py-2 transition-colors"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              >
                <Plus className="h-4 w-4" /> Dönem Ekle
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 text-sm font-medium rounded-xl px-4 py-2 transition-colors"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              >
                <Download className="h-4 w-4" /> Excel
              </button>
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: 'Toplam Personel', value: stats?.totalStaff ?? 0, icon: Users, accentColor: 'var(--color-primary)' },
          { title: 'Hedefe Ulaşan', value: `${stats?.completedCount ?? 0} (%${stats?.completionRate ?? 0})`, icon: CheckCircle, accentColor: 'var(--color-success)' },
          { title: 'Bekleyen Onay', value: activitiesData?.total ?? 0, icon: Clock, accentColor: 'var(--color-warning)' },
        ].map((s, i) => (
          <BlurFade key={s.title} delay={0.05 + i * 0.03}><StatCard {...s} /></BlurFade>
        ))}
      </div>

      <BlurFade delay={0.15}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
            {(['staff', 'pending'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-3.5 text-sm font-semibold transition-colors"
                style={{
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                }}
              >
                {tab === 'staff' ? 'Personel İlerlemesi' : `Bekleyen Onaylar${activities.length > 0 ? ` (${activities.length})` : ''}`}
              </button>
            ))}
          </div>

          {/* Personel İlerlemesi */}
          {activeTab === 'staff' && (
            <div className="overflow-x-auto">
              {reportLoading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Yükleniyor...</div>
              ) : report.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {reportData?.period ? 'Bu dönemde henüz SMG aktivitesi kaydedilmemiş.' : 'Aktif dönem bulunamadı. Lütfen önce bir SMG dönemi oluşturun.'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                      {['Ad Soyad', 'Departman', 'Kazanılan', 'Hedef', 'İlerleme', 'Durum'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.map(row => (
                      <tr key={row.userId} className="transition-colors" style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{row.name}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.department}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-primary)' }}>{row.earnedPoints} puan</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.requiredPoints} puan</td>
                        <td className="px-4 py-3" style={{ minWidth: 120 }}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'var(--color-border)' }}>
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${row.progress}%`,
                                  background: row.isCompleted ? 'var(--color-success)' : 'var(--color-primary)',
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium w-9 text-right" style={{ color: 'var(--color-text-secondary)' }}>%{row.progress}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              background: row.isCompleted ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                              color: row.isCompleted ? 'var(--color-success)' : 'var(--color-warning)',
                            }}
                          >
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

          {/* Bekleyen Onaylar */}
          {activeTab === 'pending' && (
            <div className="overflow-x-auto">
              {/* Bulk actions bar */}
              {activities.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
                  <button
                    onClick={handleBulkApprove}
                    disabled={selectedActivities.size === 0 || bulkApproving}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
                  >
                    {bulkApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Tümünü Onayla ({selectedActivities.size})
                  </button>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {selectedActivities.size > 0 ? `${selectedActivities.size} seçili` : 'Onaylamak için seçin'}
                  </span>
                </div>
              )}
              {activitiesLoading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Yükleniyor...</div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Bekleyen aktivite onayı yok.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="rounded cursor-pointer"
                          style={{ accentColor: 'var(--color-primary)' }}
                        />
                      </th>
                      {['Aktivite', 'Personel', 'Departman', 'Tip', 'Puan', 'Tarih', 'İşlem'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedActivities.has(a.id)}
                            onChange={() => toggleSelectActivity(a.id)}
                            className="rounded cursor-pointer"
                            style={{ accentColor: 'var(--color-primary)' }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium max-w-xs truncate" style={{ color: 'var(--color-text)' }}>{a.title}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{a.user.firstName} {a.user.lastName}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{a.user.departmentRel?.name ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                            {activityTypeLabels[a.activityType] ?? a.activityType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-primary)' }}>{a.smgPoints}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(a.completionDate).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={approving === a.id}
                              onClick={() => handleApprove(a.id, 'APPROVED')}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
                            >
                              <Check className="h-3.5 w-3.5" /> Onayla
                            </button>
                            <button
                              disabled={approving === a.id}
                              onClick={() => handleRejectClick(a.id)}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
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
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Dönem Adı *</label>
              <Input
                value={periodForm.name}
                onChange={e => setPeriodForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Örn: 2026 Yılı SMG Dönemi"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Başlangıç Tarihi *</label>
                <Input
                  type="date"
                  value={periodForm.startDate}
                  onChange={e => setPeriodForm(f => ({ ...f, startDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Bitiş Tarihi *</label>
                <Input
                  type="date"
                  value={periodForm.endDate}
                  onChange={e => setPeriodForm(f => ({ ...f, endDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Hedef Puan *</label>
              <Input
                type="number"
                min={1}
                max={9999}
                value={periodForm.requiredPoints}
                onChange={e => setPeriodForm(f => ({ ...f, requiredPoints: e.target.value }))}
                placeholder="Örn: 50"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPeriodModalOpen(false)} disabled={periodSubmitting} className="rounded-xl">
              İptal
            </Button>
            <Button onClick={handlePeriodSubmit} disabled={periodSubmitting} className="gap-1.5 rounded-xl">
              {periodSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reddet Nedeni Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Aktiviteyi Reddet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Red Nedeni (opsiyonel)</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reddetme nedeninizi yazın..."
                maxLength={500}
                rows={3}
                className="w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{rejectionReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)} className="rounded-xl">
              İptal
            </Button>
            <Button
              onClick={handleRejectConfirm}
              className="gap-1.5 rounded-xl"
              style={{ background: 'var(--color-error)', color: 'white' }}
            >
              <X className="h-4 w-4" /> Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
