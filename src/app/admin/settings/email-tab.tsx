'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Server, User, KeyRound, Send, Lock, CheckCircle2, AlertCircle, Loader2, AtSign, Save,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/shared/toast';

interface SmtpData {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;          // UI-only — sadece kullanıcı değiştirirse gönderilir
  hasPassword: boolean;          // DB'de şifre var mı? (read-only gösterim için)
  smtpFrom: string;
  smtpReplyTo: string;
  smtpEnabled: boolean;
}

const defaultData: SmtpData = {
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  hasPassword: false,
  smtpFrom: '',
  smtpReplyTo: '',
  smtpEnabled: false,
};

/** Toggle — settings/notification-tab.tsx ile aynı */
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
  label: string; hint?: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div>
      <Label
        className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
    </div>
  );
}

const inputClass = 'h-11 rounded-xl text-[13px] transition-shadow duration-200 focus:ring-2 focus:ring-[var(--color-primary)]/20';
const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)' };

export default function EmailTab() {
  const { toast } = useToast();
  const [data, setData] = useState<SmtpData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/settings/smtp', { credentials: 'include' });
        if (!res.ok) throw new Error('SMTP ayarları yüklenemedi');
        const json = await res.json();
        if (!cancelled) setData({ ...defaultData, ...json, smtpPassword: '' });
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : 'Yükleme hatası', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const update = useCallback((patch: Partial<SmtpData>) => {
    setData(prev => ({ ...prev, ...patch }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Password'ü sadece kullanıcı değiştirdiyse gönder (boş string yollamayalım)
      const payload: Partial<SmtpData> = { ...data };
      if (!payload.smtpPassword) delete payload.smtpPassword;
      delete (payload as Partial<SmtpData> & { hasPassword?: boolean }).hasPassword;

      const res = await fetch('/api/admin/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      const json = await res.json();
      setData({ ...defaultData, ...json, smtpPassword: '' });
      toast('SMTP ayarları kaydedildi', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast('Test için bir e-posta adresi girin', 'error');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/admin/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          smtpHost: data.smtpHost || undefined,
          smtpPort: data.smtpPort || undefined,
          smtpSecure: data.smtpSecure,
          smtpUser: data.smtpUser || undefined,
          smtpPassword: data.smtpPassword || undefined,
          smtpFrom: data.smtpFrom || undefined,
          to: testEmail,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Test başarısız');
      toast(json.message || 'Test e-postası gönderildi', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Test başarısız', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="p-8 h-64 animate-pulse rounded-lg" style={{ background: 'var(--color-bg)' }} />;
  }

  const canEnable = Boolean(data.smtpHost && data.smtpUser && (data.smtpPassword || data.hasPassword));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          E-posta Gönderimi (SMTP)
        </h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Personele gönderilen otomatik bildirimler (eğitim ataması, hatırlatma vb.) burada tanımladığınız
          SMTP sunucusundan, kurumunuzun adıyla gönderilir.
        </p>
      </div>

      {/* Enable toggle */}
      <div
        className="flex items-center gap-4 rounded-xl p-5 mb-6"
        style={{
          background: data.smtpEnabled
            ? 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 6%, transparent), color-mix(in srgb, var(--color-primary) 3%, transparent))'
            : 'var(--color-bg)',
          border: `1px solid ${data.smtpEnabled ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-border)'}`,
        }}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: data.smtpEnabled
              ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
              : 'var(--color-surface)',
            border: `1px solid ${data.smtpEnabled ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-border)'}`,
          }}
        >
          <Mail
            className="h-5 w-5"
            style={{ color: data.smtpEnabled ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">E-posta Gönderimini Aktifleştir</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {canEnable
              ? 'Aktif olduğunda eğitim atamaları e-posta olarak da gönderilir'
              : 'Aktifleştirmek için önce sunucu, kullanıcı ve şifre bilgilerini girin'}
          </p>
        </div>
        <Toggle
          checked={data.smtpEnabled}
          disabled={!canEnable}
          onChange={(v) => update({ smtpEnabled: v })}
        />
      </div>

      {/* Connection — left col */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Field label="SMTP Sunucusu" icon={Server} hint="Örn: smtp.gmail.com, smtp.office365.com">
          <Input
            type="text"
            value={data.smtpHost}
            onChange={(e) => update({ smtpHost: e.target.value })}
            placeholder="smtp.hastane.com"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Port" icon={Server} hint="587 (STARTTLS) veya 465 (SSL)">
          <Input
            type="number"
            min={1}
            max={65535}
            value={data.smtpPort}
            onChange={(e) => update({ smtpPort: Number(e.target.value) })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Kullanıcı Adı" icon={User} hint="Genellikle tam e-posta adresiniz">
          <Input
            type="text"
            value={data.smtpUser}
            onChange={(e) => update({ smtpUser: e.target.value })}
            placeholder="egitim@hastane.com"
            className={inputClass}
            style={inputStyle}
            autoComplete="off"
          />
        </Field>

        <Field
          label="Şifre"
          icon={KeyRound}
          hint={data.hasPassword ? 'Mevcut şifre korunuyor — değiştirmek için yenisini yazın' : 'SMTP sağlayıcınızdan alınan uygulama şifresi'}
        >
          <Input
            type="password"
            value={data.smtpPassword}
            onChange={(e) => update({ smtpPassword: e.target.value })}
            placeholder={data.hasPassword ? '••••••••••' : 'Şifrenizi girin'}
            className={inputClass}
            style={inputStyle}
            autoComplete="new-password"
          />
        </Field>
      </div>

      {/* Security */}
      <div
        className="flex items-center gap-4 rounded-xl p-4 mb-6"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        <Lock className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">Bağlantı Güvenliği (SSL/TLS)</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            465 portu için aktif edin. 587 için kapalı bırakın (STARTTLS otomatik).
          </p>
        </div>
        <Toggle checked={data.smtpSecure} onChange={(v) => update({ smtpSecure: v })} />
      </div>

      {/* Brand / From */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <Field label="Gönderen Adı ve E-posta" icon={AtSign} hint='Örn: "Devakent Hastanesi <egitim@hastane.com>"'>
          <Input
            type="text"
            value={data.smtpFrom}
            onChange={(e) => update({ smtpFrom: e.target.value })}
            placeholder='Hastane Adı <noreply@hastane.com>'
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Yanıt Adresi (Reply-To)" icon={Mail} hint="Personelin yanıt verebileceği adres (opsiyonel)">
          <Input
            type="email"
            value={data.smtpReplyTo}
            onChange={(e) => update({ smtpReplyTo: e.target.value })}
            placeholder="destek@hastane.com"
            className={inputClass}
            style={inputStyle}
          />
        </Field>
      </div>

      {/* Test block */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Send className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-[13px] font-semibold">Test E-postası Gönder</h3>
        </div>
        <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Kaydetmeden önce yukarıdaki ayarlarla canlı bir test e-postası gönderin. Hatalı config varsa burada tespit edersiniz.
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@hastane.com"
            className={`${inputClass} flex-1`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !testEmail}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.2 * 100%), transparent)',
            }}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Test Gönder
          </button>
        </div>
      </div>

      {/* Status / info */}
      <div
        className="flex items-start gap-3 rounded-xl p-4 mb-6"
        style={{
          background: 'color-mix(in srgb, var(--color-info, #3b82f6) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-info, #3b82f6) 20%, transparent)',
        }}
      >
        {data.smtpEnabled ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-success, #16a34a)' }} />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-info, #3b82f6)' }} />
        )}
        <div>
          <p className="text-[13px] font-semibold">
            {data.smtpEnabled ? 'E-posta gönderimi aktif' : 'E-posta gönderimi pasif'}
          </p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {data.smtpEnabled
              ? 'Yeni eğitim atamaları personelin e-posta adresine otomatik gönderilecek. Şifreniz AES-256-GCM ile şifrelenerek saklanıyor.'
              : 'Şu an sadece uygulama içi bildirim kullanılıyor. SMTP konfigüre edip aktifleştirdiğinizde eğitim atamaları e-posta olarak da gidecek.'}
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
            boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
        </button>
      </div>
    </div>
  );
}
