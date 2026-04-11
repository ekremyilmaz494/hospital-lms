'use client';

import { useState } from 'react';
import { Settings, Mail, Palette, Shield, Save, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface SettingsData {
  platformName: string;
  platformUrl: string;
  defaultStorageLimit: number;
  maintenanceMode: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  senderName: string;
}

export default function SettingsPage() {
  const { data: settings, isLoading, error } = useFetch<SettingsData>('/api/super-admin/settings');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const isMaintenance = maintenanceMode ?? settings?.maintenanceMode ?? false;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const formData = new FormData(e.currentTarget);
    const body = {
      platformName: formData.get('platformName'),
      platformUrl: formData.get('platformUrl'),
      defaultStorageLimit: Number(formData.get('defaultStorageLimit') ?? 10),
      maintenanceMode: isMaintenance,
      smtpHost: formData.get('smtpHost'),
      smtpPort: Number(formData.get('smtpPort') ?? 587),
      smtpUser: formData.get('smtpUser'),
      smtpPassword: formData.get('smtpPassword'),
      senderName: formData.get('senderName'),
    };
    try {
      const res = await fetch('/api/super-admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Ayarları" subtitle="Global platform yapılandırmasını yönetin" />

      {saveError && (
        <div className="rounded-lg border p-3" style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
          <p className="text-sm">{saveError}</p>
        </div>
      )}
      {saveSuccess && (
        <div className="rounded-lg border p-3" style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
          <p className="text-sm">Ayarlar başarıyla kaydedildi.</p>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* General */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <Globe className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-lg font-bold">Genel</h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Platform Adı</Label>
                <Input name="platformName" defaultValue={settings?.platformName ?? 'Devakent Hastanesi'} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Platform URL</Label>
                <Input name="platformUrl" defaultValue={settings?.platformUrl ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Depolama Limiti (GB)</Label>
                <Input name="defaultStorageLimit" type="number" defaultValue={settings?.defaultStorageLimit ?? 10} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Bakım Modu</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Aktif edildiğinde tüm kullanıcılar bakım sayfasını görür</p>
                </div>
                <div
                  className="h-6 w-11 rounded-full cursor-pointer"
                  style={{ background: isMaintenance ? 'var(--color-primary)' : 'var(--color-border)', transition: 'background var(--transition-fast)' }}
                  onClick={() => setMaintenanceMode(!isMaintenance)}
                >
                  <div className="h-5 w-5 rounded-full bg-white" style={{ boxShadow: 'var(--shadow-sm)', transition: 'transform var(--transition-fast)', transform: isMaintenance ? 'translate(22px, 2px)' : 'translate(2px, 2px)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* SMTP */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-accent-light)' }}>
                <Mail className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="text-lg font-bold">E-posta (SMTP)</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Host</Label>
                  <Input name="smtpHost" defaultValue={settings?.smtpHost ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Port</Label>
                  <Input name="smtpPort" type="number" defaultValue={settings?.smtpPort ?? 587} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Kullanıcı</Label>
                <Input name="smtpUser" defaultValue={settings?.smtpUser ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Şifre</Label>
                <Input name="smtpPassword" type="password" defaultValue={settings?.smtpPassword ?? ''} autoComplete="off" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Gönderen Adı</Label>
                <Input name="senderName" defaultValue={settings?.senderName ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={saving} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
            <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </Button>
        </div>
      </form>
    </div>
  );
}
