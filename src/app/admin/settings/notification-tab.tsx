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
          ? 'linear-gradient(135deg, var(--brand-600), #0a7d56)'
          : '#d1d5db',
        boxShadow: checked
          ? '0 2px 10px color-mix(in srgb, var(--brand-600) calc(0.35 * 100%), transparent)'
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

export default function NotificationTab({ settings, setSettings }: Props) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Bildirim Tercihleri
        </h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--k-text-muted)' }}>
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
            color: 'var(--k-info)',
          },
          {
            key: 'notifyOnComplete' as const,
            icon: Award,
            label: 'Tamamlanma Bildirimi',
            desc: 'Personel bir eğitimi başarıyla tamamladığında bildirim alın',
            color: 'var(--k-success)',
          },
          {
            key: 'notifyOnFail' as const,
            icon: BellRing,
            label: 'Başarısızlık Bildirimi',
            desc: 'Personel sınavda başarısız olduğunda bildirim alın',
            color: 'var(--k-error)',
          },
        ].map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-4 rounded-xl p-5 transition-all duration-200"
            style={{
              background: settings[item.key]
                ? `linear-gradient(135deg, ${item.color}06, ${item.color}03)`
                : 'var(--k-surface-hover)',
              border: `1px solid ${settings[item.key] ? `${item.color}20` : 'var(--k-border)'}`,
            }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
              style={{
                background: settings[item.key] ? `${item.color}12` : 'var(--k-surface)',
                border: `1px solid ${settings[item.key] ? `${item.color}20` : 'var(--k-border)'}`,
              }}
            >
              <item.icon
                className="h-5 w-5 transition-colors duration-200"
                style={{ color: settings[item.key] ? item.color : 'var(--k-text-muted)' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold">{item.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--k-text-muted)' }}>{item.desc}</p>
            </div>
            <Toggle checked={settings[item.key]} onChange={(v) => setSettings({ [item.key]: v })} />
          </div>
        ))}

        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--k-border)' }}>
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
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold" style={{ color: 'var(--k-text-muted)' }}>gün önce</span>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}
