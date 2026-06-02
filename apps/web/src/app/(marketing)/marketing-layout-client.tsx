'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND } from '@/lib/brand';

/* ------------------------------------------------------------------ */
/*  Navigation config                                                   */
/* ------------------------------------------------------------------ */
const NAV_LINKS = [
  { label: 'Anasayfa', href: '/' },
  { label: 'Iletisim', href: '/contact' },
];

/* ------------------------------------------------------------------ */
/*  HEADER                                                              */
/* ------------------------------------------------------------------ */
function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 right-0 left-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <div
          className="flex items-center justify-between rounded-2xl px-5 py-3 transition-all duration-300"
          style={{
            backgroundColor: scrolled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: `1px solid ${scrolled ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)'}`,
            boxShadow: scrolled
              ? '0 4px 30px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)'
              : 'none',
          }}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black text-white"
              style={{ background: 'linear-gradient(135deg, #0d9668, #065f46)' }}
            >
              {BRAND.name.charAt(0)}
            </div>
            <span className="text-[15px] font-bold tracking-tight" style={{ color: '#0f172a' }}>
              {BRAND.name}
              <span style={{ color: '#0d9668' }}> LMS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={label}
                  href={href}
                  className="rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-black/[0.03]"
                  style={{
                    color: isActive ? '#0d9668' : '#475569',
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <Link
              prefetch={false}
              href="/auth/login"
              className="rounded-xl px-4 py-2 text-[13px] font-medium transition-colors hover:bg-black/[0.03]"
              style={{ color: '#475569' }}
            >
              Giris Yap
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #0d9668, #059669)',
                boxShadow: '0 2px 8px rgba(13,150,104,0.25)',
              }}
            >
              Ucretsiz Deneyin
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="-mr-1 cursor-pointer rounded-xl p-2 transition-colors hover:bg-black/[0.03] lg:hidden"
            style={{ color: '#0f172a' }}
            aria-label={mobileOpen ? 'Menuyu kapat' : 'Menuyu ac'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="mt-2 rounded-2xl p-4 lg:hidden"
              style={{
                backgroundColor: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
              }}
            >
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03]"
                  style={{ color: '#334155' }}
                >
                  {label}
                </Link>
              ))}
              <div
                className="mt-2 space-y-2 border-t pt-3"
                style={{ borderColor: 'rgba(0,0,0,0.05)' }}
              >
                <Link
                  prefetch={false}
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl border py-2.5 text-center text-sm font-medium"
                  style={{ color: '#334155', borderColor: 'rgba(0,0,0,0.08)' }}
                >
                  Giris Yap
                </Link>
                <Link
                  href="/demo"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl py-2.5 text-center text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #0d9668, #059669)' }}
                >
                  Ucretsiz Deneyin
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */
/*  FOOTER                                                              */
/* ------------------------------------------------------------------ */
function MarketingFooter() {
  const footerLinks = [
    {
      title: 'Platform',
      links: [
        { label: 'Demo Talep Et', href: '/demo' },
        { label: 'SSS', href: '/#sss' },
        { label: 'Iletisim', href: '/contact' },
      ],
    },
    {
      title: 'Hizmetler',
      links: [
        { label: 'Egitim Yonetimi', href: '/#egitim' },
        { label: 'Sinav Sistemi', href: '/#egitim' },
        { label: 'Sertifika Yonetimi', href: '/#kanit' },
        { label: 'Mobil Erisim', href: '/#erisim' },
      ],
    },
    {
      title: 'Yasal',
      links: [
        { label: 'Kullanim Sartlari', href: '/terms' },
        { label: 'Gizlilik Politikasi', href: '/privacy' },
        { label: 'KVKK Aydinlatma', href: '/kvkk' },
        { label: 'Veri Saklama Politikasi', href: '/data-retention' },
      ],
    },
    {
      title: 'Iletisim',
      links: [
        { label: BRAND.supportEmail, href: `mailto:${BRAND.supportEmail}` },
        { label: BRAND.contact.phone, href: `tel:${BRAND.contact.phone.replace(/\s+/g, '')}` },
        { label: BRAND.contact.city, href: '/contact' },
      ],
    },
  ];

  return (
    <footer style={{ backgroundColor: '#fafbfc' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Main footer */}
        <div className="grid grid-cols-2 gap-8 py-16 md:grid-cols-4 lg:gap-12">
          {footerLinks.map(({ title, links }) => (
            <div key={title}>
              <h4 className="mb-4 text-sm font-semibold" style={{ color: '#0f172a' }}>
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13px] transition-colors hover:text-[#0d9668]"
                      style={{ color: '#64748b' }}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col items-center justify-between gap-4 border-t py-6 sm:flex-row"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white"
              style={{ background: 'linear-gradient(135deg, #0d9668, #065f46)' }}
            >
              H
            </div>
            <p className="text-xs" style={{ color: '#94a3b8' }}>
              &copy; {BRAND.legal.copyrightYear} {BRAND.fullName}. Tum haklari saklidir.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {['KVKK', 'Gizlilik', 'Sartlar'].map((label) => (
              <Link
                key={label}
                href={`/${label.toLowerCase()}`}
                className="text-xs transition-colors hover:text-[#0d9668]"
                style={{ color: '#94a3b8' }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  CLIENT LAYOUT SHELL                                                 */
/* ------------------------------------------------------------------ */
export function MarketingLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  // /contact kendi landing-3d header+footer'ını sağlar → marketing chrome'u atla.
  if (pathname === '/contact') {
    return <>{children}</>;
  }

  if (isHomePage) {
    return (
      <div
        className="flex min-h-screen flex-col overflow-x-hidden"
        style={{ backgroundColor: '#f5f0e6' }}
      >
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#ffffff' }}>
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
