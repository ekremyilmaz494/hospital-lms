'use client';

import { useEffect, useState } from 'react';
import { Shield, MessageSquare, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/shared/toast';

interface SmsMfaSettings {
  enabled: boolean;
  enforcedAt: string | null;
}

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SmsMfaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings/sms-mfa')
      .then(res => res.json())
      .then(data => {
        if (data?.enabled !== undefined) setSettings(data);
      })
      .catch(() => toast('Ayarlar yüklenemedi', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const applyToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/sms-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Ayar kaydedilemedi', 'error');
        return;
      }
      setSettings(data);
      toast(
        enabled
          ? 'SMS MFA etkinleştirildi — tüm personel bir sonraki girişinde SMS kodu isteyecek'
          : 'SMS MFA kapatıldı — personel artık SMS kodu olmadan giriş yapabilir',
        'success'
      );
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
      setConfirmToggle(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-primary-bg)' }}>
            <Shield className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Güvenlik Ayarları
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Hastanenizin giriş güvenliği politikalarını yönetin.
        </p>
      </div>

      <div className="rounded-2xl p-6 mb-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-primary-bg)' }}>
              <MessageSquare className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base mb-1">SMS ile İki Faktörlü Doğrulama</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Aktif olduğunda tüm personel şifreden sonra cep telefonuna gelen 6 haneli kodu girmek zorundadır.
                Güvenilir cihazlar 7 gün boyunca tekrar kod sormaz.
              </p>
              {settings.enabled && settings.enforcedAt && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: 'var(--color-success)' }}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {new Date(settings.enforcedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} tarihinden beri aktif
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            disabled={saving}
            onClick={() => setConfirmToggle(!settings.enabled)}
            className="relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors"
            style={{
              background: settings.enabled ? 'var(--color-primary)' : 'var(--color-border)',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: settings.enabled ? 'translateX(22px)' : 'translateX(3px)' }}
            />
          </button>
        </div>
      </div>

      {settings.enabled && (
        <div className="rounded-xl p-4 flex gap-3"
          style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)' }}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
          <div className="text-sm" style={{ color: 'var(--color-warning)' }}>
            <p className="font-semibold mb-1">Önemli</p>
            <p>
              Telefon numarası kayıtlı olmayan personel bir sonraki girişinde numarasını girmek zorunda kalacak.
              Personel listesini kontrol edip eksik numaraları önceden tamamlayın.
            </p>
          </div>
        </div>
      )}

      {confirmToggle !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => !saving && setConfirmToggle(null)}>
          <div className="w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">
              {confirmToggle ? 'SMS MFA\'yı aktifleştir?' : 'SMS MFA\'yı kapat?'}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
              {confirmToggle
                ? 'Tüm personel bir sonraki girişinde SMS kodu girmek zorunda kalacak. Devam etmek istiyor musunuz?'
                : 'Giriş güvenliği azalacak. SMS doğrulaması olmadan sadece şifre ile giriş yapılabilecek.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmToggle(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--color-bg)' }}
              >
                Vazgeç
              </button>
              <button
                onClick={() => applyToggle(confirmToggle)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                style={{ background: confirmToggle ? 'var(--color-primary)' : 'var(--color-error)' }}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmToggle ? 'Aktifleştir' : 'Kapat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
