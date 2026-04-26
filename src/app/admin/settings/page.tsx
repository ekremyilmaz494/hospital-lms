'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Settings, Save, Building2,
  Bell, Palette, Mail,
  ChevronRight, CheckCircle2,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

const tabLoading = () => <div className="h-64 animate-pulse rounded-lg m-8" style={{ background: 'var(--k-surface-hover)' }} />;
const HospitalTab = dynamic(() => import('./hospital-tab'), { ssr: false, loading: tabLoading });
const NotificationTab = dynamic(() => import('./notification-tab'), { ssr: false, loading: tabLoading });
const BrandingTab = dynamic(() => import('./branding-tab'), { ssr: false, loading: tabLoading });
const EmailTab = dynamic(() => import('./email-tab'), { ssr: false, loading: tabLoading });

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

const defaultSettings: SettingsData = {
  defaultPassingScore: 70,
  defaultMaxAttempts: 3,
  defaultExamDuration: 30,
  hospitalName: '',
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

const tabs = [
  { id: 'hospital', label: 'Kurum', icon: Building2 },
  { id: 'branding', label: 'Marka', icon: Palette },
  { id: 'notifications', label: 'Bildirimler', icon: Bell },
  { id: 'email', label: 'E-posta', icon: Mail },
] as const;

type TabId = (typeof tabs)[number]['id'];

/* ─── Main ─── */
export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useFetch<SettingsData>('/api/admin/settings');
  const [formData, setFormData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('hospital');

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
            <p className="k-page-subtitle">Kurum bilgileri, marka, bildirim ve entegrasyon tercihleri.</p>
          </div>
        </header>
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
                  className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] transition-colors duration-200"
                  style={{
                    background: isActive ? 'var(--k-primary-light)' : 'transparent',
                    color: isActive ? 'var(--k-primary)' : 'var(--k-text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--k-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <tab.icon className="h-4 w-4" style={{ opacity: isActive ? 1 : 0.7 }} />
                  <span className="flex-1">{tab.label}</span>
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform duration-200"
                    style={{
                      opacity: isActive ? 0.9 : 0,
                      transform: isActive ? 'translateX(0)' : 'translateX(-4px)',
                    }}
                  />
                </button>
              );
            })}

            {/* Save button in sidebar */}
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
            {activeTab === 'hospital' && <HospitalTab {...tabProps} />}
            {activeTab === 'branding' && <BrandingTab {...tabProps} />}
            {activeTab === 'notifications' && <NotificationTab {...tabProps} />}
            {activeTab === 'email' && <EmailTab />}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
