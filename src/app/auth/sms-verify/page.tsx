'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Loader2, RotateCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';

const RESEND_COOLDOWN_SECONDS = 60;

function SmsVerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [rememberDevice, setRememberDevice] = useState(true); // default açık — UX iyi
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sayfa açılır açılmaz ilk SMS'i otomatik gönder
  useEffect(() => {
    sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown sayacı
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const sendOtp = async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/sms/send', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && data.error?.includes('telefon numarası tanımlı değil')) {
          router.replace('/auth/phone-setup');
          return;
        }
        setError(data.error || 'SMS gönderilemedi');
        return;
      }
      setPhoneMasked(data.phoneMasked || null);
      setInfo('Doğrulama kodu telefonunuza gönderildi.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      inputRefs.current[0]?.focus();
    } catch {
      setError('SMS gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSending(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newCode.every(c => c) && newCode.join('').length === 6) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (codeStr?: string) => {
    const finalCode = codeStr || code.join('');
    if (finalCode.length !== 6) return;

    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: finalCode, rememberDevice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Doğrulama başarısız');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }
      // Full reload: onAuthStateChange ile race condition'dan kaçın (CLAUDE.md kuralı)
      window.location.href = data.redirectTo || '/staff/dashboard';
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <BlurFade delay={0.1}>
          <div className="text-center mb-8">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))', boxShadow: '0 4px 20px color-mix(in srgb, var(--brand-600) calc(0.3 * 100%), transparent)' }}
            >
              <MessageSquare className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">SMS Doğrulama</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {phoneMasked
                ? <>Kod <span className="font-mono font-semibold">{phoneMasked}</span> numaralı telefonunuza gönderildi</>
                : 'Telefonunuza 6 haneli kod gönderiliyor...'}
            </p>
          </div>
        </BlurFade>

        {error && (
          <BlurFade delay={0}>
            <div className="mb-5 rounded-xl px-4 py-3 text-sm font-medium text-center"
              style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
              {error}
            </div>
          </BlurFade>
        )}

        {info && !error && (
          <BlurFade delay={0}>
            <div className="mb-5 rounded-xl px-4 py-3 text-sm font-medium text-center"
              style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              {info}
            </div>
          </BlurFade>
        )}

        <BlurFade delay={0.2}>
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <Input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-14 w-12 rounded-xl text-center text-2xl font-bold font-mono"
                style={{ background: 'var(--color-surface)', borderColor: digit ? 'var(--color-primary)' : 'var(--color-border)' }}
                disabled={loading || sending}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 mb-6 justify-center">
            <Checkbox
              id="remember-device"
              checked={rememberDevice}
              onCheckedChange={(v) => setRememberDevice(v === true)}
            />
            <Label htmlFor="remember-device" className="text-sm cursor-pointer select-none">
              Bu cihazı 7 gün hatırla
            </Label>
          </div>

          <ShimmerButton
            onClick={() => handleSubmit()}
            disabled={loading || code.join('').length !== 6}
            className="w-full h-12 gap-2.5 text-[15px] font-semibold mb-3"
            shimmerColor="rgba(255,255,255,0.15)"
            borderRadius="12px"
            background="linear-gradient(135deg, var(--brand-600) 0%, var(--brand-800) 100%)"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </ShimmerButton>

          <button
            type="button"
            onClick={sendOtp}
            disabled={sending || resendCooldown > 0}
            className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-lg"
            style={{
              color: resendCooldown > 0 ? 'var(--color-text-muted)' : 'var(--color-primary)',
              cursor: resendCooldown > 0 || sending ? 'not-allowed' : 'pointer',
            }}
          >
            <RotateCw className={`h-4 w-4 ${sending ? 'animate-spin' : ''}`} />
            {sending
              ? 'Gönderiliyor...'
              : resendCooldown > 0
                ? `Yeniden gönder (${resendCooldown}s)`
                : 'Kodu yeniden gönder'}
          </button>
        </BlurFade>
      </div>
    </div>
  );
}

export default function SmsVerifyPage() {
  return (
    <Suspense>
      <SmsVerifyForm />
    </Suspense>
  );
}
