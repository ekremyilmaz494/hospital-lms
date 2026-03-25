'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Building2, User, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface HospitalData {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  plan: string;
  expiresAt: string;
}

export default function EditHospitalPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: hospital, isLoading, error } = useFetch<HospitalData>(`/api/super-admin/hospitals/${id}`);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!hospital) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>;
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get('name'),
      address: formData.get('address'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      status: formData.get('status'),
      plan: formData.get('plan'),
      expiresAt: formData.get('expiresAt'),
    };
    try {
      const res = await fetch(`/api/super-admin/hospitals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.push(`/super-admin/hospitals/${id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader title="Hastane Düzenle" subtitle={`${hospital.name ?? ''} bilgilerini güncelle`} />
      </div>

      {saveError && (
        <div className="rounded-lg border p-3" style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
          <p className="text-sm">{saveError}</p>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Hospital Info */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <Building2 className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-lg font-bold">
                Hastane Bilgileri
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Adı *</Label>
                  <Input name="name" defaultValue={hospital.name ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Kodu</Label>
                  <Input defaultValue={hospital.code ?? ''} disabled className="mt-1.5" style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Adres</Label>
                <Input name="address" defaultValue={hospital.address ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label>
                  <Input name="phone" defaultValue={hospital.phone ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta</Label>
                  <Input name="email" defaultValue={hospital.email ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
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
              <h3 className="text-lg font-bold">
                Durum & Abonelik
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Durum</Label>
                <select name="status" defaultValue={hospital.status ?? 'active'} className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <option value="active">Aktif</option>
                  <option value="suspended">Askıda</option>
                </select>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Abonelik Planı</Label>
                <select name="plan" defaultValue={hospital.plan ?? ''} className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <option value="starter">Başlangıç</option>
                  <option value="pro">Profesyonel</option>
                  <option value="enterprise">Kurumsal</option>
                </select>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Abonelik Bitiş Tarihi</Label>
                <Input name="expiresAt" type="date" defaultValue={hospital.expiresAt ?? ''} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            İptal
          </Button>
          <Button type="submit" disabled={saving} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)' }}>
            <Save className="h-4 w-4" />
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </Button>
        </div>
      </form>
    </div>
  );
}
