'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login — redirect based on role
    if (email.includes('super')) {
      router.push('/super-admin/dashboard');
    } else if (email.includes('admin')) {
      router.push('/admin/dashboard');
    } else {
      router.push('/staff/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, #0f4a35 100%)',
      }}>
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontFamily: 'var(--font-display)' }}>H</div>
            <span className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Hastane LMS</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6" style={{ fontFamily: 'var(--font-display)' }}>
            Personel Eğitim ve<br />Sınav Yönetim Sistemi
          </h1>
          <p className="text-lg text-white/70 leading-relaxed max-w-md" style={{ fontFamily: 'var(--font-body)' }}>
            Çoklu hastane desteğiyle profesyonel eğitim yönetimi. Personellerinizi eğitin, sınav yapın, raporlayın.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {['DE', 'AN', 'MA', 'EG'].map((init, i) => (
              <div key={i} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 text-xs font-bold text-white" style={{ background: `rgba(255,255,255,${0.15 + i * 0.05})` }}>{init}</div>
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">24+ Hastane</p>
            <p className="text-xs text-white/60">platformumuzu kullanıyor</p>
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white" style={{ background: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>H</div>
            <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Hastane LMS</span>
          </div>

          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
            Hoş Geldiniz
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
            Hesabınıza giriş yapın
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta Adresi</Label>
              <Input
                type="email"
                placeholder="ornek@hastane.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-12"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontSize: '15px' }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label style={{ color: 'var(--color-text-secondary)' }}>Şifre</Label>
                <a href="#" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Şifremi Unuttum</a>
              </div>
              <div className="relative mt-1.5">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-10"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontSize: '15px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 gap-2 text-base font-semibold text-white"
              style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)' }}
            >
              <LogIn className="h-5 w-5" /> Giriş Yap
            </Button>
          </form>

          <Separator className="my-6" style={{ background: 'var(--color-border)' }} />

          {/* Demo accounts */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>DEMO HESAPLAR</p>
            <div className="space-y-2">
              {[
                { role: 'Süper Admin', email: 'super@demo.com', path: '/super-admin/dashboard', color: 'var(--color-primary)' },
                { role: 'Hastane Admin', email: 'admin@demo.com', path: '/admin/dashboard', color: 'var(--color-accent)' },
                { role: 'Personel', email: 'staff@demo.com', path: '/staff/dashboard', color: 'var(--color-info)' },
              ].map((demo) => (
                <button
                  key={demo.role}
                  onClick={() => router.push(demo.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2"
                  style={{ transition: 'background var(--transition-fast)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: demo.color }}>{demo.role[0]}</div>
                  <div className="text-left">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{demo.role}</p>
                    <p className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{demo.email}</p>
                  </div>
                  <Building2 className="ml-auto h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            © 2026 Hastane LMS. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </div>
  );
}
