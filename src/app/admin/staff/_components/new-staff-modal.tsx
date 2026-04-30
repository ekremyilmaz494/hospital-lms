'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import { Field } from './field';
import type { Department } from '../_types';

export function NewStaffModal({ onClose, departments, onSaved }: { onClose: () => void; departments: Department[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', sifre: '', telefon: '', departman: '', unvan: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.ad.trim()) e.ad = 'Ad zorunludur';
    if (!form.soyad.trim()) e.soyad = 'Soyad zorunludur';
    if (!form.email.trim()) e.email = 'E-posta zorunludur';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Geçerli bir e-posta girin';
    if (form.sifre.trim() && form.sifre.length < 8) e.sifre = 'Şifre en az 8 karakter olmalıdır';
    if (form.telefon && !/^0\d{10}$/.test(form.telefon.replace(/\s/g, ''))) e.telefon = 'Geçerli telefon formatı: 05XX XXX XX XX';
    if (!form.departman) e.departman = 'Departman seçiniz';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.ad,
          lastName: form.soyad,
          email: form.email,
          phone: form.telefon || undefined,
          departmentId: form.departman || undefined,
          title: form.unvan || undefined,
          password: form.sifre.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      setSaved(true);
      closeTimerRef.current = setTimeout(() => { onSaved(); onClose(); }, 1500);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = (field: string) => ({
    background: 'var(--k-surface)',
    borderColor: errors[field] ? 'var(--k-error)' : 'var(--k-border)',
  });

  return (
    <PremiumModal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      eyebrow="Personel Kaydı"
      title="Yeni personel ekle"
      subtitle="Hesabı oluşturur ve giriş bilgilerini e-posta ile iletir."
      size="lg"
      disableEscape={saving}
      footer={
        !saved ? (
          <PremiumModalFooter
            summary={<span className="text-sm" style={{ color: 'var(--k-text-muted)' }}>Zorunlu alanlar * ile işaretli</span>}
            actions={
              <>
                <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
                <PremiumButton onClick={handleSave} loading={saving} icon={<Save className="h-4 w-4" />}>
                  {saving ? 'Kaydediliyor' : 'Personel Ekle'}
                </PremiumButton>
              </>
            }
          />
        ) : null
      }
    >
      {saved ? (
        <div className="flex flex-col items-center text-center py-8 gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
               style={{ background: 'var(--k-primary)', color: '#fff' }}>
            <UserPlus className="h-6 w-6" />
          </div>
          <h4 className="text-lg font-semibold" style={{ color: 'var(--k-text-primary)' }}>
            Personel başarıyla eklendi
          </h4>
          <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
            Giriş bilgileri {form.email} adresine gönderildi.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ad *" error={errors.ad}>
              <Input placeholder="Personel adı" className="h-10" value={form.ad} onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))} style={fieldStyle('ad')} />
            </Field>
            <Field label="Soyad *" error={errors.soyad}>
              <Input placeholder="Personel soyadı" className="h-10" value={form.soyad} onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))} style={fieldStyle('soyad')} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-posta *" error={errors.email}>
              <Input type="email" placeholder="ornek@hastane.com" className="h-10" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} style={fieldStyle('email')} />
            </Field>
            <Field label="Şifre" error={errors.sifre} hint={!errors.sifre ? 'Boş bırakın — otomatik üretilip e-posta ile iletilir.' : undefined}>
              <Input type="password" placeholder="Boş bırakın — sistem üretir" className="h-10" value={form.sifre} onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))} style={fieldStyle('sifre')} />
            </Field>
          </div>
          <Field label="Telefon" error={errors.telefon}>
            <Input placeholder="05XX XXX XX XX" className="h-10"
                   value={form.telefon}
                   onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                   style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Departman *" error={errors.departman}>
              <select
                className="h-10 w-full rounded-lg border px-3 text-sm"
                style={fieldStyle('departman')}
                value={form.departman}
                onChange={(e) => setForm(f => ({ ...f, departman: e.target.value }))}
              >
                <option value="">Seçin...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Unvan">
              <Input placeholder="örn. Hemşire" className="h-10" value={form.unvan} onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))} style={fieldStyle('unvan')} />
            </Field>
          </div>
        </div>
      )}
    </PremiumModal>
  );
}
