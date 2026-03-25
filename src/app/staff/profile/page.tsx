'use client';
import { User, Mail, Phone, Building2, Shield, Camera, Save } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Profilim" subtitle="Kişisel bilgilerinizi görüntüleyin ve düzenleyin" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="rounded-xl border p-6 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="relative mx-auto mb-4 h-24 w-24">
            <Avatar className="h-24 w-24"><AvatarFallback className="text-2xl font-bold text-white" style={{ background: 'var(--color-primary)' }}>EK</AvatarFallback></Avatar>
            <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white" style={{ background: 'var(--color-primary)' }}><Camera className="h-4 w-4 text-white" /></button>
          </div>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Elif Kaya</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Baş Hemşire</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Hemşirelik Departmanı</p>

          <Separator className="my-4" style={{ background: 'var(--color-border)' }} />

          <div className="space-y-2 text-sm text-left">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} /><span style={{ color: 'var(--color-text-secondary)' }}>elif@devakent.com</span></div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} /><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>+90 (555) 123 45 67</span></div>
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} /><span style={{ color: 'var(--color-text-secondary)' }}>Devakent Hastanesi</span></div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} /><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>12345678901</span></div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-5 text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Kişisel Bilgiler</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label style={{ color: 'var(--color-text-secondary)' }}>Ad</Label><Input defaultValue="Elif" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
                <div><Label style={{ color: 'var(--color-text-secondary)' }}>Soyad</Label><Input defaultValue="Kaya" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
              </div>
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>E-posta</Label><Input defaultValue="elif@devakent.com" disabled className="mt-1.5" style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)' }} /></div>
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label><Input defaultValue="+90 (555) 123 45 67" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-5 text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Şifre Değiştir</h3>
            <div className="space-y-4">
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Mevcut Şifre</Label><Input type="password" placeholder="••••••••" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Yeni Şifre</Label><Input type="password" placeholder="••••••••" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Yeni Şifre (Tekrar)</Label><Input type="password" placeholder="••••••••" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
            </div>
          </div>

          <div className="flex justify-end"><Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}><Save className="h-4 w-4" /> Değişiklikleri Kaydet</Button></div>
        </div>
      </div>
    </div>
  );
}
