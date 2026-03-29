'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Copy, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { useToast } from '@/components/shared/toast';

type Step = 'qr' | 'verify' | 'done';

export default function MFASetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('qr');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFactorId(data.factorId);
      setQrCode(data.qrCode);
      setSecret(data.secret);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'MFA kurulamadi', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Kod hatali');
        setCode('');
        setLoading(false);
        return;
      }
      setStep('done');
    } catch {
      setError('Bir hata olustu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        <BlurFade delay={0.1}>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-4 text-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-lg font-bold text-white">Iki Faktorlu Dogrulama Kurulumu</h1>
              <p className="text-sm text-white/60 mt-1">Hesabinizi daha guvenli hale getirin</p>
            </div>

            <div className="p-8">
              {step === 'qr' && !qrCode && (
                <div className="text-center space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Google Authenticator, Microsoft Authenticator veya benzeri bir TOTP uygulamasi kullanarak hesabiniza ek bir guvenlik katmani ekleyin.
                    </p>
                  </div>
                  <ShimmerButton
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="w-full h-11 gap-2 text-sm font-semibold"
                    borderRadius="12px"
                    background="linear-gradient(135deg, #0d9668, #065f46)"
                  >
                    {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    {enrolling ? 'Hazirlaniyor...' : 'Kuruluma Basla'}
                  </ShimmerButton>
                  <Button variant="ghost" className="w-full gap-2 text-sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" /> Geri Don
                  </Button>
                </div>
              )}

              {step === 'qr' && qrCode && (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
                      1. QR kodu tarayin
                    </p>
                    {/* QR Code Image */}
                    <div className="mx-auto w-48 h-48 rounded-xl overflow-hidden border-2 mb-3" style={{ borderColor: 'var(--color-primary)' }}>
                      <img src={qrCode} alt="MFA QR Code" className="w-full h-full" />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>veya kodu manuel girin:</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <code className="text-xs font-mono px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                        {secret}
                      </code>
                      <button onClick={() => { navigator.clipboard.writeText(secret); toast('Kod kopyalandi', 'success'); }} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      2. Dogrulama kodunu girin
                    </p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-12 rounded-xl text-center text-2xl font-bold font-mono tracking-[0.5em]"
                      style={{ background: 'var(--color-bg)', borderColor: error ? 'var(--color-error)' : 'var(--color-border)' }}
                    />
                    {error && <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-error)' }}>{error}</p>}
                  </div>

                  <ShimmerButton
                    onClick={handleVerify}
                    disabled={loading || code.length !== 6}
                    className="w-full h-11 gap-2 text-sm font-semibold"
                    borderRadius="12px"
                    background="linear-gradient(135deg, #0d9668, #065f46)"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {loading ? 'Dogrulaniyor...' : 'Aktive Et'}
                  </ShimmerButton>
                </div>
              )}

              {step === 'done' && (
                <div className="text-center space-y-6 py-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--color-success-bg)' }}>
                    <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">2FA Aktif!</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Hesabiniz artik iki faktorlu dogrulama ile korunuyor.
                    </p>
                  </div>
                  <Button className="w-full h-11 gap-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--color-primary)' }} onClick={() => router.back()}>
                    Tamam
                  </Button>
                </div>
              )}
            </div>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
