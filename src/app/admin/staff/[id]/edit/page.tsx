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
      <div className="se-empty">
        <p className="se-empty-msg">{error}</p>
        <style jsx>{`
          .se-empty { display: flex; align-items: center; justify-content: center; min-height: 300px; }
          .se-empty-msg { font-family: var(--font-editorial, serif); font-size: 16px; color: #b3261e; }
        `}</style>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="se-empty">
        <p className="se-empty-msg">Personel bulunamadı.</p>
        <style jsx>{`
          .se-empty { display: flex; align-items: center; justify-content: center; min-height: 300px; }
          .se-empty-msg { font-family: var(--font-editorial, serif); font-size: 18px; color: #6b6a63; }
        `}</style>
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

  return (
    <div className="se-page">
      {/* ── Header ── */}
      <header className="se-header">
        <button onClick={() => router.back()} className="se-back" aria-label="Geri dön">
          <ArrowLeft className="h-4 w-4" />
          <span>Personel</span>
        </button>

        <div className="se-header-main">
          <Avatar className="se-avatar">
            <AvatarFallback className="se-avatar-fb">{formData.initials}</AvatarFallback>
          </Avatar>
          <div className="se-identity">
            <span className="se-eyebrow">Personel Düzenle</span>
            <h1 className="se-title">
              <em>{formData.firstName}</em> {formData.lastName}
            </h1>
            <p className="se-subtitle">
              {formData.email}
              {!formData.isActive && <span className="se-inactive-chip">Pasif</span>}
            </p>
          </div>
        </div>
      </header>

      {/* ── Sections ── */}
      <div className="se-sections">
        {/* Personal Info */}
        <section className="se-card">
          <div className="se-card-head">
            <div className="se-card-icon"><User className="h-4 w-4" /></div>
            <div>
              <span className="se-card-eyebrow">Bölüm 01</span>
              <h2 className="se-card-title">Kişisel Bilgiler</h2>
            </div>
          </div>

          <div className="se-fields">
            <div className="se-row">
              <Field label="Ad *" error={errors.firstName}>
                <Input
                  value={formData.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  autoComplete="given-name"
                  className="se-input"
                  style={errorStyle(errors.firstName)}
                />
              </Field>
              <Field label="Soyad *" error={errors.lastName}>
                <Input
                  value={formData.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  autoComplete="family-name"
                  className="se-input"
                  style={errorStyle(errors.lastName)}
                />
              </Field>
            </div>

            <Field label="E-posta" icon={<Mail className="h-3 w-3" />} hint="E-posta adresi değiştirilemez.">
              <Input
                value={formData.email}
                disabled
                autoComplete="email"
                className="se-input se-input-disabled"
              />
            </Field>

            <Field label="Telefon" icon={<Phone className="h-3 w-3" />} error={errors.phone}>
              <Input
                value={formData.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
                placeholder="05XX XXX XX XX"
                className="se-input se-input-mono"
                style={errorStyle(errors.phone)}
              />
            </Field>
          </div>
        </section>

        {/* Work Info */}
        <section className="se-card">
          <div className="se-card-head">
            <div className="se-card-icon"><Briefcase className="h-4 w-4" /></div>
            <div>
              <span className="se-card-eyebrow">Bölüm 02</span>
              <h2 className="se-card-title">Görev Bilgileri</h2>
            </div>
          </div>

          <div className="se-fields">
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
                />
              </Field>
            </div>

            {/* Active/Inactive toggle */}
            <div className="se-toggle-row">
              <button
                type="button"
                onClick={() => update('isActive', !formData.isActive)}
                className={`se-toggle ${formData.isActive ? 'se-toggle-on' : ''}`}
                role="switch"
                aria-checked={formData.isActive}
              >
                <span className="se-toggle-dot" />
              </button>
              <div className="se-toggle-body">
                <h4>{formData.isActive ? 'Aktif personel' : 'Pasif personel'}</h4>
                <p>
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
      <div className="se-actions">
        <button className="se-btn se-btn-ghost" onClick={() => router.back()} disabled={saving}>
          İptal
        </button>
        <button
          className={`se-btn ${saved ? 'se-btn-ok' : 'se-btn-primary'}`}
          onClick={handleSave}
          disabled={saving || saved}
        >
          {saving ? (
            <>
              <span className="se-spin" />
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
          padding-bottom: 100px; /* space for sticky actions on mobile */
        }

        /* ── Header ── */
        .se-header {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-bottom: 24px;
          border-bottom: 1px solid #ebe7df;
        }
        .se-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px 0 10px;
          border-radius: 999px;
          background: #faf8f2;
          color: #6b6a63;
          border: none;
          cursor: pointer;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 500;
          align-self: flex-start;
          transition: background 160ms ease, color 160ms ease;
        }
        .se-back:hover { background: #0a0a0a; color: #fafaf7; }

        .se-header-main { display: flex; align-items: center; gap: 18px; }
        :global(.se-avatar) {
          width: 64px !important;
          height: 64px !important;
          flex-shrink: 0;
          border: 1px solid #ebe7df;
          box-shadow: inset 0 0 0 3px #fff, 0 0 0 1px #ebe7df;
        }
        :global(.se-avatar-fb) {
          background: #0a0a0a !important;
          color: #fafaf7 !important;
          font-family: var(--font-editorial, serif);
          font-size: 22px !important;
          font-weight: 500 !important;
          font-variation-settings: 'opsz' 36, 'SOFT' 50;
        }
        .se-identity { min-width: 0; flex: 1; }
        .se-eyebrow {
          display: inline-block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 4px;
        }
        .se-title {
          font-family: var(--font-editorial, serif);
          font-size: clamp(26px, 4vw, 36px);
          font-weight: 500;
          font-variation-settings: 'opsz' 56, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0;
        }
        .se-title em {
          font-style: italic;
          color: #0a7a47;
          font-variation-settings: 'opsz' 56, 'SOFT' 100;
        }
        .se-subtitle {
          font-size: 13px;
          color: #6b6a63;
          margin: 6px 0 0;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .se-inactive-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 10px;
          border-radius: 999px;
          background: #fdf5f2;
          color: #b3261e;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* ── Sections ── */
        .se-sections { display: flex; flex-direction: column; gap: 18px; }

        .se-card {
          padding: 28px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 2px rgba(10, 10, 10, 0.02);
        }
        .se-card-head {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
          padding-bottom: 18px;
          border-bottom: 1px dashed #ebe7df;
        }
        .se-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #0a0a0a;
          color: #fafaf7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .se-card-eyebrow {
          display: block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 2px;
        }
        .se-card-title {
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          font-variation-settings: 'opsz' 36, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.015em;
          line-height: 1.1;
          margin: 0;
        }

        .se-fields { display: flex; flex-direction: column; gap: 20px; }
        .se-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* Field (see Field component below) */
        :global(.se-input),
        :global(.se-select) {
          height: 44px !important;
          border-radius: 10px !important;
          border: 1px solid #ebe7df !important;
          background: #ffffff !important;
          padding: 0 14px !important;
          font-size: 14px !important;
          color: #0a0a0a !important;
          font-family: inherit !important;
          transition: border-color 160ms ease, box-shadow 160ms ease !important;
        }
        :global(.se-input:focus-visible),
        :global(.se-select:focus-visible) {
          border-color: #0a0a0a !important;
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.06) !important;
          outline: none !important;
        }
        :global(.se-input-mono) {
          font-family: var(--font-mono, monospace) !important;
          font-variant-numeric: tabular-nums !important;
        }
        :global(.se-input-disabled) {
          background: #faf8f2 !important;
          color: #8a8578 !important;
          cursor: not-allowed;
        }

        /* Active toggle */
        .se-toggle-row {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px 18px;
          background: #faf8f2;
          border: 1px solid #ebe7df;
          border-radius: 12px;
        }
        .se-toggle {
          flex-shrink: 0;
          width: 44px;
          height: 26px;
          border-radius: 999px;
          background: #d9d4c4;
          border: none;
          cursor: pointer;
          padding: 0;
          position: relative;
          transition: background 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .se-toggle-on { background: #0a7a47; }
        .se-toggle-dot {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(10, 10, 10, 0.15);
          transition: left 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .se-toggle-on .se-toggle-dot { left: 21px; }
        .se-toggle:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 2px; }

        .se-toggle-body h4 {
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 600;
          color: #0a0a0a;
          margin: 0 0 4px;
        }
        .se-toggle-body p {
          font-size: 12px;
          color: #6b6a63;
          margin: 0;
          line-height: 1.5;
        }

        /* ── Sticky action bar ── */
        .se-actions {
          position: sticky;
          bottom: 0;
          margin-top: 8px;
          background: linear-gradient(to top, #fafaf7 0%, #fafaf7 75%, rgba(250, 250, 247, 0) 100%);
          padding: 16px 0 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          z-index: 5;
        }
        .se-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 22px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.005em;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 160ms ease, border-color 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .se-btn:active:not(:disabled) { transform: scale(0.97); }
        .se-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .se-btn-ghost { background: transparent; color: #6b6a63; border-color: #ebe7df; }
        .se-btn-ghost:hover:not(:disabled) { background: #faf8f2; color: #0a0a0a; border-color: #0a0a0a; }

        .se-btn-primary { background: #0a0a0a; color: #fafaf7; box-shadow: inset 0 1px 0 rgba(255,255,255,0.1); }
        .se-btn-primary:hover:not(:disabled) { background: #1a1a1a; }

        .se-btn-ok { background: #0a7a47; color: #fafaf7; }

        .se-spin {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          animation: se-rot 700ms linear infinite;
        }
        @keyframes se-rot { to { transform: rotate(360deg); } }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .se-row { grid-template-columns: 1fr; }
          .se-card { padding: 22px 20px; }
          .se-header-main { gap: 14px; }
          :global(.se-avatar) { width: 56px !important; height: 56px !important; }
          .se-toggle-row { padding: 14px 16px; }
          .se-btn { flex: 1; padding: 0 16px; }
        }

        @media (max-width: 420px) {
          .se-card-head { gap: 12px; margin-bottom: 20px; padding-bottom: 14px; }
          .se-card-title { font-size: 18px; }
        }
      `}</style>
    </div>
  );
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
    <div className="f-root">
      <Label className="f-label">
        {icon && <span className="f-label-icon">{icon}</span>}
        {label}
      </Label>
      {children}
      {error ? (
        <p className="f-err">{error}</p>
      ) : hint ? (
        <p className="f-hint">{hint}</p>
      ) : null}
      <style jsx>{`
        .f-root { display: flex; flex-direction: column; gap: 6px; }
        :global(.f-label) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #6b6a63;
        }
        .f-label-icon { color: #8a8578; display: inline-flex; }
        .f-err { font-size: 11px; color: #b3261e; margin: 0; font-weight: 500; }
        .f-hint { font-size: 11px; color: #8a8578; margin: 0; font-style: italic; }
      `}</style>
    </div>
  );
}

function errorStyle(err?: string): React.CSSProperties {
  return err ? { borderColor: '#b3261e' } : {};
}
