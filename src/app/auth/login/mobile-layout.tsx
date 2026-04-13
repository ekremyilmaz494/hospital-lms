'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, LogIn, Loader2, Shield, ChevronRight, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import type { OrgBranding } from '@/hooks/use-org-branding';

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

/** Mobile login layout — lazy-loaded, hidden on lg+ screens */
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
      style={{ background: '#021a12' }}
    >
      {/* Full-screen ambient background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-[55%]" style={{ background: 'linear-gradient(180deg, #064e3b 0%, #032b1f 100%)' }} />
        <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,150,104,0.15) 0%, transparent 65%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen px-6">

        {/* Header */}
        <div className="pt-12 pb-8">
          <div className="flex items-center gap-2.5">
            {branding?.logoUrl ? (
              <Image src={branding.logoUrl} alt={branding.name} width={36} height={36} className="rounded-lg object-contain" style={{ background: 'rgba(255,255,255,0.1)' }} unoptimized />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #0d9668, #065f46)', color: 'white' }}>H</div>
            )}
            <div>
              <span className="text-[15px] font-bold text-white block leading-tight">{branding?.name || 'Devakent Hastanesi'}</span>
              <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#34d399' }}>Eğitim Platformu</span>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="mb-8">
          <h1 className="text-[28px] font-extrabold text-white leading-[1.15] tracking-tight">
            Hoş Geldiniz
          </h1>
          <p className="text-[14px] mt-2 leading-relaxed" style={{ color: 'rgba(167, 211, 191, 0.7)' }}>
            Hesabınıza giriş yaparak eğitimlerinize devam edin
          </p>
        </div>

        {/* Form area — grows to fill */}
        <div className="flex-1 flex flex-col">
          {isTimeout && !error && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <Clock className="h-4 w-4 shrink-0" style={{ color: '#fbbf24' }} />
              <span className="text-xs" style={{ color: '#fcd34d' }}>Oturumunuz zaman aşımına uğradı.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: '#ef4444', color: 'white' }}>!</div>
              <span className="text-xs" style={{ color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label className="text-[12px] font-medium mb-2 block" style={{ color: 'rgba(255,255,255,0.5)' }}>E-posta Adresi</Label>
              <Input
                type="email"
                placeholder="ornek@hastane.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-13 rounded-2xl text-[15px] text-white placeholder:text-white/20"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Şifre</Label>
                <Link href="/auth/forgot-password" className="text-[12px] font-medium" style={{ color: '#34d399' }}>Şifremi Unuttum</Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-13 rounded-2xl pr-12 text-[15px] text-white placeholder:text-white/20"
                  style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
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
                  className="mt-0.5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  style={kvkkError ? { borderColor: '#f87171' } : undefined}
                />
                <label htmlFor="kvkk-mobile" className="text-[12px] leading-relaxed cursor-pointer" style={{ color: kvkkError ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}>
                  <Link href="/kvkk" target="_blank" className="font-semibold underline" style={{ color: '#34d399' }}>KVKK Aydınlatma Metni</Link>&apos;ni okudum ve kabul ediyorum.
                </label>
              </div>
              {kvkkError && <p className="text-[11px] font-medium pl-7" style={{ color: '#fca5a5' }}>KVKK metnini onaylamanız zorunludur.</p>}

              <div className="flex items-center gap-3">
                <Checkbox
                  id="rememberMe-mobile"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <label htmlFor="rememberMe-mobile" className="text-[12px] font-medium cursor-pointer select-none" style={{ color: 'rgba(255,255,255,0.4)' }}>Bu cihazda oturumumu açık tut (7 gün)</label>
              </div>
            </div>

            <ShimmerButton
              type="submit"
              disabled={loading}
              className="w-full h-13 gap-2.5 text-[15px] font-semibold"
              shimmerColor="rgba(255,255,255,0.15)"
              shimmerSize="0.08em"
              borderRadius="16px"
              background={branding?.brandColor ? `linear-gradient(135deg, ${branding.brandColor} 0%, ${branding.brandColor}cc 100%)` : 'linear-gradient(135deg, #0d9668 0%, #065f46 100%)'}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              {!loading && <ChevronRight className="h-4 w-4 ml-1 opacity-60" />}
            </ShimmerButton>
          </form>

          {/* Bottom trust + copyright */}
          <div className="mt-auto pt-8 pb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-3.5 w-3.5" style={{ color: '#0d9668' }} />
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>KVKK Uyumlu &middot; 256-bit SSL &middot; Güvenli Bağlantı</span>
            </div>
            <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>&copy; 2026 Devakent Hastanesi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
