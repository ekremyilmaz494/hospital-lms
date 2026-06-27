'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', BORDER: '#c9c4be',
  TEXT_PRIMARY: '#1c1917', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5', ERROR: '#ef4444',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface TotpFactor {
  id: string;
  friendlyName: string | null;
  status: string;
  createdAt: string;
}

/**
 * Authenticator (TOTP) bölümü — giriş yapan yöneticinin KENDİ hesabı için.
 * Kurulum mevcut `/auth/mfa-setup` akışına yönlendirilir; kaldırma burada yapılır.
 */
export function TotpSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState<TotpFactor | null>(null);

  useEffect(() => {
    fetch('/api/auth/mfa')
      .then((r) => r.json())
      .then((d) => setFactor((d.totp ?? [])[0] ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDisable = async () => {
    if (!factor) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/unenroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: factor.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || 'Authenticator kaldırılamadı', 'error');
        return;
      }
      toast('Authenticator doğrulaması kaldırıldı', 'success');
      setFactor(null);
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setBusy(false);
    }
  };

  const enabled = !!factor;

  return (
    <div className="p-6 mb-4"
      style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: K.PRIMARY_LIGHT }}>
            <KeyRound className="h-6 w-6" style={{ color: K.PRIMARY }} />
          </div>
          <div className="flex-1">
            <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY, marginBottom: 4 }}>
              Authenticator Uygulaması (TOTP)
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: K.TEXT_MUTED }}>
              Google Authenticator, Microsoft Authenticator veya benzeri bir uygulamayla
              kendi hesabınız için zaman bazlı 6 haneli kod doğrulaması ekleyin. SMS&apos;e alternatiftir.
            </p>
            {enabled && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: K.SUCCESS_BG, color: K.SUCCESS }}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Etkin{factor?.createdAt ? ` — ${new Date(factor.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: K.PRIMARY }} />
          ) : enabled ? (
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              style={{ background: K.SURFACE, border: `1px solid ${K.ERROR}`, color: K.ERROR, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Kaldır
            </button>
          ) : (
            <Link
              href="/auth/mfa-setup"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2"
              style={{ background: K.PRIMARY }}
            >
              <ShieldCheck className="h-4 w-4" />
              Kur
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
