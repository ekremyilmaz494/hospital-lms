'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, CreditCard, ArrowLeft, Save } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';

interface Plan { id: string; name: string; slug: string; priceMonthly: number | null }
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';

export default function NewHospitalPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { data: plansData } = useFetch<{ plans: Plan[] }>('/api/super-admin/subscriptions');
  const plans = plansData?.plans ?? [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const formData = new FormData(e.currentTarget);
    const planId = formData.get('planId') as string | null;
    const body = {
      name: formData.get('name'),
      code: formData.get('code'),
      address: formData.get('address'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      adminFirstName: formData.get('adminFirstName'),
      adminLastName: formData.get('adminLastName'),
      adminEmail: formData.get('adminEmail'),
      adminPassword: formData.get('adminPassword'),
      ...(planId && { planId }),
      trialDays: Number(formData.get('trialDays') ?? 14),
    };
    try {
      const res = await fetch('/api/super-admin/hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      router.push(`/super-admin/hospitals/${created.id ?? ''}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader title="Yeni Hastane Ekle" subtitle="Hastane bilgilerini girin ve admin hesabı oluşturun" />
      </div>

      {saveError && (
        <div className="rounded-lg border p-3" style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
          <p className="text-sm">{saveError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Hospital Info */}
          <div
            className="rounded-xl border p-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
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
                  <Input name="name" placeholder="Devakent Hastanesi" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Kodu *</Label>
                  <Input name="code" placeholder="DEV001" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Adres</Label>
                <Input name="address" placeholder="Hastane adresi..." className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label>
                  <Input name="phone" placeholder="+90 (xxx) xxx xx xx" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta</Label>
                  <Input name="email" placeholder="info@hastane.com" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Admin Account */}
          <div
            className="rounded-xl border p-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-accent-light)' }}>
                <User className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="text-lg font-bold">
                Admin Hesabı
              </h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Ad *</Label>
                  <Input name="adminFirstName" placeholder="Ahmet" autoComplete="given-name" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Soyad *</Label>
                  <Input name="adminLastName" placeholder="Yılmaz" autoComplete="family-name" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta *</Label>
                <Input name="adminEmail" placeholder="admin@hastane.com" type="email" autoComplete="email" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Şifre *</Label>
                <Input name="adminPassword" placeholder="••••••••" type="password" autoComplete="new-password" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
            </div>

            <Separator className="my-5" style={{ background: 'var(--color-border)' }} />

            {/* Subscription */}
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
                <CreditCard className="h-5 w-5" style={{ color: 'var(--color-info)' }} />
              </div>
              <h3 className="text-lg font-bold">
                Abonelik
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Abonelik Planı *</Label>
                <select
                  name="planId"
                  className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Plan seçin (isteğe bağlı)...</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.priceMonthly ? ` — ₺${p.priceMonthly}/ay` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Deneme Süresi (Gün)</Label>
                <Input name="trialDays" type="number" defaultValue={14} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            İptal
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="gap-2 font-semibold text-white"
            style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)' }}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Oluşturuluyor...' : 'Hastane Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  );
}
