'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, LogIn, Loader2, Shield, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import type { OrgBranding } from '@/hooks/use-org-branding';

// Klinova emerald palette
const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

const HERO_INK = '#062b1f';

interface MobileLayoutProps {
  branding: OrgBranding | null;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  kvkkAccepted: boolean;
  setKvkkAccepted: (v: boolean) => void;
  kvkkError: boolean;
  setKvkkError: (v: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (v: boolean) => void;
  loading: boolean;
  error: string;
  isTimeout: boolean;
  handleLogin: (e: React.FormEvent) => void;
}

/** Mobile login layout — lazy-loaded, hidden on lg+ screens. Klinova emerald. */
export default function MobileLayout({
  branding,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  kvkkAccepted,
  setKvkkAccepted,
  kvkkError,
  setKvkkError,
  rememberMe,
  setRememberMe,
  loading,
  error,
  isTimeout,
  handleLogin,
}: MobileLayoutProps) {
  return (
    <div
      className="lg:hidden min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: HERO_INK }}
    >
      {/* Full-screen ambient background */}
      <div className="absolute inset-0">
        <div
          className="absolute top-0 left-0 right-0 h-[55%]"
          style={{ background: `linear-gradient(180deg, ${HERO_INK} 0%, #0a3d2c 100%)` }}
        />
        <div
          className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${K.PRIMARY}26 0%, transparent 65%)` }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen px-6">

        {/* Header */}
        <div className="pt-12 pb-8">
          <div className="flex items-center gap-2.5">
            {branding?.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={branding.name}
                width={36}
                height={36}
                className="rounded-lg object-contain"
                style={{ background: 'rgba(255,255,255,0.1)' }}
                unoptimized
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-sm"
                style={{
                  background: `linear-gradient(135deg, ${K.PRIMARY}, ${K.PRIMARY_HOVER})`,
                  color: 'white',
                  fontFamily: K.FONT_DISPLAY,
                  fontWeight: 700,
                }}
              >
                H
              </div>
            )}
            <div>
              <span
                className="text-[15px] block leading-tight"
                style={{ color: '#ffffff', fontFamily: K.FONT_DISPLAY, fontWeight: 700 }}
              >
                {branding?.name || 'Devakent Hastanesi'}
              </span>
              <span
                className="text-[10px] font-medium tracking-widest uppercase"
                style={{ color: K.PRIMARY_LIGHT }}
              >
                Eğitim Platformu
              </span>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="mb-8">
          <h1
            className="text-[28px] leading-[1.15] tracking-tight"
            style={{ color: '#ffffff', fontFamily: K.FONT_DISPLAY, fontWeight: 700 }}
          >
            Hoş Geldiniz
          </h1>
          <p
            className="text-[14px] mt-2 leading-relaxed"
            style={{ color: 'rgba(209, 250, 229, 0.7)' }}
          >
            Hesabınıza giriş yaparak eğitimlerinize devam edin
          </p>
        </div>

        {/* Form area — grows to fill */}
        <div className="flex-1 flex flex-col">
          {isTimeout && !error && (
            <div
              className="mb-4 flex items-center gap-2.5 rounded-xl px-4 py-3"
              style={{ background: 'rgba(245, 158, 11, 0.10)', border: `1px solid ${K.WARNING}33` }}
            >
              <Clock className="h-4 w-4 shrink-0" style={{ color: K.WARNING }} />
              <span className="text-xs" style={{ color: '#fcd34d' }}>
                Oturumunuz zaman aşımına uğradı.
              </span>
            </div>
          )}

          {error && (
            <div
              className="mb-4 flex items-center gap-2.5 rounded-xl px-4 py-3"
              style={{ background: 'rgba(239, 68, 68, 0.10)', border: `1px solid ${K.ERROR}33` }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" style={{ color: K.ERROR }} />
              <span className="text-xs" style={{ color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label
                className="text-[12px] font-medium mb-2 block"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                E-posta Adresi
              </Label>
              <Input
                type="email"
                placeholder="ornek@hastane.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-13 rounded-2xl text-[15px] text-white placeholder:text-white/25"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                }}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label
                  className="text-[12px] font-medium"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  Şifre
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-[12px] font-medium"
                  style={{ color: K.PRIMARY_LIGHT }}
                >
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-13 rounded-2xl pr-12 text-[15px] text-white placeholder:text-white/25"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="kvkk-mobile"
                  checked={kvkkAccepted}
                  onCheckedChange={(checked) => {
                    setKvkkAccepted(checked === true);
                    if (checked) setKvkkError(false);
                  }}
                  className="mt-0.5 border-white/20"
                  style={
                    kvkkError
                      ? { borderColor: '#f87171' }
                      : {
                          backgroundColor: kvkkAccepted ? K.PRIMARY : undefined,
                          borderColor: kvkkAccepted ? K.PRIMARY : undefined,
                        }
                  }
                />
                <label
                  htmlFor="kvkk-mobile"
                  className="text-[12px] leading-relaxed cursor-pointer"
                  style={{ color: kvkkError ? '#fca5a5' : 'rgba(255,255,255,0.5)' }}
                >
                  <Link
                    href="/kvkk"
                    target="_blank"
                    className="font-semibold underline"
                    style={{ color: K.PRIMARY_LIGHT }}
                  >
                    KVKK Aydınlatma Metni
                  </Link>
                  &apos;ni okudum ve kabul ediyorum.
                </label>
              </div>
              {kvkkError && (
                <p className="text-[11px] font-medium pl-7" style={{ color: '#fca5a5' }}>
                  KVKK metnini onaylamanız zorunludur.
                </p>
              )}

              <div className="flex items-center gap-3">
                <Checkbox
                  id="rememberMe-mobile"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="border-white/20"
                  style={{
                    backgroundColor: rememberMe ? K.PRIMARY : undefined,
                    borderColor: rememberMe ? K.PRIMARY : undefined,
                  }}
                />
                <label
                  htmlFor="rememberMe-mobile"
                  className="text-[12px] font-medium cursor-pointer select-none"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Bu cihazda oturumumu açık tut (7 gün)
                </label>
              </div>
            </div>

            <ShimmerButton
              type="submit"
              disabled={loading}
              className="w-full h-13 gap-2.5 text-[15px] font-semibold"
              shimmerColor="rgba(255,255,255,0.18)"
              shimmerSize="0.08em"
              borderRadius="16px"
              background={
                branding?.brandColor
                  ? `linear-gradient(135deg, ${branding.brandColor} 0%, ${branding.brandColor}cc 100%)`
                  : `linear-gradient(135deg, ${K.PRIMARY} 0%, ${K.PRIMARY_HOVER} 100%)`
              }
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              {!loading && <ChevronRight className="h-4 w-4 ml-1 opacity-60" />}
            </ShimmerButton>
          </form>

          {/* Bottom trust + copyright */}
          <div className="mt-auto pt-8 pb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-3.5 w-3.5" style={{ color: K.PRIMARY_LIGHT }} />
              <span
                className="text-[11px] font-medium"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                KVKK Uyumlu &middot; 256-bit SSL &middot; Güvenli Bağlantı
              </span>
            </div>
            <p
              className="text-center text-[11px]"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              &copy; 2026 Devakent Hastanesi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
