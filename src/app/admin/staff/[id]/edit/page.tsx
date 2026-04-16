'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, User, Building2, Phone, Mail, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface StaffEditData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string | null;
  departmentId: string | null;
  title: string;
  initials: string;
  isActive: boolean;
}

interface Dept {
  id: string;
  name: string;
}

export default function EditStaffPage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data, isLoading, error } = useFetch<StaffEditData>(id ? `/api/admin/staff/${id}?fields=edit` : null);
  const { data: deptsData } = useFetch<Dept[]>('/api/admin/departments');
  const [formData, setFormData] = useState<StaffEditData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setFormData({ ...data });
  }, [data]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!formData) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Personel bulunamadı</div></div>;
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Ad zorunludur';
    if (!formData.lastName.trim()) e.lastName = 'Soyad zorunludur';
    if (formData.phone && !/^0\d{10}$/.test(formData.phone.replace(/\s/g, ''))) e.phone = 'Geçerli telefon formatı: 05XX XXX XX XX';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, departmentId: formData.departmentId || undefined, department: formData.department || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      setSaved(true);
      setTimeout(() => router.push('/admin/staff'), 1000);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string | boolean | null) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const departments = deptsData ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="text-sm font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                {formData.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Personel Düzenle</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{formData.firstName} {formData.lastName}</p>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Personal Info */}
      <BlurFade delay={0.05}>
        <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
              <User className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-base font-bold">Kişisel Bilgiler</h3>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Ad *</Label>
                <Input value={formData.firstName} onChange={(e) => update('firstName', e.target.value)} autoComplete="given-name" className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: errors.firstName ? 'var(--color-error)' : 'var(--color-border)' }} />
                {errors.firstName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.firstName}</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Soyad *</Label>
                <Input value={formData.lastName} onChange={(e) => update('lastName', e.target.value)} autoComplete="family-name" className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: errors.lastName ? 'var(--color-error)' : 'var(--color-border)' }} />
                {errors.lastName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.lastName}</p>}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Mail className="h-3.5 w-3.5" /> E-posta
              </Label>
              <Input value={formData.email} disabled autoComplete="email" className="h-11 rounded-xl" style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)' }} />
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>E-posta adresi değiştirilemez</p>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Phone className="h-3.5 w-3.5" /> Telefon
              </Label>
              <Input value={formData.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: errors.phone ? 'var(--color-error)' : 'var(--color-border)' }} />
              {errors.phone && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.phone}</p>}
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Work Info */}
      <BlurFade delay={0.1}>
        <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent-light)' }}>
              <Briefcase className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h3 className="text-base font-bold">Görev Bilgileri</h3>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <Building2 className="h-3.5 w-3.5" /> Departman
                </Label>
                <select
                  value={formData.departmentId || formData.department || ''}
                  onChange={(e) => {
                    update('departmentId', e.target.value);
                    const selectedName = departments.find(d => d.id === e.target.value)?.name;
                    if (selectedName) update('department', selectedName);
                  }}
                  className="h-11 w-full rounded-xl border px-3 text-sm"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Seçin...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Unvan</Label>
                <Input value={formData.title} onChange={(e) => update('title', e.target.value)} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => update('isActive', e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span className="text-sm font-medium">Aktif personel</span>
                </label>
                {!formData.isActive && (
                  <span className="text-xs rounded-full px-2.5 py-0.5 font-semibold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>Pasif</span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed ml-6" style={{ color: 'var(--color-text-muted)' }}>
                Pasif yapılan personel sisteme giriş yapamaz, eğitimlere erişemez ve raporlarda görünmez.
              </p>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Actions */}
      <BlurFade delay={0.15}>
        <div className="flex items-center justify-between">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => router.back()} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            İptal
          </Button>
          <ShimmerButton
            onClick={handleSave}
            disabled={saving || saved}
            className="gap-2 text-sm font-semibold"
            borderRadius="12px"
            background={saved ? 'linear-gradient(135deg, var(--brand-600), #047857)' : 'linear-gradient(135deg, var(--brand-600), var(--brand-800))'}
            shimmerColor="rgba(255,255,255,0.15)"
          >
            {saving ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Kaydediliyor...</>
            ) : saved ? (
              <><Save className="h-4 w-4" /> Kaydedildi!</>
            ) : (
              <><Save className="h-4 w-4" /> Değişiklikleri Kaydet</>
            )}
          </ShimmerButton>
        </div>
      </BlurFade>
    </div>
  );
}
