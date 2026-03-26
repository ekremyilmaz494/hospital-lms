'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Save, Building2, Mail, Globe,
  GraduationCap, Clock, Target, RotateCcw, Bell, BellRing, CalendarClock,
  Shield, Key, Monitor, HardDrive, Users, BookOpen, Award, Info,
  CheckCircle2, ChevronRight, Database, Cloud, Lock, Fingerprint,
  Zap, Activity, Timer,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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

interface SystemStats {
  staffCount: number;
  trainingCount: number;
  departmentCount: number;
  completedAssignments: number;
}

const defaultNotifSettings = {
  emailNotifications: true,
  reminderDaysBefore: 3,
  notifyOnComplete: true,
  notifyOnFail: true,
};

const tabs = [
  { id: 'hospital', label: 'Kurum', icon: Building2 },
  { id: 'training', label: 'Eğitim', icon: GraduationCap },
  { id: 'notifications', label: 'Bildirimler', icon: Bell },
  { id: 'system', label: 'Sistem', icon: Monitor },
] as const;

type TabId = (typeof tabs)[number]['id'];

/* ─── Toggle ─── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative h-6.5 w-12 shrink-0 rounded-full transition-all duration-300"
      style={{
        background: checked
          ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))'
          : 'var(--color-border)',
        boxShadow: checked ? '0 2px 8px rgba(13, 150, 104, 0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <span
        className="absolute top-0.75 h-5 w-5 rounded-full transition-all duration-300"
        style={{
          transform: checked ? 'translateX(24px)' : 'translateX(3px)',
          background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

/* ─── Field wrapper ─── */
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

/* ─── Stat pill ─── */
function StatPill({ icon: Icon, label, value, color }: {
  icon: typeof Users;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(135deg, ${color}08, ${color}04)`,
        border: `1px solid ${color}18`,
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}12` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-xl font-bold font-mono tracking-tight">{value}</p>
      </div>
    </div>
  );
}

/* ─── Security row ─── */
function SecurityRow({ icon: Icon, label, value }: {
  icon: typeof Shield;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-150"
      style={{ background: 'var(--color-bg)' }}
    >
      <Icon className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
      <span className="flex-1 text-[13px]">{label}</span>
      <span
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
        style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
      >
        <CheckCircle2 className="h-3 w-3" />
        {value}
      </span>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading, error } = useFetch<SettingsData>('/api/admin/settings');
  const { data: statsData } = useFetch<SystemStats>('/api/admin/dashboard/stats');
  const [formData, setFormData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('hospital');

  useEffect(() => {
    if (data) setFormData({ ...defaultNotifSettings, ...data });
  }, [data]);

  const activeData = formData ?? (data ? { ...defaultNotifSettings, ...data } : null);

  const update = useCallback(
    (patch: Partial<SettingsData>) => {
      if (activeData) setFormData({ ...activeData, ...patch });
    },
    [activeData],
  );

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  if (!activeData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Ayarlar yüklenemedi</div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      setSaved(true);
      toast('Ayarlar başarıyla kaydedildi', 'success');
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'h-12 rounded-xl text-[13px] transition-shadow duration-200 focus:ring-2 focus:ring-[var(--color-primary)]/20';
  const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)' };

  return (
    <div className="space-y-0">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
              }}
            >
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Platform Ayarları
              </h1>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                Kurum bilgileri, eğitim yapılandırması ve bildirim tercihleri
              </p>
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="flex gap-8">
        {/* Sidebar tabs */}
        <BlurFade delay={0.05}>
          <nav className="w-56 shrink-0 space-y-1.5 sticky top-24">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium transition-all duration-200"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))'
                      : 'transparent',
                    color: isActive ? 'white' : 'var(--color-text-secondary)',
                    boxShadow: isActive ? '0 4px 12px rgba(13, 150, 104, 0.2)' : 'none',
                  }}
                >
                  <tab.icon className="h-4 w-4" style={{ opacity: isActive ? 1 : 0.6 }} />
                  <span className="flex-1">{tab.label}</span>
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform duration-200"
                    style={{
                      opacity: isActive ? 0.8 : 0,
                      transform: isActive ? 'translateX(0)' : 'translateX(-4px)',
                    }}
                  />
                </button>
              );
            })}

            {/* Save button in sidebar */}
            <div className="pt-4 mt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold text-white transition-all duration-300 disabled:opacity-70"
                style={{
                  background: saved
                    ? 'linear-gradient(135deg, #059669, #047857)'
                    : 'linear-gradient(135deg, var(--color-primary), #065f46)',
                  boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
                }}
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Kaydediliyor...
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Kaydedildi
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Kaydet
                  </>
                )}
              </button>
            </div>
          </nav>
        </BlurFade>

        {/* Content */}
        <BlurFade delay={0.1} className="flex-1 min-w-0">
          <div
            className="rounded-2xl border"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* ─── Kurum ─── */}
            {activeTab === 'hospital' && (
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
                      value={activeData.hospitalName}
                      onChange={(e) => update({ hospitalName: e.target.value })}
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
                          value={activeData.email ?? ''}
                          onChange={(e) => update({ email: e.target.value })}
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
                          value={activeData.phone ?? ''}
                          onChange={(e) => update({ phone: e.target.value })}
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
                        value={activeData.address ?? ''}
                        onChange={(e) => update({ address: e.target.value })}
                        placeholder="Hastane adresi..."
                        rows={2}
                        className="rounded-xl resize-none text-[13px]"
                        style={{ ...inputStyle, background: 'var(--color-surface)' }}
                      />
                    </div>
                  </div>

                  <Field label="Logo URL" icon={Globe} hint="Logo dosyanızın tam URL adresini girin. Önerilen boyut: 200x200px">
                    <Input
                      value={activeData.logoUrl ?? ''}
                      onChange={(e) => update({ logoUrl: e.target.value })}
                      placeholder="https://cdn.example.com/logo.png"
                      className={`${inputClass} font-mono text-xs`}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* ─── Eğitim ─── */}
            {activeTab === 'training' && (
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
                          value={activeData.defaultPassingScore}
                          onChange={(e) => update({ defaultPassingScore: Number(e.target.value) })}
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
                              width: `${Math.min(activeData.defaultPassingScore, 100)}%`,
                              background: activeData.defaultPassingScore >= 80
                                ? 'linear-gradient(90deg, var(--color-success), #34d399)'
                                : activeData.defaultPassingScore >= 50
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
                        value={activeData.defaultMaxAttempts}
                        onChange={(e) => update({ defaultMaxAttempts: Number(e.target.value) })}
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
                          value={activeData.defaultExamDuration}
                          onChange={(e) => update({ defaultExamDuration: Number(e.target.value) })}
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
            )}

            {/* ─── Bildirimler ─── */}
            {activeTab === 'notifications' && (
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
                        background: activeData[item.key]
                          ? `linear-gradient(135deg, ${item.color}06, ${item.color}03)`
                          : 'var(--color-bg)',
                        border: `1px solid ${activeData[item.key] ? `${item.color}20` : 'var(--color-border)'}`,
                      }}
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
                        style={{
                          background: activeData[item.key] ? `${item.color}12` : 'var(--color-surface)',
                          border: `1px solid ${activeData[item.key] ? `${item.color}20` : 'var(--color-border)'}`,
                        }}
                      >
                        <item.icon
                          className="h-5 w-5 transition-colors duration-200"
                          style={{ color: activeData[item.key] ? item.color : 'var(--color-text-muted)' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold">{item.label}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
                      </div>
                      <Toggle checked={activeData[item.key]} onChange={(v) => update({ [item.key]: v })} />
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
                          value={activeData.reminderDaysBefore}
                          onChange={(e) => update({ reminderDaysBefore: Number(e.target.value) })}
                          className={`${inputClass} font-mono text-lg font-bold pr-24`}
                          style={inputStyle}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>gün önce</span>
                      </div>
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Sistem ─── */}
            {activeTab === 'system' && (
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    Sistem Durumu
                  </h2>
                  <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Platform istatistikleri, altyapı bilgileri ve güvenlik durumu.
                  </p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <StatPill icon={Users} label="Toplam Personel" value={statsData?.staffCount ?? '—'} color="var(--color-primary)" />
                  <StatPill icon={BookOpen} label="Aktif Eğitim" value={statsData?.trainingCount ?? '—'} color="var(--color-info)" />
                  <StatPill icon={Award} label="Tamamlanan Atama" value={statsData?.completedAssignments ?? '—'} color="var(--color-success)" />
                  <StatPill icon={Building2} label="Departman" value={statsData?.departmentCount ?? '—'} color="var(--color-accent)" />
                </div>

                {/* Infrastructure */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                    <h3 className="text-[13px] font-bold">Altyapı</h3>
                  </div>
                  <div
                    className="grid grid-cols-4 gap-px rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--color-border)' }}
                  >
                    {[
                      { label: 'Versiyon', value: 'v0.1.0', icon: Activity },
                      { label: 'Veritabanı', value: 'PostgreSQL', icon: Database },
                      { label: 'Depolama', value: 'AWS S3', icon: Cloud },
                      { label: 'CDN', value: 'CloudFront', icon: Globe },
                    ].map((item) => (
                      <div key={item.label} className="p-4 text-center" style={{ background: 'var(--color-bg)' }}>
                        <item.icon className="h-4 w-4 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                        <p className="text-[13px] font-bold font-mono">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session Timeout */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Timer className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
                    <h3 className="text-[13px] font-bold">Oturum Sonlandırma</h3>
                  </div>
                  <div
                    className="rounded-xl p-5 space-y-4"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'var(--color-warning-bg)' }}
                      >
                        <Timer className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold mb-1">İnaktivite Süresi</p>
                        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                          Personel belirtilen süre boyunca işlem yapmadığında oturum otomatik olarak sonlandırılır.
                          Hastane ortamında paylaşılan bilgisayarlar için güvenlik açısından önemlidir.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <div className="relative w-48">
                        <Input
                          type="number"
                          min={5}
                          max={480}
                          value={activeData.sessionTimeout}
                          onChange={(e) => update({ sessionTimeout: Number(e.target.value) })}
                          className={`${inputClass} font-mono text-lg font-bold pr-24`}
                          style={inputStyle}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>dakika</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[15, 30, 60, 120].map((v) => (
                          <button
                            key={v}
                            onClick={() => update({ sessionTimeout: v })}
                            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors duration-150"
                            style={{
                              background: activeData.sessionTimeout === v ? 'var(--color-primary)' : 'var(--color-surface)',
                              color: activeData.sessionTimeout === v ? 'white' : 'var(--color-text-muted)',
                              border: `1px solid ${activeData.sessionTimeout === v ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            }}
                          >
                            {v} dk
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      className="flex items-start gap-2.5 rounded-lg p-3"
                      style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(245, 158, 11, 0.1)' }}
                    >
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                        Çok kısa süre (5-10 dk) eğitim izlerken oturum kapanmasına neden olabilir.
                        Çok uzun süre (&gt;120 dk) paylaşılan cihazlarda güvenlik riski oluşturabilir.
                        Önerilen: <strong>30 dakika</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Security */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-[13px] font-bold">Güvenlik</h3>
                    <span
                      className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-success)' }} />
                      Tüm sistemler aktif
                    </span>
                  </div>
                  <div className="space-y-2">
                    <SecurityRow icon={Key} label="Oturum Yönetimi" value="JWT + SSR" />
                    <SecurityRow icon={Lock} label="Row Level Security" value="Aktif" />
                    <SecurityRow icon={Fingerprint} label="RBAC Koruması" value="Aktif" />
                    <SecurityRow icon={HardDrive} label="Veri Şifreleme" value="AES-256" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
