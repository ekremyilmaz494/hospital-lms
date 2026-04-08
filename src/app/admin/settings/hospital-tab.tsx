'use client';

import { Building2, Mail, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Target } from 'lucide-react';

interface SettingsData {
  defaultPassingScore: number;
  defaultMaxAttempts: number;
  defaultExamDuration: number;
  hospitalName: string;
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
        className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
        {label}
      </Label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
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

const inputClass = 'h-12 rounded-xl text-[13px] transition-shadow duration-200 focus:ring-2 focus:ring-[var(--color-primary)]/20';
const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)' };

export default function HospitalTab({ settings, setSettings }: Props) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Kurum Bilgileri
        </h2>

        <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Hastanenizin temel bilgilerini ve iletişim detaylarını yönetin.
        </p>
      </div>

      <div className="space-y-6">
        <Field label="Hastane Adı" icon={Building2}>
          <Input
            value={settings.hospitalName}
            onChange={(e) => setSettings({ hospitalName: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <div
          className="rounded-xl p-5 space-y-5"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              İletişim Bilgileri
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                E-posta Adresi
              </Label>
              <Input
                type="email"
                value={settings.email ?? ''}
                onChange={(e) => setSettings({ email: e.target.value })}
                placeholder="info@hastane.com"
                className={inputClass}
                style={{ ...inputStyle, background: 'var(--color-surface)' }}
              />
            </div>
            <div>
              <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                Telefon Numarası
              </Label>
              <Input
                value={settings.phone ?? ''}
                onChange={(e) => setSettings({ phone: e.target.value })}
                placeholder="+90 (___) ___ __ __"
                className={inputClass}
                style={{ ...inputStyle, background: 'var(--color-surface)' }}
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
              Adres
            </Label>
            <Textarea
              value={settings.address ?? ''}
              onChange={(e) => setSettings({ address: e.target.value })}
              placeholder="Hastane adresi..."
              rows={2}
              className="rounded-xl resize-none text-[13px]"
              style={{ ...inputStyle, background: 'var(--color-surface)' }}
            />
          </div>
        </div>

        <Field label="Logo URL" icon={Globe} hint="Logo dosyanızın tam URL adresini girin. Önerilen boyut: 200x200px">
          <Input
            value={settings.logoUrl ?? ''}
            onChange={(e) => setSettings({ logoUrl: e.target.value })}
            placeholder="https://cdn.example.com/logo.png"
            className={`${inputClass} font-mono text-xs`}
            style={inputStyle}
          />
        </Field>
      </div>
    </div>
  );
}
