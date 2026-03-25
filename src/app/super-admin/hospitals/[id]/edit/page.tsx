'use client';

import { useRouter } from 'next/navigation';
import { Building2, User, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';

export default function EditHospitalPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader title="Hastane Düzenle" subtitle="Devakent Hastanesi bilgilerini güncelle" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hospital Info */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
              <Building2 className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              Hastane Bilgileri
            </h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Adı *</Label>
                <Input defaultValue="Devakent Hastanesi" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Kodu</Label>
                <Input defaultValue="DEV001" disabled className="mt-1.5" style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Adres</Label>
              <Input defaultValue="Devakent Mah. Sağlık Cad. No: 42, Ankara" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label>
                <Input defaultValue="+90 (312) 555 12 34" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta</Label>
                <Input defaultValue="info@devakent.com" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Status & Subscription */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
              <User className="h-5 w-5" style={{ color: 'var(--color-info)' }} />
            </div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              Durum & Abonelik
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Durum</Label>
              <select className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                <option value="active">Aktif</option>
                <option value="suspended">Askıda</option>
              </select>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Abonelik Planı</Label>
              <select className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                <option value="starter">Başlangıç</option>
                <option value="pro">Profesyonel</option>
                <option value="enterprise" selected>Kurumsal</option>
              </select>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Abonelik Bitiş Tarihi</Label>
              <Input type="date" defaultValue="2027-03-22" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          İptal
        </Button>
        <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)' }}>
          <Save className="h-4 w-4" />
          Değişiklikleri Kaydet
        </Button>
      </div>
    </div>
  );
}
