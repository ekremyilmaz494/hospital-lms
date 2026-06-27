'use client';

import { useEffect, useState } from 'react';
import { Loader2, MonitorSmartphone, LogOut } from 'lucide-react';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5', ERROR: '#ef4444',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface Device {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/** User-Agent'tan kısa, okunur cihaz adı türetir (tarayıcı + işletim sistemi). */
function deviceLabel(ua: string | null): string {
  if (!ua) return 'Bilinmeyen cihaz';
  const os =
    /Windows/i.test(ua) ? 'Windows' :
    /iPhone|iPad|iOS/i.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/i.test(ua) ? 'macOS' :
    /Android/i.test(ua) ? 'Android' :
    /Linux/i.test(ua) ? 'Linux' : 'Bilinmeyen sistem';
  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\/|Opera/i.test(ua) ? 'Opera' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' : 'Tarayıcı';
  return `${browser} · ${os}`;
}

/**
 * Cihazlarım — yöneticinin kendi güvenilir (SMS/MFA atlayan) cihazlarını listeler
 * ve tek tek "çıkış yaptır"masına izin verir.
 */
export function DevicesSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/devices')
      .then((r) => r.json())
      .then((d) => setDevices(d.devices ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      const res = await fetch(`/api/auth/devices/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || 'Cihaz çıkışı yapılamadı', 'error');
        return;
      }
      toast('Cihaz iptal edildi — sonraki girişte tekrar doğrulama istenecek', 'success');
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="p-6 mb-4"
      style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
      <div className="flex items-start gap-4 mb-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: K.PRIMARY_LIGHT }}>
          <MonitorSmartphone className="h-6 w-6" style={{ color: K.PRIMARY }} />
        </div>
        <div className="flex-1">
          <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY, marginBottom: 4 }}>
            Güvenilir Cihazlarım
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: K.TEXT_MUTED }}>
            SMS/MFA doğrulamasını 7 gün atlayan cihazlar. Tanımadığınız bir cihaz görürseniz
            hemen çıkış yaptırın.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: K.PRIMARY }} />
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl px-4 py-4 text-sm text-center" style={{ background: K.BG, color: K.TEXT_MUTED }}>
          Kayıtlı güvenilir cihaz yok. SMS/MFA ile giriş yaptığınızda bu cihaz burada görünecek.
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id}
              className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
              style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>{deviceLabel(d.userAgent)}</span>
                  {d.isCurrent && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: K.SUCCESS_BG, color: K.SUCCESS }}>Bu cihaz</span>
                  )}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: K.TEXT_MUTED }}>
                  {d.ipAddress ? `IP ${d.ipAddress} · ` : ''}
                  Son kullanım: {new Date(d.lastUsedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(d.id)}
                disabled={revoking === d.id}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 flex-shrink-0"
                style={{ background: K.SURFACE, border: `1px solid ${K.ERROR}`, color: K.ERROR, cursor: revoking === d.id ? 'not-allowed' : 'pointer' }}
              >
                {revoking === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                Çıkış yaptır
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
