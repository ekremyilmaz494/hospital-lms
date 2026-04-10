'use client';

import { useState } from 'react';
import { Star, Plus, Loader2, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';

interface SmgPeriodSummary { id: string; name: string; isActive: boolean; }

interface SmgActivity {
  id: string;
  title: string;
  activityType: string;
  completionDate: string;
  smgPoints: number;
  approvalStatus: string;
  provider: string | null;
  rejectionReason: string | null;
}

interface MyPointsData {
  period: { id: string; name: string; requiredPoints: number; endDate: string } | null;
  periods: SmgPeriodSummary[];
  approvedPoints: number;
  pendingPoints: number;
  requiredPoints: number;
  remainingPoints: number;
  daysLeft: number | null;
  progress: number;
  approvedActivities: SmgActivity[];
  pendingActivities: SmgActivity[];
  rejectedActivities: SmgActivity[];
}

const activityTypeLabels: Record<string, string> = {
  EXTERNAL_TRAINING: 'Harici Eğitim',
  CONFERENCE: 'Konferans',
  PUBLICATION: 'Yayın',
  COURSE_COMPLETION: 'Kurs Tamamlama',
};

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  APPROVED: { label: 'Onaylı', bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  PENDING: { label: 'Bekliyor', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  REJECTED: { label: 'Reddedildi', bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
};

export default function StaffSmgPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    activityType: 'EXTERNAL_TRAINING',
    title: '',
    provider: '',
    completionDate: '',
    smgPoints: '',
    certificateUrl: '',
  });
  const { toast } = useToast();

  const pointsUrl = `/api/staff/smg/my-points${selectedPeriodId ? `?periodId=${selectedPeriodId}` : ''}`;
  const { data, isLoading, refetch } = useFetch<MyPointsData>(pointsUrl);

  const handleSubmit = async () => {
    if (!form.title || !form.completionDate || !form.smgPoints) {
      toast('Başlık, tarih ve puan alanları zorunludur.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/smg/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          smgPoints: Number(form.smgPoints),
          certificateUrl: form.certificateUrl || undefined,
          provider: form.provider || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error ?? 'Bir hata oluştu.', 'error');
        return;
      }
      toast('Aktivite başarıyla eklendi. Onay bekleniyor.', 'success');
      setModalOpen(false);
      setForm({ activityType: 'EXTERNAL_TRAINING', title: '', provider: '', completionDate: '', smgPoints: '', certificateUrl: '' });
      refetch?.();
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !data) return <PageLoading />;

  const approved = data?.approvedPoints ?? 0;
  const pending = data?.pendingPoints ?? 0;
  const remaining = data?.remainingPoints ?? 0;
  const required = data?.requiredPoints ?? 0;

  const donutData = required > 0
    ? [
        { name: 'Onaylı', value: approved },
        { name: 'Bekleyen', value: pending },
        { name: 'Kalan', value: remaining },
      ].filter(d => d.value > 0)
    : [{ name: 'Veri yok', value: 1 }];

  const donutColors = ['var(--color-success)', 'var(--color-warning)', 'var(--color-border)'];

  const allActivities = [...(data?.approvedActivities ?? []), ...(data?.pendingActivities ?? []), ...(data?.rejectedActivities ?? [])]
    .sort((a, b) => new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime());

  const periods = data?.periods ?? [];

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader title="SMG Puanlarım" subtitle="Sürekli Mesleki Gelişim aktiviteleriniz ve puanlarınız" />
          <div className="flex items-center gap-2">
            {periods.length > 0 && (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={selectedPeriodId}
                  onChange={e => setSelectedPeriodId(e.target.value)}
                  className="text-sm rounded-xl px-3 py-2 pr-7 border appearance-none outline-none cursor-pointer w-full min-h-[44px] sm:min-h-0 sm:w-auto"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  <option value="">Aktif Dönem</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            )}
            <Button onClick={() => setModalOpen(true)} size="sm" className="gap-1.5 rounded-xl w-full sm:w-auto min-h-[44px] sm:min-h-0">
              <Plus className="h-4 w-4" /> Aktivite Ekle
            </Button>
          </div>
        </div>
      </BlurFade>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Donut Chart */}
        <BlurFade delay={0.05}>
          <div className="rounded-2xl border p-5 flex flex-col items-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-4 self-start">
              <Star className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {data?.period?.name ?? 'Dönem Seçilmedi'}
              </span>
            </div>
            <div className="relative w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={2} dataKey="value" stroke="none">
                    {donutData.map((_, i) => <Cell key={i} fill={donutColors[i % donutColors.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} puan`, name]}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{approved}</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/ {required} puan</span>
              </div>
            </div>
            <div className="mt-4 w-full space-y-1.5">
              {[
                { label: 'Onaylı', value: approved, color: 'var(--color-success)' },
                { label: 'Bekleyen', value: pending, color: 'var(--color-warning)' },
                { label: 'Kalan', value: remaining, color: 'var(--color-text-muted)' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{item.value} puan</span>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>

        {/* Stat Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 content-start">
          {[
            { title: 'Onaylı Puan', value: approved, icon: Star, accentColor: 'var(--color-success)' },
            { title: 'Bekleyen Aktivite', value: data?.pendingActivities.length ?? 0, icon: Loader2, accentColor: 'var(--color-warning)' },
            { title: 'Kalan Gün', value: data?.daysLeft != null ? `${data.daysLeft} gün` : '-', icon: Star, accentColor: 'var(--color-primary)' },
          ].map((s, i) => (
            <BlurFade key={s.title} delay={0.08 + i * 0.03}><StatCard {...s} /></BlurFade>
          ))}

          {/* Aktiviteler listesi */}
          <BlurFade delay={0.2} className="sm:col-span-2 md:col-span-3">
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Aktivitelerim</h3>
              </div>
              {allActivities.length === 0 ? (
                <div className="p-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>SMG aktivitesi eklemek için 'Aktivite Ekle' butonunu kullanın.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {allActivities.map(a => {
                    const s = statusConfig[a.approvalStatus] ?? statusConfig.PENDING;
                    return (
                      <div key={a.id} className="px-4 py-3 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{a.title}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                              {activityTypeLabels[a.activityType] ?? a.activityType} · {new Date(a.completionDate).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{a.smgPoints} p</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                          </div>
                        </div>
                        {a.approvalStatus === 'REJECTED' && a.rejectionReason && (
                          <p className="text-xs mt-0.5 pl-0.5" style={{ color: 'var(--color-error)' }}>
                            Red nedeni: {a.rejectionReason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </BlurFade>
        </div>
      </div>

      {/* Aktivite Ekle Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Aktivite Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Aktivite Tipi</label>
              <select
                value={form.activityType}
                onChange={e => setForm(f => ({ ...f, activityType: e.target.value }))}
                className="w-full text-sm rounded-xl px-3 py-2 border outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                <option value="EXTERNAL_TRAINING">Harici Eğitim</option>
                <option value="CONFERENCE">Konferans</option>
                <option value="PUBLICATION">Yayın</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Başlık *</label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Aktivite başlığı"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Sağlayıcı / Kurum</label>
              <Input
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                placeholder="Üniversite, dernek, kurum adı"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Tamamlanma Tarihi *</label>
                <Input
                  type="date"
                  value={form.completionDate}
                  onChange={e => setForm(f => ({ ...f, completionDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>SMG Puanı *</label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={form.smgPoints}
                  onChange={e => setForm(f => ({ ...f, smgPoints: e.target.value }))}
                  placeholder="1–999"
                  className="rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Sertifika URL (opsiyonel)</label>
              <Input
                value={form.certificateUrl}
                onChange={e => setForm(f => ({ ...f, certificateUrl: e.target.value }))}
                placeholder="https://..."
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting} className="rounded-xl">
              İptal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5 rounded-xl">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
