'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
const BlurFade = dynamic(() => import('@/components/ui/blur-fade').then(m => ({ default: m.BlurFade })), { ssr: false, loading: () => <div /> });
const ShimmerButton = dynamic(() => import('@/components/ui/shimmer-button').then(m => ({ default: m.ShimmerButton })), { ssr: false, loading: () => <button className="w-full h-11 rounded-xl" style={{ background: 'var(--color-primary)' }} /> });

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lastAttempt = localStorage.getItem('fp_last');
    if (lastAttempt && Date.now() - parseInt(lastAttempt) < 60_000) {
      setError('Lütfen 1 dakika bekleyin.');
      return;
    }
    localStorage.setItem('fp_last', Date.now().toString());
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=/auth/reset-password`,
      });

      if (resetError) {
        console.error('[forgot-password]', resetError.message, resetError.status);
        if (resetError.message?.includes('rate') || resetError.status === 429) {
          setError('Çok fazla deneme yaptınız. Lütfen birkaç dakika bekleyin.');
        } else if (resetError.message?.includes('not found') || resetError.message?.includes('User not found')) {
          // Güvenlik: kullanıcı var/yok bilgisi sızdırma
          setSent(true);
        } else {
          setError(`Bağlantı gönderilemedi: ${resetError.message}`);
        }
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <BlurFade delay={0.1}>
          <div className="mb-10 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white font-heading"
              style={{ background: 'var(--color-primary)' }}
            >
              H
            </div>
            <span className="text-xl font-bold font-heading">Devakent Hastanesi</span>
          </div>
        </BlurFade>

        {sent ? (
          /* Başarı durumu */
          <BlurFade delay={0.1}>
            <div
              className="rounded-2xl border p-8 text-center"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'var(--color-success-bg)' }}
              >
                <CheckCircle className="h-7 w-7" style={{ color: 'var(--color-success)' }} />
              </div>
              <h2 className="text-xl font-bold mb-2">E-posta Gönderildi</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                <strong>{email}</strong> adresine şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin.
              </p>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-muted)' }}>
                E-posta birkaç dakika içinde ulaşmazsa spam/istenmeyen klasörünü kontrol edin.
              </p>
              <Link href="/auth/login">
                <ShimmerButton
                  className="w-full h-12 gap-2 text-[15px] font-semibold"
                  shimmerColor="rgba(255,255,255,0.15)"
                  shimmerSize="0.08em"
                  borderRadius="12px"
                  background="linear-gradient(135deg, var(--brand-600) 0%, var(--brand-800) 100%)"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Giriş Sayfasına Dön
                </ShimmerButton>
              </Link>
            </div>
          </BlurFade>
        ) : (
          /* Form */
          <>
            <BlurFade delay={0.1}>
              <p
                className="text-xs font-semibold uppercase tracking-[0.15em] mb-3"
                style={{ color: 'var(--color-primary)' }}
              >
                Şifre Sıfırlama
              </p>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Şifrenizi mi unuttunuz?</h2>
              <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
                Kayıtlı e-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
              </p>
            </BlurFade>

            {error && (
              <BlurFade delay={0}>
                <div
                  className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium"
                  style={{
                    background: 'var(--color-error-bg)',
                    color: 'var(--color-error)',
                    border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
                  }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--color-error)', color: 'white' }}
                  >
                    !
                  </div>
                  {error}
                </div>
              </BlurFade>
            )}

            <BlurFade delay={0.2}>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    E-posta Adresi
                  </Label>
                  <Input
                    type="email"
                    placeholder="ornek@hastane.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="h-12 rounded-xl text-[15px]"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    required
                  />
                </div>

                <ShimmerButton
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 gap-2.5 text-[15px] font-semibold"
                  shimmerColor="rgba(255,255,255,0.15)"
                  shimmerSize="0.08em"
                  borderRadius="12px"
                  background="linear-gradient(135deg, var(--brand-600) 0%, var(--brand-800) 100%)"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                  {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
                  {!loading && <ChevronRight className="h-4 w-4 ml-1 opacity-60" />}
                </ShimmerButton>
              </form>
            </BlurFade>

            <BlurFade delay={0.3}>
              <div className="mt-6 text-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors duration-150 hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Giriş sayfasına dön
                </Link>
              </div>
            </BlurFade>

            <BlurFade delay={0.4}>
              <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  &copy; 2026 Devakent Hastanesi. Tüm hakları saklıdır.
                </p>
              </div>
            </BlurFade>
          </>
        )}
      </div>
    </div>
  );
}
