'use client';

import { Mail, Award, BellRing, CalendarClock, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

/** Toggle switch — 52×28px track, 22px knob */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        width: 52,
        height: 28,
        borderRadius: 9999,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        background: checked
          ? 'linear-gradient(135deg, #0d9668, #0a7d56)'
          : '#d1d5db',
        boxShadow: checked
          ? '0 2px 10px rgba(13, 150, 104, 0.35)'
          : 'inset 0 2px 4px rgba(0,0,0,0.08)',
        transition: 'background 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'white',
          top: 3,
          left: checked ? 27 : 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)',
          transition: 'left 0.25s ease',
        }}
      />
    </button>
  );
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

export default function NotificationTab({ settings, setSettings }: Props) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Bildirim Tercihleri
        </h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          E-posta ve uygulama içi bildirim ayarlarını yapılandırın.
        </p>
      </div>

      <div className="space-y-4">
        {[
          {
            key: 'emailNotifications' as const,
            icon: Mail,
            label: 'E-posta Bildirimleri',
            desc: 'Önemli olaylarda personele otomatik e-posta gönderilir',
            color: 'var(--color-info)',
          },
          {
            key: 'notifyOnComplete' as const,
            icon: Award,
            label: 'Tamamlanma Bildirimi',
            desc: 'Personel bir eğitimi başarıyla tamamladığında bildirim alın',
            color: 'var(--color-success)',
          },
          {
            key: 'notifyOnFail' as const,
            icon: BellRing,
            label: 'Başarısızlık Bildirimi',
            desc: 'Personel sınavda başarısız olduğunda bildirim alın',
            color: 'var(--color-error)',
          },
        ].map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-4 rounded-xl p-5 transition-all duration-200"
            style={{
              background: settings[item.key]
                ? `linear-gradient(135deg, ${item.color}06, ${item.color}03)`
                : 'var(--color-bg)',
              border: `1px solid ${settings[item.key] ? `${item.color}20` : 'var(--color-border)'}`,
            }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
              style={{
                background: settings[item.key] ? `${item.color}12` : 'var(--color-surface)',
                border: `1px solid ${settings[item.key] ? `${item.color}20` : 'var(--color-border)'}`,
              }}
            >
              <item.icon
                className="h-5 w-5 transition-colors duration-200"
                style={{ color: settings[item.key] ? item.color : 'var(--color-text-muted)' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold">{item.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
            </div>
            <Toggle checked={settings[item.key]} onChange={(v) => setSettings({ [item.key]: v })} />
          </div>
        ))}

        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Field
            label="Hatırlatma Zamanlaması"
            icon={CalendarClock}
            hint="Eğitim bitiş tarihinden kaç gün önce personele hatırlatma e-postası gönderilsin"
          >
            <div className="relative w-48">
              <Input
                type="number"
                min={1}
                max={30}
                value={settings.reminderDaysBefore}
                onChange={(e) => setSettings({ reminderDaysBefore: Number(e.target.value) })}
                className={`${inputClass} font-mono text-lg font-bold pr-24`}
                style={inputStyle}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>gün önce</span>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}
