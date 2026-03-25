'use client';
import { Settings, Save, Palette, Bell, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ayarlar" subtitle="Hastane LMS ayarlarını yapılandırın" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-5 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}><Settings className="h-5 w-5" style={{ color: 'var(--color-primary)' }} /></div><h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Eğitim Varsayılanları</h3></div>
          <div className="space-y-4">
            <div><Label style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Baraj Puanı</Label><Input type="number" defaultValue={70} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
            <div><Label style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Deneme Hakkı</Label><Input type="number" defaultValue={3} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
            <div><Label style={{ color: 'var(--color-text-secondary)' }}>Varsayılan Sınav Süresi (dk)</Label><Input type="number" defaultValue={30} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
          </div>
        </div>
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-5 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-accent-light)' }}><Palette className="h-5 w-5" style={{ color: 'var(--color-accent)' }} /></div><h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Marka & Görünüm</h3></div>
          <div className="space-y-4">
            <div><Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Adı</Label><Input defaultValue="Devakent Hastanesi" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
            <div><Label style={{ color: 'var(--color-text-secondary)' }}>Logo URL</Label><Input placeholder="https://..." className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-end"><Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}><Save className="h-4 w-4" /> Ayarları Kaydet</Button></div>
    </div>
  );
}
