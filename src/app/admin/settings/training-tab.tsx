'use client';

import { Target, RotateCcw, Clock, Info } from 'lucide-react';
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

export default function TrainingTab({ settings, setSettings }: Props) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Eğitim Yapılandırması
        </h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Yeni oluşturulan eğitimlerde varsayılan olarak kullanılacak değerleri belirleyin.
        </p>
      </div>

      <div className="space-y-8">
        {/* Passing score with visual indicator */}
        <Field
          label="Baraj Puanı"
          icon={Target}
          hint="Bu değerin altında puan alan personel sınavı geçemez."
        >
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.defaultPassingScore}
                onChange={(e) => setSettings({ defaultPassingScore: Number(e.target.value) })}
                className={`${inputClass} font-mono text-lg font-bold pr-10`}
                style={inputStyle}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>%</span>
            </div>
            <div className="w-48 shrink-0">
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(settings.defaultPassingScore, 100)}%`,
                    background: settings.defaultPassingScore >= 80
                      ? 'linear-gradient(90deg, var(--color-success), var(--brand-400))'
                      : settings.defaultPassingScore >= 50
                        ? 'linear-gradient(90deg, var(--color-accent), #fbbf24)'
                        : 'linear-gradient(90deg, var(--color-error), #f87171)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-6">
          <Field
            label="Deneme Hakkı"
            icon={RotateCcw}
            hint="Başarısız olan personelin kaç kez tekrar deneyebileceği"
          >
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.defaultMaxAttempts}
              onChange={(e) => setSettings({ defaultMaxAttempts: Number(e.target.value) })}
              className={`${inputClass} font-mono text-lg font-bold`}
              style={inputStyle}
            />
          </Field>

          <Field
            label="Sınav Süresi"
            icon={Clock}
            hint="Süre dolduğunda sınav otomatik olarak gönderilir"
          >
            <div className="relative">
              <Input
                type="number"
                min={5}
                max={180}
                value={settings.defaultExamDuration}
                onChange={(e) => setSettings({ defaultExamDuration: Number(e.target.value) })}
                className={`${inputClass} font-mono text-lg font-bold pr-20`}
                style={inputStyle}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>dakika</span>
            </div>
          </Field>
        </div>

        {/* Info banner */}
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{
            background: 'var(--color-info-bg)',
            border: '1px solid rgba(37, 99, 235, 0.1)',
          }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-info)' }} />
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-info)' }}>
            Bu değerler yalnızca yeni oluşturulan eğitimlere uygulanır. Mevcut eğitimlerin ayarlarını değiştirmek için eğitim düzenleme sayfasını kullanın.
          </p>
        </div>
      </div>
    </div>
  );
}
