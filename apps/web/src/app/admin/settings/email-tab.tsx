'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Send, CheckCircle2, AlertCircle, Loader2, AtSign, Save, ShieldCheck, Info,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/shared/toast';

interface BrandInfo {
  name: string;
  fullName: string;
  fromAddress: string;
  domain: string;
}

interface EmailSettings {
  emailDisplayName: string;
  emailReplyTo: string;
  emailEnabled: boolean;
  brand: BrandInfo;
  effectiveDisplayName: string;
}

const defaultBrand: BrandInfo = {
  name: 'KlinoVax',
  fullName: 'KlinoVax Operasyon Platformu',
  fromAddress: 'noreply@klinovax.com',
  domain: 'klinovax.com',
};

const defaultData: EmailSettings = {
  emailDisplayName: '',
  emailReplyTo: '',
  emailEnabled: true,
  brand: defaultBrand,
  effectiveDisplayName: defaultBrand.fullName,
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        flexShrink: 0, width: 52, height: 28, borderRadius: 9999, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', padding: 0, opacity: disabled ? 0.5 : 1,
        background: checked ? 'linear-gradient(135deg, var(--brand-600), #0a7d56)' : '#d1d5db',
        boxShadow: checked
          ? '0 2px 10px color-mix(in srgb, var(--brand-600) calc(0.35 * 100%), transparent)'
          : 'inset 0 2px 4px rgba(0,0,0,0.08)',
      }}
    >
      <span
        style={{
          position: 'absolute', width: 22, height: 22, borderRadius: '50%', background: 'white',
          top: 3, left: checked ? 27 : 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)',
        }}
      />
    </button>
  );
}

function Field({ label, hint, icon: Icon, children }: {
  label: string; hint?: string; icon: LucideIcon; children: React.ReactNode;
}) {
  return (
    <div>
      <Label
        className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--k-text-muted)' }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: 'var(--k-primary)' }} />
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--k-text-muted)' }}>{hint}</p>}
    </div>
  );
}

const inputClass = 'h-11 rounded-xl text-[13px] transition-shadow duration-200 focus:ring-2 focus:ring-[var(--k-primary)]/20';
const inputStyle = { background: 'var(--k-surface-hover)', borderColor: 'var(--k-border)' };

export default function EmailTab() {
  const { toast } = useToast();
  const [data, setData] = useState<EmailSettings>(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings/email');
      if (!res.ok) throw new Error('E-posta ayarları yüklenemedi');
      const json = await res.json();
      setData({
        emailDisplayName: json.emailDisplayName ?? '',
        emailReplyTo: json.emailReplyTo ?? '',
        emailEnabled: json.emailEnabled ?? true,
        brand: json.brand ?? defaultBrand,
        effectiveDisplayName: json.effectiveDisplayName ?? defaultBrand.fullName,
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Yükleme hatası', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailDisplayName: data.emailDisplayName,
          emailReplyTo: data.emailReplyTo,
          emailEnabled: data.emailEnabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Kaydedilemedi');
      toast('E-posta ayarları kaydedildi', 'success');
      await loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kayıt hatası', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testEmail.trim()) {
      toast('Test için bir e-posta adresi girin', 'error');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/admin/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail.trim(),
          emailDisplayName: data.emailDisplayName,
          emailReplyTo: data.emailReplyTo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Test başarısız');
      toast(json?.message ?? 'Test e-postası gönderildi', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Test hatası', 'error');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--k-primary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bilgilendirme bandı — merkezi altyapı */}
      <div
        className="rounded-2xl p-5 flex gap-3"
        style={{ background: 'color-mix(in srgb, var(--brand-600) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-600) 18%, transparent)' }}
      >
        <ShieldCheck className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--k-primary)' }} />
        <div className="text-[13px] leading-relaxed" style={{ color: 'var(--k-text)' }}>
          <p className="font-semibold mb-1">Merkezi e-posta altyapısı</p>
          <p style={{ color: 'var(--k-text-muted)' }}>
            Tüm bildirimler <strong>{data.brand.fullName}</strong> üzerinden{' '}
            <code style={{ background: 'var(--k-surface-hover)', padding: '1px 6px', borderRadius: 4 }}>{data.brand.fromAddress}</code>{' '}
            adresinden gönderilir. SPF, DKIM ve DMARC kayıtları <code>{data.brand.domain}</code> domaininde aktif —
            kurumunuzun ayrı bir SMTP sunucusuna ihtiyacı yok.
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--brand-600) 12%, transparent)' }}
          >
            <Mail className="h-5 w-5" style={{ color: 'var(--k-primary)' }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--k-text)' }}>
              E-posta Tercihleri
            </h3>
            <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
              Görünen ad ve yanıt adresinizi özelleştirin
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <Field
            label="Görünen Ad"
            icon={AtSign}
            hint={`Boş bırakılırsa "${data.effectiveDisplayName}" görünür.`}
          >
            <Input
              value={data.emailDisplayName}
              onChange={(e) => setData({ ...data, emailDisplayName: e.target.value })}
              placeholder="Örn. Kurumunuzun Adı"
              maxLength={100}
              className={inputClass}
              style={inputStyle}
            />
          </Field>

          <Field
            label="Yanıt Adresi (Reply-To)"
            icon={Mail}
            hint="Personel cevap verdiğinde nereye gelsin? Boşsa cevaplanamaz olur."
          >
            <Input
              type="email"
              value={data.emailReplyTo}
              onChange={(e) => setData({ ...data, emailReplyTo: e.target.value })}
              placeholder="ik@kurum.com"
              maxLength={320}
              className={inputClass}
              style={inputStyle}
            />
          </Field>

          <div
            className="rounded-xl p-4 flex items-center justify-between gap-4"
            style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
          >
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--k-text)' }}>
                Bildirim e-postaları aktif
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--k-text-muted)' }}>
                Kapatılırsa eğitim atama / hatırlatma e-postaları gönderilmez.
                Şifre sıfırlama gibi <strong>zorunlu</strong> e-postalar her halükarda gönderilir.
              </p>
            </div>
            <Toggle
              checked={data.emailEnabled}
              onChange={(v) => setData({ ...data, emailEnabled: v })}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-5 h-11 text-[13px] font-semibold text-white transition-all"
            style={{
              background: saving ? '#94a3b8' : 'linear-gradient(135deg, var(--brand-600), #0a7d56)',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px color-mix(in srgb, var(--brand-600) 30%, transparent)',
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Test bölümü */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--brand-600) 12%, transparent)' }}
          >
            <Send className="h-5 w-5" style={{ color: 'var(--k-primary)' }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--k-text)' }}>
              Test E-postası Gönder
            </h3>
            <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
              Yukarıdaki ayarlarla preview maili at — kaydetmeden de çalışır
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="alici@ornek.com"
            className={`${inputClass} flex-1`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !testEmail.trim()}
            className="inline-flex items-center gap-2 rounded-xl px-5 h-11 text-[13px] font-semibold transition-all"
            style={{
              background: 'var(--k-surface-hover)',
              border: '1px solid var(--k-border)',
              color: 'var(--k-text)',
              cursor: testing || !testEmail.trim() ? 'not-allowed' : 'pointer',
              opacity: testing || !testEmail.trim() ? 0.5 : 1,
            }}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {testing ? 'Gönderiliyor...' : 'Test Gönder'}
          </button>
        </div>

        <div className="mt-4 flex gap-2 items-start text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <p>
            Saatte en fazla 10 test e-postası gönderebilirsiniz. SES sandbox modunda
            iken sadece doğrulanmış adreslere mail gider — bu durumda sandbox listesinde
            olmayan adresler için &quot;Email address not verified&quot; hatası alırsınız.
          </p>
        </div>
      </div>

      {/* Eski SMTP referansı uyarısı */}
      <div
        className="rounded-2xl p-4 flex gap-3 text-[12px]"
        style={{ background: 'color-mix(in srgb, #f59e0b 8%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 22%, transparent)' }}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#b45309' }} />
        <div style={{ color: 'var(--k-text)' }}>
          <p className="font-semibold mb-1">Eski SMTP ayarları kaldırıldı</p>
          <p style={{ color: 'var(--k-text-muted)' }}>
            Eskiden hastaneye özel SMTP sunucusu girebiliyordunuz. Artık ihtiyaç yok —
            merkezi altyapı daha iyi deliverability ve <CheckCircle2 className="inline h-3 w-3" style={{ color: '#16a34a' }} /> DKIM/SPF/DMARC sağlıyor.
          </p>
        </div>
      </div>
    </div>
  );
}
