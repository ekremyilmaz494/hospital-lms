'use client';

import { Building2, Mail, Clock, GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Target } from 'lucide-react';

interface SettingsData {
  defaultPassingScore: number;
  defaultMaxAttempts: number;
  defaultExamDuration: number;
  organizationName: string;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
  emailNotifications: boolean;
  reminderDaysBefore: number;
  notifyOnComplete: boolean;
  notifyOnFail: boolean;
  sessionTimeout: number;
}

/** Field wrapper */
function Field({ label, hint, icon: Icon, children }: {
  label: string;
  hint?: string;
  icon: typeof Target;
  children: React.ReactNode;
}) {
  return (
    <div className="group">
      <Label
        className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--k-text-muted)' }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: 'var(--k-primary)' }} />
        {label}
      </Label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--k-text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface Props {
  settings: SettingsData;
  setSettings: (patch: Partial<SettingsData>) => void;
  saving: boolean;
  handleSave: () => void;
}

const inputClass = 'h-12 rounded-xl text-[13px] transition-shadow duration-200 focus:ring-2 focus:ring-[var(--k-primary)]/20';
const inputStyle = { background: 'var(--k-surface-hover)', borderColor: 'var(--k-border)' };

export default function OrganizationTab({ settings, setSettings }: Props) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Kurum Bilgileri
        </h2>

        <p className="text-[13px] mt-1" style={{ color: 'var(--k-text-muted)' }}>
          Kurumunuzun temel bilgilerini ve iletişim detaylarını yönetin.
        </p>
      </div>

      <div className="space-y-6">
        <Field label="Organizasyon Adı" icon={Building2}>
          <Input
            value={settings.organizationName}
            onChange={(e) => setSettings({ organizationName: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <div
          className="rounded-xl p-5 space-y-5"
          style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-3.5 w-3.5" style={{ color: 'var(--k-primary)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
              İletişim Bilgileri
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--k-text-secondary)' }}>
                E-posta Adresi
              </Label>
              <Input
                type="email"
                value={settings.email ?? ''}
                onChange={(e) => setSettings({ email: e.target.value })}
                placeholder="info@kurum.com"
                className={inputClass}
                style={{ ...inputStyle, background: 'var(--k-surface)' }}
              />
            </div>
            <div>
              <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--k-text-secondary)' }}>
                Telefon Numarası
              </Label>
              <Input
                value={settings.phone ?? ''}
                onChange={(e) => setSettings({ phone: e.target.value })}
                placeholder="+90 (___) ___ __ __"
                className={inputClass}
                style={{ ...inputStyle, background: 'var(--k-surface)' }}
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--k-text-secondary)' }}>
              Adres
            </Label>
            <Textarea
              value={settings.address ?? ''}
              onChange={(e) => setSettings({ address: e.target.value })}
              placeholder="Organizasyon adresi..."
              rows={2}
              className="rounded-xl resize-none text-[13px]"
              style={{ ...inputStyle, background: 'var(--k-surface)' }}
            />
          </div>
        </div>

        {/* Logo, "Marka" sekmesinde yönetilir (yükleme + önizleme) — burada çift giriş kaldırıldı. */}

        {/* Sınav varsayılanları — yeni eğitimlere uygulanan kurum geneli kurallar */}
        <div
          className="rounded-xl p-5 space-y-5"
          style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-3.5 w-3.5" style={{ color: 'var(--k-primary)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
              Sınav Varsayılanları
            </span>
          </div>
          <p className="text-[11px] -mt-2 leading-relaxed" style={{ color: 'var(--k-text-muted)' }}>
            Yeni oluşturulan eğitimlere otomatik uygulanır. Eğitim bazında ayrıca değiştirilebilir.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--k-text-secondary)' }}>
                Geçme Notu (%)
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.defaultPassingScore}
                onChange={(e) => setSettings({ defaultPassingScore: Number(e.target.value) })}
                className={`${inputClass} font-mono`}
                style={{ ...inputStyle, background: 'var(--k-surface)' }}
              />
            </div>
            <div>
              <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--k-text-secondary)' }}>
                Deneme Hakkı
              </Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={settings.defaultMaxAttempts}
                onChange={(e) => setSettings({ defaultMaxAttempts: Number(e.target.value) })}
                className={`${inputClass} font-mono`}
                style={{ ...inputStyle, background: 'var(--k-surface)' }}
              />
            </div>
            <div>
              <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--k-text-secondary)' }}>
                Süre (dakika)
              </Label>
              <Input
                type="number"
                min={5}
                max={180}
                value={settings.defaultExamDuration}
                onChange={(e) => setSettings({ defaultExamDuration: Number(e.target.value) })}
                className={`${inputClass} font-mono`}
                style={{ ...inputStyle, background: 'var(--k-surface)' }}
              />
            </div>
          </div>
        </div>

        {/* Oturum güvenliği — idle (boşta) süresi sonunda otomatik çıkış */}
        <Field
          label="Oturum Zaman Aşımı"
          icon={Clock}
          hint="Personel bu süre boyunca işlem yapmazsa oturumu güvenlik için otomatik kapatılır (5–480 dakika)."
        >
          <div className="relative w-48">
            <Input
              type="number"
              min={5}
              max={480}
              value={settings.sessionTimeout}
              onChange={(e) => setSettings({ sessionTimeout: Number(e.target.value) })}
              className={`${inputClass} font-mono text-lg font-bold pr-20`}
              style={inputStyle}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold" style={{ color: 'var(--k-text-muted)' }}>dakika</span>
          </div>
        </Field>
      </div>
    </div>
  );
}
