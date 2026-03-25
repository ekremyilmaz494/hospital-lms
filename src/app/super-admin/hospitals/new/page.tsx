'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, CreditCard, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';

export default function NewHospitalPage() {
  const router = useRouter();

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
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              Hastane Bilgileri
            </h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Adı *</Label>
                <Input placeholder="Devakent Hastanesi" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Hastane Kodu *</Label>
                <Input placeholder="DEV001" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Adres</Label>
              <Input placeholder="Hastane adresi..." className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label>
                <Input placeholder="+90 (xxx) xxx xx xx" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta</Label>
                <Input placeholder="info@hastane.com" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
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
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              Admin Hesabı
            </h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Ad *</Label>
                <Input placeholder="Ahmet" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Soyad *</Label>
                <Input placeholder="Yılmaz" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta *</Label>
              <Input placeholder="admin@hastane.com" type="email" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Şifre *</Label>
              <Input placeholder="••••••••" type="password" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
            </div>
          </div>

          <Separator className="my-5" style={{ background: 'var(--color-border)' }} />

          {/* Subscription */}
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
              <CreditCard className="h-5 w-5" style={{ color: 'var(--color-info)' }} />
            </div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              Abonelik
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Abonelik Planı *</Label>
              <select
                className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <option value="">Plan seçin...</option>
                <option value="starter">Başlangıç</option>
                <option value="pro">Profesyonel</option>
                <option value="enterprise">Kurumsal</option>
              </select>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Deneme Süresi (Gün)</Label>
              <Input type="number" defaultValue={14} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.back()}
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          İptal
        </Button>
        <Button
          className="gap-2 font-semibold text-white"
          style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)' }}
        >
          <Save className="h-4 w-4" />
          Hastane Oluştur
        </Button>
      </div>
    </div>
  );
}
