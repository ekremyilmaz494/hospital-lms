'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, User, Building2, Phone, Mail, Briefcase, Check } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

// ── Klinova palette ──
const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface StaffEditData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string | null;
  departmentId: string | null;
  title: string;
  initials: string;
  isActive: boolean;
}

interface Dept {
  id: string;
  name: string;
}

export default function EditStaffPage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data, isLoading, error } = useFetch<StaffEditData>(id ? `/api/admin/staff/${id}?fields=edit` : null);
  const { data: deptsData } = useFetch<Dept[]>('/api/admin/departments');
  const [formData, setFormData] = useState<StaffEditData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setFormData({ ...data });
  }, [data]);

  const departments = useMemo(() => deptsData ?? [], [deptsData]);

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, color: K.ERROR }}>{error}</p>
      </div>
    );
  }

  if (!formData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, color: K.TEXT_MUTED }}>Personel bulunamadı.</p>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Ad zorunludur';
    if (!formData.lastName.trim()) e.lastName = 'Soyad zorunludur';
    if (formData.phone && !/^0\d{10}$/.test(formData.phone.replace(/\s/g, ''))) e.phone = 'Geçerli telefon formatı: 05XX XXX XX XX';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          title: formData.title,
          departmentId: formData.departmentId || undefined,
          department: formData.department || undefined,
          isActive: formData.isActive,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      setSaved(true);
      toast('Değişiklikler kaydedildi', 'success');
      setTimeout(() => router.push('/admin/staff'), 900);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string | boolean | null) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const cardStyle: React.CSSProperties = {
    padding: 28,
    background: K.SURFACE,
    border: `1.5px solid ${K.BORDER}`,
    borderRadius: 14,
    boxShadow: K.SHADOW_CARD,
  };

  const eyebrowStyle: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: K.FONT_DISPLAY,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: K.TEXT_MUTED,
    marginBottom: 4,
  };

  return (
    <div className="se-page">
      {/* ── Header ── */}
      <header
        className="se-header"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          paddingBottom: 24,
          borderBottom: `1px solid ${K.BORDER_LIGHT}`,
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Geri dön"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 36,
            padding: '0 14px 0 12px',
            borderRadius: 999,
            background: K.SURFACE,
            color: K.TEXT_SECONDARY,
            border: `1px solid ${K.BORDER}`,
            cursor: 'pointer',
            fontFamily: K.FONT_DISPLAY,
            fontSize: 12,
            fontWeight: 600,
            alignSelf: 'flex-start',
            transition: 'background 160ms ease, color 160ms ease',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Personel</span>
        </button>

        <div className="se-header-main">
          <Avatar className="se-avatar">
            <AvatarFallback
              className="se-avatar-fb"
              style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}
            >
              {formData.initials}
            </AvatarFallback>
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={eyebrowStyle}>Personel Düzenle</span>
            <h1 style={{
              fontFamily: K.FONT_DISPLAY,
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 700,
              color: K.TEXT_PRIMARY,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: 0,
            }}>
              {formData.firstName} {formData.lastName}
            </h1>
            <p style={{
              fontSize: 13,
              color: K.TEXT_MUTED,
              margin: '6px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              {formData.email}
              {!formData.isActive && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 10px',
                  borderRadius: 999,
                  background: K.ERROR_BG,
                  color: '#b91c1c',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Pasif
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* ── Sections ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Personal Info */}
        <section style={cardStyle}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 24,
            paddingBottom: 18,
            borderBottom: `1px dashed ${K.BORDER_LIGHT}`,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: K.PRIMARY_LIGHT, color: K.PRIMARY,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <User className="h-4 w-4" />
            </div>
            <div>
              <span style={eyebrowStyle}>Bölüm 01</span>
              <h2 style={{
                fontFamily: K.FONT_DISPLAY,
                fontSize: 18,
                fontWeight: 700,
                color: K.TEXT_PRIMARY,
                letterSpacing: '-0.015em',
                lineHeight: 1.1,
                margin: 0,
              }}>
                Kişisel Bilgiler
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="se-row">
              <Field label="Ad *" error={errors.firstName}>
                <Input
                  value={formData.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  autoComplete="given-name"
                  className="se-input"
                  style={inputStyle(errors.firstName)}
                />
              </Field>
              <Field label="Soyad *" error={errors.lastName}>
                <Input
                  value={formData.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  autoComplete="family-name"
                  className="se-input"
                  style={inputStyle(errors.lastName)}
                />
              </Field>
            </div>

            <Field label="E-posta" icon={<Mail className="h-3 w-3" />} hint="E-posta adresi değiştirilemez.">
              <Input
                value={formData.email}
                disabled
                autoComplete="email"
                className="se-input"
                style={{
                  ...inputStyle(),
                  background: K.BG,
                  color: K.TEXT_MUTED,
                  cursor: 'not-allowed',
                }}
              />
            </Field>

            <Field label="Telefon" icon={<Phone className="h-3 w-3" />} error={errors.phone}>
              <Input
                value={formData.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
                placeholder="05XX XXX XX XX"
                className="se-input"
                style={{
                  ...inputStyle(errors.phone),
                  fontFamily: 'var(--font-mono, monospace)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </Field>
          </div>
        </section>

        {/* Work Info */}
        <section style={cardStyle}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 24,
            paddingBottom: 18,
            borderBottom: `1px dashed ${K.BORDER_LIGHT}`,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: K.PRIMARY_LIGHT, color: K.PRIMARY,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <span style={eyebrowStyle}>Bölüm 02</span>
              <h2 style={{
                fontFamily: K.FONT_DISPLAY,
                fontSize: 18,
                fontWeight: 700,
                color: K.TEXT_PRIMARY,
                letterSpacing: '-0.015em',
                lineHeight: 1.1,
                margin: 0,
              }}>
                Görev Bilgileri
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="se-row">
              <Field label="Departman" icon={<Building2 className="h-3 w-3" />}>
                <select
                  value={formData.departmentId ?? ''}
                  onChange={(e) => {
                    update('departmentId', e.target.value);
                    const selectedName = departments.find(d => d.id === e.target.value)?.name;
                    if (selectedName) update('department', selectedName);
                  }}
                  className="se-select"
                  style={inputStyle()}
                >
                  <option value="">Seçin...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Unvan">
                <Input
                  value={formData.title}
                  onChange={(e) => update('title', e.target.value)}
                  className="se-input"
                  placeholder="örn. Hemşire"
                  style={inputStyle()}
                />
              </Field>
            </div>

            {/* Active/Inactive toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              padding: '16px 18px',
              background: K.BG,
              border: `1px solid ${K.BORDER_LIGHT}`,
              borderRadius: 12,
            }}>
              <button
                type="button"
                onClick={() => update('isActive', !formData.isActive)}
                role="switch"
                aria-checked={formData.isActive}
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 26,
                  borderRadius: 999,
                  background: formData.isActive ? K.PRIMARY : K.BORDER,
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  position: 'relative',
                  transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 3,
                  left: formData.isActive ? 21 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: '#ffffff',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.15)',
                  transition: 'left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                }} />
              </button>
              <div>
                <h4 style={{
                  fontFamily: K.FONT_DISPLAY,
                  fontSize: 13,
                  fontWeight: 700,
                  color: K.TEXT_PRIMARY,
                  margin: '0 0 4px',
                }}>
                  {formData.isActive ? 'Aktif personel' : 'Pasif personel'}
                </h4>
                <p style={{
                  fontSize: 12,
                  color: K.TEXT_SECONDARY,
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  {formData.isActive
                    ? 'Giriş yapabilir, eğitimlere erişebilir ve raporlarda görünür.'
                    : 'Sisteme giriş yapamaz, eğitimlere erişemez ve raporlarda görünmez.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Sticky action bar ── */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 8,
          background: `linear-gradient(to top, ${K.BG} 0%, ${K.BG} 75%, rgba(250, 250, 249, 0) 100%)`,
          padding: '16px 0 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          zIndex: 5,
        }}
      >
        <button
          onClick={() => router.back()}
          disabled={saving}
          style={{
            ...btnBase,
            background: K.SURFACE,
            color: K.TEXT_SECONDARY,
            border: `1px solid ${K.BORDER}`,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          İptal
        </button>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            ...btnBase,
            background: saved ? K.SUCCESS : K.PRIMARY,
            color: '#fff',
            border: `1px solid ${saved ? K.SUCCESS : K.PRIMARY}`,
            opacity: (saving || saved) ? (saved ? 1 : 0.7) : 1,
            cursor: (saving || saved) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#ffffff',
                  animation: 'se-rot 700ms linear infinite',
                  display: 'inline-block',
                }}
              />
              <span>Kaydediliyor…</span>
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              <span>Kaydedildi</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Değişiklikleri Kaydet</span>
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        .se-page {
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 28px;
          padding-bottom: 100px;
        }

        .se-header-main { display: flex; align-items: center; gap: 18px; }
        :global(.se-avatar) {
          width: 64px !important;
          height: 64px !important;
          flex-shrink: 0;
          border: 1.5px solid ${K.BORDER};
        }
        :global(.se-avatar-fb) {
          font-size: 22px !important;
          font-weight: 700 !important;
        }

        .se-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        :global(.se-input),
        :global(.se-select) {
          height: 44px !important;
          border-radius: 10px !important;
          padding: 0 14px !important;
          font-size: 14px !important;
          font-family: inherit !important;
          transition: border-color 160ms ease, box-shadow 160ms ease !important;
        }
        :global(.se-input:focus-visible),
        :global(.se-select:focus-visible) {
          border-color: ${K.PRIMARY} !important;
          box-shadow: 0 0 0 3px ${K.PRIMARY_LIGHT} !important;
          outline: none !important;
        }

        @keyframes se-rot { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .se-row { grid-template-columns: 1fr; }
          .se-header-main { gap: 14px; }
          :global(.se-avatar) { width: 56px !important; height: 56px !important; }
        }
      `}</style>
    </div>
  );
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: 44,
  padding: '0 22px',
  borderRadius: 999,
  fontFamily: K.FONT_DISPLAY,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.005em',
  transition: 'background 160ms ease, border-color 160ms ease',
};

function inputStyle(err?: string): React.CSSProperties {
  return {
    border: `1.5px solid ${err ? K.ERROR : K.BORDER}`,
    background: K.SURFACE,
    color: K.TEXT_PRIMARY,
  };
}

// ── Field helper ──
function Field({
  label, icon, error, hint, children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: K.FONT_DISPLAY,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: K.TEXT_MUTED,
      }}>
        {icon && <span style={{ color: K.TEXT_MUTED, display: 'inline-flex' }}>{icon}</span>}
        {label}
      </Label>
      {children}
      {error ? (
        <p style={{ fontSize: 11, color: K.ERROR, margin: 0, fontWeight: 500 }}>{error}</p>
      ) : hint ? (
        <p style={{ fontSize: 11, color: K.TEXT_MUTED, margin: 0, fontStyle: 'italic' }}>{hint}</p>
      ) : null}
    </div>
  );
}
