'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { passwordSchema } from '@/lib/validations';
import { Eye, EyeOff, Lock, Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // PASSWORD_RECOVERY event'i ile session otomatik oluşur
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true);
      }
    });

    // Zaten session varsa direkt hazır
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    return () => {
      subscription.unsubscribe();
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Geçersiz şifre.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        if (updateError.message?.includes('same password')) {
          setError('Yeni şifre eski şifrenizle aynı olamaz.');
        } else if (updateError.message?.includes('session')) {
          setError('Oturumunuz sona ermiş. Lütfen şifre sıfırlama bağlantısını tekrar kullanın.');
        } else {
          setError(`Şifre güncellenemedi: ${updateError.message}`);
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      redirectTimerRef.current = setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
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
            <span className="text-xl font-bold font-heading">Hastane LMS</span>
          </div>
        </BlurFade>

        {success ? (
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
              <h2 className="text-xl font-bold mb-2">Şifre Güncellendi</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Şifreniz başarıyla değiştirildi. Giriş sayfasına yönlendiriliyorsunuz...
              </p>
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
                Yeni Şifre
              </p>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Şifrenizi Belirleyin</h2>
              <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
                Yeni şifreniz en az 8 karakter uzunluğunda olmalıdır.
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
                    Yeni Şifre
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="h-12 rounded-xl pr-11 text-[15px]"
                      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors duration-150"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Şifre Tekrarı
                  </Label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-12 rounded-xl text-[15px]"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    required
                    minLength={8}
                  />
                </div>

                <ShimmerButton
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 gap-2.5 text-[15px] font-semibold"
                  shimmerColor="rgba(255,255,255,0.15)"
                  shimmerSize="0.08em"
                  borderRadius="12px"
                  background="linear-gradient(135deg, #0d9668 0%, #065f46 100%)"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                  {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                  {!loading && <ChevronRight className="h-4 w-4 ml-1 opacity-60" />}
                </ShimmerButton>
              </form>
            </BlurFade>

            <BlurFade delay={0.4}>
              <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  &copy; 2026 Hastane LMS. Tüm hakları saklıdır.
                </p>
              </div>
            </BlurFade>
          </>
        )}
      </div>
    </div>
  );
}
