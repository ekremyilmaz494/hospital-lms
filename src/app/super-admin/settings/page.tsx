'use client';

import { Settings, Mail, Palette, Shield, Save, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Platform Ayarları" subtitle="Global platform yapılandırmasını yönetin" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
              <Globe className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Genel</h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Platform Adı</Label>
              <Input defaultValue="Hastane LMS" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Platform URL</Label>
              <Input defaultValue="https://lms.hastane.com" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Depolama Limiti (GB)</Label>
              <Input type="number" defaultValue={10} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Bakım Modu</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Aktif edildiğinde tüm kullanıcılar bakım sayfasını görür</p>
              </div>
              <div className="h-6 w-11 rounded-full cursor-pointer" style={{ background: 'var(--color-border)', transition: 'background var(--transition-fast)' }}>
                <div className="h-5 w-5 translate-x-0.5 translate-y-0.5 rounded-full bg-white" style={{ boxShadow: 'var(--shadow-sm)', transition: 'transform var(--transition-fast)' }} />
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
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>E-posta (SMTP)</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Host</Label>
                <Input defaultValue="smtp.gmail.com" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Port</Label>
                <Input type="number" defaultValue={587} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Kullanıcı</Label>
              <Input defaultValue="noreply@hastanelms.com" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>SMTP Şifre</Label>
              <Input type="password" defaultValue="••••••••" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Gönderen Adı</Label>
              <Input defaultValue="Hastane LMS" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
          <Save className="h-4 w-4" /> Ayarları Kaydet
        </Button>
      </div>
    </div>
  );
}
