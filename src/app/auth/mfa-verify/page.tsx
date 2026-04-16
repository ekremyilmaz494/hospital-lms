'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';

const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  admin: '/admin/dashboard',
  staff: '/staff/dashboard',
};

function MFAVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const factorId = searchParams.get('factorId') || '';
  const role = searchParams.get('role') || 'staff';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
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
      const newCode = pasted.split('');
      setCode(newCode);
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (codeStr?: string) => {
    const finalCode = codeStr || code.join('');
    if (finalCode.length !== 6) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code: finalCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Doğrulama kodu hatalı');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      router.push(ROLE_ROUTES[role] || '/staff/dashboard');
      router.refresh();
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
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">İki Faktörlü Doğrulama</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Authenticator uygulamanızdan 6 haneli kodu girin
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

        <BlurFade delay={0.2}>
          <div className="flex justify-center gap-2 mb-8" onPaste={handlePaste}>
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
                disabled={loading}
              />
            ))}
          </div>

          <ShimmerButton
            onClick={() => handleSubmit()}
            disabled={loading || code.join('').length !== 6}
            className="w-full h-12 gap-2.5 text-[15px] font-semibold"
            shimmerColor="rgba(255,255,255,0.15)"
            borderRadius="12px"
            background="linear-gradient(135deg, var(--brand-600) 0%, var(--brand-800) 100%)"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </ShimmerButton>
        </BlurFade>
      </div>
    </div>
  );
}

export default function MFAVerifyPage() {
  return (
    <Suspense>
      <MFAVerifyForm />
    </Suspense>
  );
}
