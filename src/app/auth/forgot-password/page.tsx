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

// Klinova palette (admin chrome tokens)
const INK = '#1c1917';        // --k-text-primary (warm dark)
const CREAM = '#fafaf9';      // --k-bg (warm gray)
const RULE = '#e7e5e4';       // --k-border (warm gray)
const GOLD = '#0d9668';       // --k-primary (emerald-600)
const INK_SOFT = '#78716c';   // --k-text-muted (warm gray)

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

      {/* Subtle ambient backdrop — soft emerald wash */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 20% 30%, rgba(13, 150, 104, 0.08) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(13, 150, 104, 0.06) 0%, transparent 50%)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Masthead — Klinova brand mark */}
        <BlurFade delay={0.05} duration={0.4}>
          <div className="mb-6 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                borderRadius: 11,
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-editorial), Georgia, serif",
                  fontStyle: 'italic', fontWeight: 700, fontSize: 22,
                  color: '#ffffff', lineHeight: 1, transform: 'translateY(1px)',
                }}
              >
                K
              </span>
            </div>
            <div className="flex flex-col">
              <span
                style={{
                  fontFamily: "var(--font-editorial), Georgia, serif",
                  fontStyle: 'italic', fontWeight: 500, fontSize: 22,
                  color: INK, lineHeight: 1, letterSpacing: '-0.01em',
                }}
              >
                Klinova
              </span>
              <span
                className="ed-mono"
                style={{
                  fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.28em',
                  color: GOLD, marginTop: 3, textTransform: 'uppercase',
                }}
              >
                Hospital Suite
              </span>
            </div>
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
                  style={{ background: '#ecfdf5', borderLeft: `3px solid ${GOLD}` }}
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: GOLD }} />
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
                      color: '#fafaf9',
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
                      color: '#fafaf9',
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
            <span>© 2026 · KLINOVA</span>
            <span style={{ color: GOLD }}>HOSPITAL SUITE</span>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
