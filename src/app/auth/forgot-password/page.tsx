'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';

const BlurFade = dynamic(
  () => import('@/components/ui/blur-fade').then(m => ({ default: m.BlurFade })),
  { ssr: false, loading: () => <div /> }
);
const MeshGradient = dynamic(
  () => import('@paper-design/shaders-react').then(m => ({ default: m.MeshGradient })),
  { ssr: false }
);

// Clinical Editorial palette
const INK = '#0a1628';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const INK_SOFT = '#5b6478';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 sm:p-10" style={{ background: CREAM }}>
      <style>{`
        .ed-display { font-family: var(--font-plus-jakarta-sans), serif; }
        .ed-mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        .ed-input {
          width: 100%;
          height: 50px;
          padding: 0 16px;
          background: ${CREAM};
          border: 1.5px solid ${RULE};
          border-radius: 0;
          font-size: 15px;
          color: ${INK};
          transition: border-color 180ms ease, background-color 180ms ease;
          outline: none;
        }
        .ed-input:focus { border-color: ${INK}; background: #fff; }
        .ed-input::placeholder { color: ${INK_SOFT}; opacity: 0.6; }
      `}</style>

      {/* MeshGradient ambient backdrop */}
      <div className="absolute inset-0 z-0">
        <MeshGradient
          style={{ width: '100%', height: '100%' }}
          colors={['#faf7f2', '#f3dfa6', '#d4a437', '#c9a961', '#A9C4B3', '#e7c97a']}
          distortion={1.1}
          swirl={0.55}
          speed={0.35}
          offsetX={0.05}
          grainMixer={0}
          grainOverlay={0}
        />
        <div className="absolute inset-0" style={{ background: 'rgba(250, 247, 242, 0.12)' }} />
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: `radial-gradient(circle, ${RULE} 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Masthead — logo */}
        <BlurFade delay={0.05} duration={0.4}>
          <div className="mb-6 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center ed-display text-base font-semibold"
              style={{ background: INK, color: GOLD }}
            >
              H
            </div>
            <span className="ed-display text-lg font-semibold" style={{ color: INK }}>
              Devakent Hastanesi
            </span>
          </div>
        </BlurFade>

        {/* Card with gold left rail */}
        <div
          className="relative bg-white"
          style={{
            border: `1.5px solid ${RULE}`,
            borderLeft: `6px solid ${GOLD}`,
            padding: '36px 38px',
          }}
        >
          {sent ? (
            /* ── SUCCESS STATE ── */
            <>
              <BlurFade delay={0.08} duration={0.4}>
                <div className="ed-mono text-[10px] tracking-[0.32em]" style={{ color: GOLD }}>
                  № 04 · GÖNDERİLDİ
                </div>
              </BlurFade>

              <BlurFade delay={0.12} duration={0.4}>
                <h2
                  className="ed-display mt-3 leading-[1.05] tracking-tight"
                  style={{ color: INK, fontSize: '2rem', fontWeight: 600 }}
                >
                  E-posta <span style={{ fontStyle: 'italic', color: GOLD }}>yola çıktı.</span>
                </h2>
              </BlurFade>

              <BlurFade delay={0.16} duration={0.4}>
                <div className="my-6 h-px" style={{ background: RULE }} />
              </BlurFade>

              <BlurFade delay={0.18} duration={0.4}>
                <div
                  className="mb-6 flex items-start gap-4 px-4 py-4"
                  style={{ background: '#f1f7f3', borderLeft: `3px solid #1a3a28` }}
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#1a3a28' }} />
                  <div className="text-[13px] leading-relaxed" style={{ color: INK }}>
                    <strong style={{ color: INK }}>{email}</strong> adresine şifre sıfırlama bağlantısı
                    gönderildi. Lütfen gelen kutunuzu kontrol edin.
                  </div>
                </div>
              </BlurFade>

              <BlurFade delay={0.22} duration={0.4}>
                <p className="text-[12.5px] leading-relaxed mb-7" style={{ color: INK_SOFT }}>
                  E-posta birkaç dakika içinde ulaşmazsa <strong>spam/istenmeyen</strong> klasörünü kontrol
                  edin. Bağlantı 1 saat süreyle geçerlidir.
                </p>
              </BlurFade>

              <BlurFade delay={0.26} duration={0.4}>
                <Link href="/auth/login">
                  <button
                    type="button"
                    className="group relative w-full flex items-center justify-center gap-3 transition-colors duration-200"
                    style={{
                      height: 52,
                      background: INK,
                      color: '#f8f4ea',
                      border: `1.5px solid ${INK}`,
                      boxShadow: `0 0 0 1px ${GOLD}, 0 0 0 3px #fff, 0 0 0 4px ${GOLD}55`,
                    }}
                  >
                    <ArrowLeft
                      className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1"
                      style={{ color: GOLD }}
                    />
                    <span className="ed-mono text-[12px] tracking-[0.28em]">GİRİŞE DÖN</span>
                  </button>
                </Link>
              </BlurFade>
            </>
          ) : (
            /* ── FORM STATE ── */
            <>
              <BlurFade delay={0.08} duration={0.4}>
                <div className="ed-mono text-[10px] tracking-[0.32em]" style={{ color: GOLD }}>
                  № 03 · ŞİFRE SIFIRLAMA
                </div>
              </BlurFade>

              <BlurFade delay={0.12} duration={0.4}>
                <h2
                  className="ed-display mt-3 leading-[1.05] tracking-tight"
                  style={{ color: INK, fontSize: '2rem', fontWeight: 600 }}
                >
                  Şifrenizi mi <span style={{ fontStyle: 'italic', color: GOLD }}>unuttunuz?</span>
                </h2>
              </BlurFade>

              <BlurFade delay={0.16} duration={0.4}>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: INK_SOFT }}>
                  Kayıtlı e-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
                </p>
              </BlurFade>

              <BlurFade delay={0.18} duration={0.4}>
                <div className="my-6 h-px" style={{ background: RULE }} />
              </BlurFade>

              {error && (
                <BlurFade delay={0}>
                  <div
                    className="mb-5 flex items-start gap-3 px-4 py-3 text-[13px]"
                    style={{ background: '#fdf2ee', color: '#992f1d', borderLeft: '3px solid #b3261e' }}
                  >
                    <span className="ed-mono text-[11px] mt-0.5" style={{ color: '#b3261e' }}>!</span>
                    <span>{error}</span>
                  </div>
                </BlurFade>
              )}

              <BlurFade delay={0.22} duration={0.4}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="ed-mono text-[10px] tracking-[0.28em] mb-2 block" style={{ color: INK }}>
                      E-POSTA
                    </label>
                    <Input
                      type="email"
                      placeholder="ornek@hastane.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="ed-input"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full mt-2 flex items-center justify-center gap-3 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      height: 52,
                      background: INK,
                      color: '#f8f4ea',
                      border: `1.5px solid ${INK}`,
                      boxShadow: `0 0 0 1px ${GOLD}, 0 0 0 3px #fff, 0 0 0 4px ${GOLD}55`,
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
                        <span className="ed-mono text-[12px] tracking-[0.28em]">GÖNDERİLİYOR…</span>
                      </>
                    ) : (
                      <>
                        <span className="ed-mono text-[12px] tracking-[0.28em]">BAĞLANTI GÖNDER</span>
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                          style={{ color: GOLD }}
                        />
                      </>
                    )}
                  </button>
                </form>
              </BlurFade>

              <BlurFade delay={0.28} duration={0.4}>
                <div className="mt-6 text-center">
                  <Link
                    href="/auth/login"
                    className="ed-mono inline-flex items-center gap-2 text-[10px] tracking-[0.28em] transition-colors hover:underline"
                    style={{ color: INK }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    GİRİŞ SAYFASINA DÖN
                  </Link>
                </div>
              </BlurFade>
            </>
          )}
        </div>

        {/* Footer */}
        <BlurFade delay={0.32} duration={0.4}>
          <div className="mt-6 flex items-center justify-between ed-mono text-[10px] tracking-[0.25em]" style={{ color: INK_SOFT }}>
            <span>© 2026 · DEVAKENT HASTANESI</span>
            <span style={{ color: GOLD }}>HOSPITAL LMS</span>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
