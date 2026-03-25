'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface SettingsData {
  defaultPassingScore: number;
  defaultMaxAttempts: number;
  defaultExamDuration: number;
  hospitalName: string;
  logoUrl: string;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading, error } = useFetch<SettingsData>('/api/admin/settings');
  const [formData, setFormData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setFormData(data);
  }, [data]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!formData) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Ayarlar yüklenemedi</div></div>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ayarlar" subtitle="Hastane LMS ayarlarını yapılandırın" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BlurFade delay={0.05}>
          <MagicCard gradientColor="rgba(13, 150, 104, 0.04)" gradientOpacity={0.3} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                  <Settings className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-base font-bold">Eğitim Varsayılanları</h3>
              </div>
              <div className="space-y-5">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Baraj Puanı</Label>
                  <Input type="number" value={formData.defaultPassingScore} onChange={(e) => setFormData({ ...formData, defaultPassingScore: Number(e.target.value) })} className="h-11 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Deneme Hakkı</Label>
                  <Input type="number" value={formData.defaultMaxAttempts} onChange={(e) => setFormData({ ...formData, defaultMaxAttempts: Number(e.target.value) })} className="h-11 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Sınav Süresi (dk)</Label>
                  <Input type="number" value={formData.defaultExamDuration} onChange={(e) => setFormData({ ...formData, defaultExamDuration: Number(e.target.value) })} className="h-11 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                </div>
              </div>
            </div>
          </MagicCard>
        </BlurFade>

        <BlurFade delay={0.1}>
          <MagicCard gradientColor="rgba(245, 158, 11, 0.04)" gradientOpacity={0.3} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent-light)' }}>
                  <Palette className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 className="text-base font-bold">Marka & Görünüm</h3>
              </div>
              <div className="space-y-5">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Hastane Adı</Label>
                  <Input value={formData.hospitalName} onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Logo URL</Label>
                  <Input value={formData.logoUrl ?? ''} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} placeholder="https://..." className="h-11 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                </div>
              </div>
            </div>
          </MagicCard>
        </BlurFade>
      </div>

      <BlurFade delay={0.15}>
        <div className="flex justify-end">
          <ShimmerButton
            onClick={handleSave}
            disabled={saving || saved}
            className="gap-2 text-sm font-semibold"
            borderRadius="12px"
            background={saved ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #0d9668, #065f46)'}
            shimmerColor="rgba(255,255,255,0.15)"
          >
            {saving ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Kaydediliyor...</>
            ) : saved ? (
              <><Save className="h-4 w-4" /> Kaydedildi!</>
            ) : (
              <><Save className="h-4 w-4" /> Ayarları Kaydet</>
            )}
          </ShimmerButton>
        </div>
      </BlurFade>
    </div>
  );
}
