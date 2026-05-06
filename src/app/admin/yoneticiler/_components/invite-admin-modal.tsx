'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, UserCog } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  maxAdmins: number;
  currentCount: number;
}

export function InviteAdminModal({ onClose, onSaved, maxAdmins, currentCount }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', telefon: '', unvan: '' });
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
    if (form.telefon && !/^0\d{10}$/.test(form.telefon.replace(/\s/g, ''))) e.telefon = 'Geçerli telefon formatı: 05XX XXX XX XX';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.ad,
          lastName: form.soyad,
          email: form.email,
          phone: form.telefon || undefined,
          title: form.unvan || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Davet başarısız');
      }
      setSaved(true);
      closeTimerRef.current = setTimeout(() => { onSaved(); onClose(); }, 1800);
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
      eyebrow="Yönetici Daveti"
      title="Yeni yönetici davet et"
      subtitle={`Davet bağlantısı maille gönderilir, 72 saat geçerlidir. (${currentCount + 1} / ${maxAdmins})`}
      size="md"
      disableEscape={saving}
      footer={
        !saved ? (
          <PremiumModalFooter
            summary={<span className="text-sm" style={{ color: 'var(--k-text-muted)' }}>Zorunlu alanlar * ile işaretli</span>}
            actions={
              <>
                <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
                <PremiumButton onClick={handleSave} loading={saving} icon={<Save className="h-4 w-4" />}>
                  {saving ? 'Davet Gönderiliyor' : 'Davet Et'}
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
            <UserCog className="h-6 w-6" />
          </div>
          <h4 className="text-lg font-semibold" style={{ color: 'var(--k-text-primary)' }}>
            Davet linki gönderildi
          </h4>
          <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
            <strong>{form.email}</strong> adresine davet bağlantısı iletildi.
          </p>
          <p className="text-xs" style={{ color: 'var(--k-text-muted)' }}>
            Bağlantı 72 saat içinde kullanılmalıdır. Davet edilen kişi linke tıklayıp kendi şifresini belirleyecek.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Ad *" error={errors.ad}>
              <Input placeholder="Yönetici adı" className="h-10" value={form.ad}
                     onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))}
                     style={fieldStyle('ad')} />
            </FieldRow>
            <FieldRow label="Soyad *" error={errors.soyad}>
              <Input placeholder="Yönetici soyadı" className="h-10" value={form.soyad}
                     onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))}
                     style={fieldStyle('soyad')} />
            </FieldRow>
          </div>
          <FieldRow label="E-posta *" error={errors.email}>
            <Input type="email" placeholder="ornek@hastane.com" className="h-10" value={form.email}
                   onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                   style={fieldStyle('email')} />
          </FieldRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Telefon" error={errors.telefon}>
              <Input placeholder="05XX XXX XX XX" className="h-10" value={form.telefon}
                     onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                     style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
            </FieldRow>
            <FieldRow label="Unvan">
              <Input placeholder="örn. Eğitim Müdürü" className="h-10" value={form.unvan}
                     onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))}
                     style={fieldStyle('unvan')} />
            </FieldRow>
          </div>
        </div>
      )}
    </PremiumModal>
  );
}

function FieldRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: 'var(--k-text-secondary)' }}>{label}</span>
      {children}
      {error && <span className="text-xs" style={{ color: 'var(--k-error)' }}>{error}</span>}
    </label>
  );
}
