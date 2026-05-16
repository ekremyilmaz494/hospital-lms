'use client';

import { useState } from 'react';
import { Save, ShieldCheck, KeyRound, Copy, IdCard, Mail } from 'lucide-react';
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

interface CredentialRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyLabel: string;
}

function CredentialRow({ icon, label, value, copyLabel }: CredentialRowProps) {
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
         style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
           style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
        {icon}
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <code className="text-[13px] font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
          {value}
        </code>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => toast(`${copyLabel} kopyalandı`, 'success'));
        }}
        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
        style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
      >
        <Copy className="h-3 w-3" /> Kopyala
      </button>
    </div>
  );
}

interface NewAdminModalProps {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onSaved: () => void;
}

interface CreatedAdmin {
  email: string;
  fullName: string;
  tcKimlik: string;
  tempPassword: string;
  loginUrl: string;
  emailSent: boolean;
}

const isValidTcFormat = (val: string) => /^\d{11}$/.test(val);

export function NewAdminModal({ organizationId, organizationName, onClose, onSaved }: NewAdminModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedAdmin | null>(null);
  const [form, setForm] = useState({ ad: '', soyad: '', tc: '', email: '', sifre: '', telefon: '', unvan: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.ad.trim()) e.ad = 'Ad zorunludur';
    if (!form.soyad.trim()) e.soyad = 'Soyad zorunludur';
    const tcNormalized = form.tc.replace(/\D/g, '');
    if (!tcNormalized) e.tc = 'TC Kimlik No zorunludur';
    else if (!isValidTcFormat(tcNormalized)) e.tc = '11 haneli rakam olmalıdır';
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
          organizationId: organizationId,
          firstName: form.ad.trim(),
          lastName: form.soyad.trim(),
          email: form.email.trim(),
          tcKimlik: form.tc.replace(/\D/g, ''),
          ...(form.sifre.trim() && { password: form.sifre.trim() }),
          ...(form.telefon && { phone: form.telefon.replace(/\s/g, '') }),
          ...(form.unvan && { title: form.unvan.trim() }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Kayıt başarısız');

      onSaved();
      setCreated({
        email: body.email ?? form.email.trim(),
        fullName: `${form.ad.trim()} ${form.soyad.trim()}`.trim(),
        tcKimlik: body.tcKimlik ?? form.tc.replace(/\D/g, ''),
        tempPassword: body.tempPassword ?? '',
        loginUrl: body.loginUrl ?? '',
        emailSent: body.emailSent === true,
      });
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

  const copyAll = () => {
    if (!created) return;
    const text = [
      `Organizasyon: ${organizationName}`,
      `Yönetici: ${created.fullName}`,
      `E-posta: ${created.email}`,
      `TC Kimlik No: ${created.tcKimlik}`,
      `Geçici Şifre: ${created.tempPassword}`,
      created.loginUrl ? `Giriş: ${created.loginUrl}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => toast('Tüm bilgiler kopyalandı', 'success'));
  };

  return (
    <PremiumModal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      eyebrow="Organizasyon Admin Kaydı"
      title={created ? `${created.fullName} oluşturuldu` : `${organizationName} için yeni admin`}
      subtitle={created ? 'Aşağıdaki bilgileri güvenli bir kanaldan yöneticiye iletin.' : 'Sınırsız sayıda admin ekleyebilirsiniz. TC ve geçici şifre kayıt sonrası gösterilecektir.'}
      size="lg"
      disableEscape={saving}
      footer={
        !created ? (
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
        ) : (
          <PremiumModalFooter
            summary={
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: 'var(--color-primary)' }}
              >
                <Copy className="h-3.5 w-3.5" /> Tüm bilgileri kopyala
              </button>
            }
            actions={<PremiumButton onClick={onClose}>Kapat</PremiumButton>}
          />
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-4 py-1">
          <div className="flex items-start gap-3 rounded-xl border p-3"
               style={{
                 background: created.emailSent ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                 borderColor: created.emailSent ? 'var(--color-success)' : 'var(--color-warning)',
               }}>
            {created.emailSent ? (
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} />
            ) : (
              <KeyRound className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            )}
            <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              <p className="font-semibold mb-1">
                {created.emailSent ? 'Admin oluşturuldu ve giriş bilgileri e-posta ile iletildi' : 'Admin oluşturuldu — fakat e-posta gönderilemedi'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Yedek olarak aşağıdaki bilgileri kaydedin ve güvenli bir kanaldan yöneticiye iletin. İlk girişte şifre değiştirilmesi istenir.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <CredentialRow
              icon={<Mail className="h-4 w-4" />}
              label="E-posta"
              value={created.email}
              copyLabel="E-posta"
            />
            <CredentialRow
              icon={<IdCard className="h-4 w-4" />}
              label="TC Kimlik No"
              value={created.tcKimlik}
              copyLabel="TC Kimlik No"
            />
            <CredentialRow
              icon={<KeyRound className="h-4 w-4" />}
              label="Geçici Şifre"
              value={created.tempPassword}
              copyLabel="Geçici şifre"
            />
            {created.loginUrl && (
              <CredentialRow
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Giriş Adresi"
                value={created.loginUrl}
                copyLabel="Giriş adresi"
              />
            )}
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
            <Field label="TC Kimlik No *" error={errors.tc} hint={!errors.tc ? 'Sadece 11 hane rakam' : undefined}>
              <Input inputMode="numeric" placeholder="12345678901" className="h-10" maxLength={11}
                     value={form.tc}
                     onChange={(e) => setForm(f => ({ ...f, tc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                     style={{ ...fieldStyle('tc'), fontFamily: 'var(--font-mono)' }} />
            </Field>
            <Field label="E-posta *" error={errors.email}>
              <Input type="email" placeholder="admin@kurum.com" className="h-10" autoComplete="email"
                     value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                     style={fieldStyle('email')} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Şifre" error={errors.sifre}
                   hint={!errors.sifre ? 'Boş bırakın — sistem üretir ve kayıttan sonra gösterilir.' : undefined}>
              <Input type="password" placeholder="Boş bırakın — sistem üretir" className="h-10" autoComplete="new-password"
                     value={form.sifre} onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))}
                     style={fieldStyle('sifre')} />
            </Field>
            <Field label="Telefon" error={errors.telefon}>
              <Input placeholder="05XX XXX XX XX" className="h-10"
                     value={form.telefon}
                     onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                     style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
