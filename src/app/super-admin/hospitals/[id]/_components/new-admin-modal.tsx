'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, ShieldCheck, KeyRound, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <Label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
             style={{ color: 'var(--color-text-muted)' }}>{label}</Label>
      {children}
      {error && <p className="mt-1.5 text-[11px] font-medium" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {hint && !error && <p className="mt-1.5 text-[11px] italic" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
    </div>
  );
}

interface NewAdminModalProps {
  hospitalId: string;
  hospitalName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function NewAdminModal({ hospitalId, hospitalName, onClose, onSaved }: NewAdminModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [savedWithEmail, setSavedWithEmail] = useState(false);
  const [fallbackPassword, setFallbackPassword] = useState<string | null>(null);
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', sifre: '', telefon: '', unvan: '' });
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
    if (form.sifre.trim()) {
      if (form.sifre.length < 8) e.sifre = 'Şifre en az 8 karakter olmalıdır';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(form.sifre)) {
        e.sifre = 'Büyük, küçük, rakam ve özel karakter içermelidir';
      }
    }
    if (form.telefon && !/^0\d{10}$/.test(form.telefon.replace(/\s/g, ''))) e.telefon = 'Geçerli telefon formatı: 05XX XXX XX XX';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/super-admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'admin',
          organizationId: hospitalId,
          firstName: form.ad,
          lastName: form.soyad,
          email: form.email,
          ...(form.sifre.trim() && { password: form.sifre.trim() }),
          ...(form.telefon && { phone: form.telefon.replace(/\s/g, '') }),
          ...(form.unvan && { title: form.unvan }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Kayıt başarısız');

      onSaved();

      if (body.emailSent === false && body.tempPassword) {
        setFallbackPassword(body.tempPassword);
      } else {
        setSavedWithEmail(true);
        closeTimerRef.current = setTimeout(() => onClose(), 1800);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = (field: string) => ({
    background: 'var(--color-surface)',
    borderColor: errors[field] ? 'var(--color-error)' : 'var(--color-border)',
  });

  const isDone = savedWithEmail || fallbackPassword !== null;

  return (
    <PremiumModal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      eyebrow="Hastane Admin Kaydı"
      title={`${hospitalName} için yeni admin`}
      subtitle="Sınırsız sayıda admin ekleyebilirsiniz. Giriş bilgileri e-posta ile iletilir."
      size="lg"
      disableEscape={saving}
      footer={
        !isDone ? (
          <PremiumModalFooter
            summary={<span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Zorunlu alanlar * ile işaretli</span>}
            actions={
              <>
                <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
                <PremiumButton onClick={handleSave} loading={saving} icon={<Save className="h-4 w-4" />}>
                  {saving ? 'Kaydediliyor' : 'Admin Ekle'}
                </PremiumButton>
              </>
            }
          />
        ) : fallbackPassword ? (
          <PremiumModalFooter
            actions={<PremiumButton onClick={onClose}>Kapat</PremiumButton>}
          />
        ) : null
      }
    >
      {savedWithEmail ? (
        <div className="flex flex-col items-center text-center py-8 gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
               style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Admin başarıyla eklendi
          </h4>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Giriş bilgileri {form.email} adresine gönderildi.
          </p>
        </div>
      ) : fallbackPassword ? (
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-start gap-3 rounded-lg border p-3"
               style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
            <KeyRound className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              <p className="font-semibold mb-1">Admin oluşturuldu — fakat e-posta gönderilemedi</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Aşağıdaki geçici şifreyi {form.email} kullanıcısına güvenli kanaldan iletin. İlk girişte değiştirmesi istenecektir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5"
               style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <code className="flex-1 text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
              {fallbackPassword}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(fallbackPassword).then(() => toast('Şifre kopyalandı', 'success'));
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold"
              style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
            >
              <Copy className="h-3 w-3" /> Kopyala
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ad *" error={errors.ad}>
              <Input placeholder="Yönetici adı" className="h-10" autoComplete="given-name"
                     value={form.ad} onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))}
                     style={fieldStyle('ad')} />
            </Field>
            <Field label="Soyad *" error={errors.soyad}>
              <Input placeholder="Yönetici soyadı" className="h-10" autoComplete="family-name"
                     value={form.soyad} onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))}
                     style={fieldStyle('soyad')} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-posta *" error={errors.email}>
              <Input type="email" placeholder="admin@hastane.com" className="h-10" autoComplete="email"
                     value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                     style={fieldStyle('email')} />
            </Field>
            <Field label="Şifre" error={errors.sifre}
                   hint={!errors.sifre ? 'Boş bırakın — otomatik üretilip e-posta ile iletilir.' : undefined}>
              <Input type="password" placeholder="Boş bırakın — sistem üretir" className="h-10" autoComplete="new-password"
                     value={form.sifre} onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))}
                     style={fieldStyle('sifre')} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Telefon" error={errors.telefon}>
              <Input placeholder="05XX XXX XX XX" className="h-10"
                     value={form.telefon}
                     onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                     style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
            </Field>
            <Field label="Unvan">
              <Input placeholder="örn. Kalite Yöneticisi" className="h-10"
                     value={form.unvan} onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))}
                     style={fieldStyle('unvan')} />
            </Field>
          </div>
        </div>
      )}
    </PremiumModal>
  );
}
