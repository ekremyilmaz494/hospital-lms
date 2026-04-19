'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Loader2, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';

export default function PhoneSetupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('Telefon numarası gereklidir');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/phone-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Telefon kaydedilemedi');
        setLoading(false);
        return;
      }
      // Telefon kaydedildi → SMS verify akışına geç
      router.replace('/auth/sms-verify');
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
              <Phone className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Telefon Numaranızı Girin</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Hastaneniz SMS ile giriş doğrulaması kullanıyor. Devam etmek için cep telefonu numaranızı kaydedin.
            </p>
          </div>
        </BlurFade>

        <BlurFade delay={0.2}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm font-medium text-center"
                style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="phone" className="text-sm font-medium mb-2 block">
                Cep telefonu
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="5XX XXX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 rounded-xl"
                disabled={loading}
                autoFocus
              />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Sadece Türkiye cep telefonu numaraları kabul edilir (5 ile başlayan 10 hane).
              </p>
            </div>

            <ShimmerButton
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full h-12 gap-2.5 text-[15px] font-semibold"
              shimmerColor="rgba(255,255,255,0.15)"
              borderRadius="12px"
              background="linear-gradient(135deg, var(--brand-600) 0%, var(--brand-800) 100%)"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              {loading ? 'Kaydediliyor...' : 'Devam Et'}
            </ShimmerButton>
          </form>
        </BlurFade>
      </div>
    </div>
  );
}
