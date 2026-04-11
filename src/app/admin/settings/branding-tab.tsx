'use client';

import { useState, useRef, useCallback } from 'react';
import { Palette, Upload, Image as ImageIcon, Trash2, Globe, Eye, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/* ─── Types ─── */
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
  brandColor: string;
  secondaryColor: string;
  loginBannerUrl: string;
  customDomain: string;
}

interface Props {
  settings: SettingsData;
  setSettings: (patch: Partial<SettingsData>) => void;
  saving: boolean;
  handleSave: () => void;
}

/* ─── Constants ─── */
const PRIMARY_PRESETS = ['#0F172A', '#0d9668', '#1e40af', '#7c3aed', '#dc2626', '#0891b2', '#4f46e5', '#15803d'];
const SECONDARY_PRESETS = ['#3B82F6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const inputClass = 'h-12 rounded-xl text-[13px] transition-shadow duration-200 focus:ring-2 focus:ring-[var(--color-primary)]/20';
const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)' };

/* ─── Field Wrapper ─── */
function Field({ label, hint, icon: Icon, children }: {
  label: string;
  hint?: string;
  icon: typeof Palette;
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

/* ─── Color Picker ─── */
function ColorPicker({ value, onChange, presets, label }: {
  value: string;
  onChange: (hex: string) => void;
  presets: string[];
  label: string;
}) {
  const colorRef = useRef<HTMLInputElement>(null);
  const [hexInput, setHexInput] = useState(value);

  const handleHexChange = (v: string) => {
    setHexInput(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      onChange(v);
    }
  };

  const handleColorChange = (hex: string) => {
    onChange(hex);
    setHexInput(hex);
  };

  return (
    <div>
      <Label
        className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
      >
        <Palette className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
        {label}
      </Label>

      <div className="flex items-center gap-3 mb-3">
        {/* Color swatch */}
        <button
          type="button"
          onClick={() => colorRef.current?.click()}
          className="h-12 w-12 rounded-xl border-2 shrink-0 transition-shadow hover:shadow-md cursor-pointer"
          style={{ backgroundColor: value, borderColor: 'var(--color-border)' }}
        />
        <input
          ref={colorRef}
          type="color"
          value={value}
          onChange={(e) => handleColorChange(e.target.value)}
          className="sr-only"
        />

        {/* Hex input */}
        <Input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={() => setHexInput(value)}
          placeholder="#000000"
          maxLength={7}
          className={`${inputClass} font-mono text-xs flex-1`}
          style={inputStyle}
        />
      </div>

      {/* Preset swatches */}
      <div className="flex gap-2 flex-wrap">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleColorChange(preset)}
            className="h-7 w-7 rounded-lg border-2 transition-all hover:scale-110"
            style={{
              backgroundColor: preset,
              borderColor: value === preset ? 'var(--color-primary)' : 'transparent',
              boxShadow: value === preset ? '0 0 0 2px var(--color-primary)' : 'none',
            }}
            title={preset}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Image Upload Zone ─── */
function ImageUploadZone({ value, onChange, type, maxSizeMB, hint, aspectLabel }: {
  value: string;
  onChange: (url: string) => void;
  type: 'logo' | 'login-banner';
  maxSizeMB: number;
  hint: string;
  aspectLabel: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setError('');

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Sadece PNG, JPG, SVG veya WebP dosyaları yüklenebilir.');
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Dosya boyutu ${maxSizeMB}MB'dan küçük olmalıdır.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/admin/settings/upload-branding', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Yükleme başarısız');
      }

      const { publicUrl } = await res.json();
      onChange(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme hatası');
    } finally {
      setUploading(false);
    }
  }, [maxSizeMB, onChange, type]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div>
      {/* Preview */}
      {value && (
        <div className="relative mb-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
          <img
            src={value}
            alt={type === 'logo' ? 'Logo' : 'Banner'}
            className={type === 'logo' ? 'h-20 w-20 object-contain p-2 mx-auto' : 'w-full h-32 object-cover'}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200"
        style={{
          borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-border)',
          background: dragOver ? 'var(--color-primary-light)' : 'var(--color-bg)',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Yükleniyor...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-light)' }}>
              <Upload className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Sürükle bırak veya tıkla
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {hint}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {aspectLabel}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--color-error)' }}>{error}</p>
      )}
    </div>
  );
}

/* ─── Live Preview ─── */
function LoginPreview({ settings }: { settings: SettingsData }) {
  const { brandColor, secondaryColor, logoUrl, loginBannerUrl, hospitalName } = settings;

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex h-48">
        {/* Left panel mock */}
        <div
          className="w-1/2 p-4 flex flex-col justify-between relative overflow-hidden"
          style={{
            background: loginBannerUrl
              ? `linear-gradient(135deg, ${brandColor}cc, ${brandColor}99)`
              : `linear-gradient(160deg, ${brandColor}, ${brandColor}dd)`,
          }}
        >
          {loginBannerUrl && (
            <img
              src={loginBannerUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-6 w-6 rounded object-contain" style={{ background: 'rgba(255,255,255,0.2)' }} />
              ) : (
                <div className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  H
                </div>
              )}
              <span className="text-[10px] font-semibold text-white/90">
                {hospitalName || 'Devakent Hastanesi'}
              </span>
            </div>
            <p className="text-[8px] uppercase tracking-wider font-semibold" style={{ color: secondaryColor }}>
              Personel Eğitim Platformu
            </p>
            <p className="text-white font-bold text-[13px] mt-1 leading-tight">
              Eğitimi Yönet,<br />Başarıyı Ölç.
            </p>
          </div>
        </div>

        {/* Right panel mock */}
        <div className="w-1/2 p-4 flex flex-col justify-center" style={{ background: 'var(--color-surface)' }}>
          <p className="text-[8px] uppercase tracking-wider font-semibold mb-1" style={{ color: secondaryColor }}>
            Giriş Yap
          </p>
          <p className="text-[11px] font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Hoş Geldiniz
          </p>
          <div className="space-y-2">
            <div className="h-5 rounded-md" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }} />
            <div className="h-5 rounded-md" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }} />
            <div
              className="h-5 rounded-md"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function BrandingTab({ settings, setSettings }: Props) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Marka Ayarları
        </h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Kurumunuzun görsel kimliğini özelleştirin. Logo, renkler ve giriş sayfası görünümünü yönetin.
        </p>
      </div>

      <div className="space-y-8">
        {/* Section 1: Logo */}
        <Field label="Kurum Logosu" icon={ImageIcon} hint="PNG, JPG, SVG veya WebP. Maksimum 2MB.">
          <ImageUploadZone
            value={settings.logoUrl}
            onChange={(url) => setSettings({ logoUrl: url })}
            type="logo"
            maxSizeMB={2}
            hint="PNG, JPG, SVG veya WebP"
            aspectLabel="Önerilen boyut: 200x200px"
          />
        </Field>

        {/* Section 2: Login Banner */}
        <Field label="Giriş Sayfası Görseli" icon={ImageIcon} hint="Giriş sayfasının sol panelinde arka plan olarak görünür.">
          <ImageUploadZone
            value={settings.loginBannerUrl}
            onChange={(url) => setSettings({ loginBannerUrl: url })}
            type="login-banner"
            maxSizeMB={5}
            hint="PNG, JPG veya WebP. Maks 5MB"
            aspectLabel="Önerilen boyut: 1920x1080px"
          />
        </Field>

        {/* Section 3: Colors */}
        <div
          className="rounded-xl p-5 space-y-5"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Palette className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Renk Paleti
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <ColorPicker
              value={settings.brandColor}
              onChange={(hex) => setSettings({ brandColor: hex })}
              presets={PRIMARY_PRESETS}
              label="Ana Renk"
            />
            <ColorPicker
              value={settings.secondaryColor}
              onChange={(hex) => setSettings({ secondaryColor: hex })}
              presets={SECONDARY_PRESETS}
              label="İkincil Renk"
            />
          </div>
        </div>

        {/* Section 4: Live Preview */}
        <Field label="Giriş Sayfası Önizleme" icon={Eye}>
          <LoginPreview settings={settings} />
        </Field>

        {/* Section 5: Custom Domain */}
        <Field label="Özel Alan Adı" icon={Globe}>
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            <Globe className="h-5 w-5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            <div className="flex-1 min-w-0">
              {settings.customDomain ? (
                <p className="text-[13px] font-mono font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {settings.customDomain}
                </p>
              ) : (
                <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                  Henüz yapılandırılmadı
                </p>
              )}
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Özel alan adı yapılandırması için destek ekibi ile iletişim kurun.
              </p>
            </div>
          </div>
        </Field>
      </div>
    </div>
  );
}
