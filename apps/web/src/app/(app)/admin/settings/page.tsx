'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Building2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import OrganizationTab from './organization-tab';


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
  brandColor: string;
  secondaryColor: string;
  loginBannerUrl: string;
  customDomain: string;
}

const defaultSettings: SettingsData = {
  defaultPassingScore: 70,
  defaultMaxAttempts: 3,
  defaultExamDuration: 30,
  organizationName: '',
  logoUrl: '',
  email: '',
  phone: '',
  address: '',
  emailNotifications: true,
  reminderDaysBefore: 3,
  notifyOnComplete: true,
  notifyOnFail: true,
  sessionTimeout: 30,
  brandColor: '#0F172A',
  secondaryColor: '#3B82F6',
  loginBannerUrl: '',
  customDomain: '',
};


/* ─── Main ─── */
export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useFetch<SettingsData>('/api/admin/settings');
  const [formData, setFormData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setFormData({ ...defaultSettings, ...data });
  }, [data]);

  // API başarısız olsa bile defaultSettings ile sayfayı göster
  const activeData: SettingsData = formData ?? (data ? { ...defaultSettings, ...data } : defaultSettings);

  const update = useCallback(
    (patch: Partial<SettingsData>) => {
      setFormData({ ...activeData, ...patch });
    },
    [activeData],
  );

  if (isLoading) return <PageLoading />;

  // error var ama API'den veri gelmemişse bile sayfayı göster (default değerlerle)
  // (useFetch 401/500 hatalarını sessizce yuttuğu için error genellikle null gelir)

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

  const tabProps = { settings: activeData, setSettings: update, saving, handleSave };

  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span data-current="true">Ayarlar</span>
            </div>
            <h1 className="k-page-title">Platform Ayarları</h1>
            <p className="k-page-subtitle">Kurum bilgileri ve iletişim detayları.</p>
          </div>
        </header>
      </BlurFade>

      <div className="flex gap-8">
        {/* Settings navigation */}
        <BlurFade delay={0.05}>
          <nav className="w-56 shrink-0 space-y-1.5 sticky top-24">
            <div
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px]"
              style={{
                background: 'var(--k-primary-light)',
                color: 'var(--k-primary)',
                fontWeight: 600,
              }}
            >
              <Building2 className="h-4 w-4" />
              <span className="flex-1">Kurum</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>

            <div className="pt-4 mt-4" style={{ borderTop: '1px solid var(--k-border)' }}>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="k-btn k-btn-primary w-full justify-center"
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
              background: 'var(--k-surface)',
              borderColor: 'var(--k-border)',
              boxShadow: 'var(--k-shadow-sm)',
            }}
          >
            <OrganizationTab {...tabProps} />
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
