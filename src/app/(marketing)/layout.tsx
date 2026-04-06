"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight } from "lucide-react";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Ozellikler", href: "/#ozellikler" },
  { label: "Fiyatlandirma", href: "/pricing" },
  { label: "Iletisim", href: "/contact" },
];

function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: "rgba(241,245,249,0.85)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg"
            style={{ background: "linear-gradient(135deg, #0d9668, #065f46)" }}
          >
            H
          </div>
          <div className="leading-none">
            <p className="font-bold text-base" style={{ color: "var(--color-text-primary)" }}>
              Hastane LMS
            </p>
            <p
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "#0d9668" }}
            >
              Egitim Platformu
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={label}
                href={href}
                className="text-sm font-medium transition-colors"
                style={{
                  color: isActive ? "#0d9668" : "var(--color-text-secondary)",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ color: "var(--color-text-primary)" }}
          >
            Giris Yap
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105"
            style={{
              backgroundColor: "#0d9668",
              boxShadow: "0 4px 14px rgba(13,150,104,0.3)",
            }}
          >
            Ucretsiz Deneyin <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg"
          style={{ color: "var(--color-text-primary)" }}
          aria-label={mobileOpen ? "Menuyu kapat" : "Menuyu ac"}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t px-6 py-4 space-y-3"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium py-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/auth/login"
              className="text-sm font-semibold py-2.5 text-center rounded-xl border"
              style={{
                color: "var(--color-text-primary)",
                borderColor: "var(--color-border)",
              }}
            >
              Giris Yap
            </Link>
            <Link
              href="/register"
              className="text-sm font-bold py-2.5 text-center rounded-xl text-white"
              style={{ backgroundColor: "#0d9668" }}
            >
              Ucretsiz Deneyin
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer style={{ backgroundColor: "#0f172a" }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg"
                style={{ background: "linear-gradient(135deg, #0d9668, #065f46)" }}
              >
                H
              </div>
              <div className="leading-none">
                <p className="font-bold text-base text-white">Hastane LMS</p>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#0d9668" }}>
                  Egitim Platformu
                </p>
              </div>
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
              Hastane personeli icin tasarlanmis, kapsamli egitim ve sinav yonetim platformu.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">Platform</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Ozellikler", href: "/#ozellikler" },
                { label: "Fiyatlandirma", href: "/pricing" },
                { label: "Demo Talep Et", href: "/demo" },
                { label: "SSS", href: "/#sss" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm transition-colors hover:text-white" style={{ color: "#94a3b8" }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Yasal */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">Yasal</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Kullanim Sartlari", href: "/terms" },
                { label: "Gizlilik Politikasi", href: "/privacy" },
                { label: "KVKK Aydinlatma Metni", href: "/kvkk" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm transition-colors hover:text-white" style={{ color: "#94a3b8" }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Iletisim */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">Iletisim</h4>
            <ul className="space-y-2.5">
              <li className="text-sm" style={{ color: "#94a3b8" }}>destek@hastane-lms.com</li>
              <li className="text-sm" style={{ color: "#94a3b8" }}>+90 850 000 0000</li>
              <li className="text-sm" style={{ color: "#94a3b8" }}>Ankara, Turkiye</li>
            </ul>
          </div>
        </div>

        <div
          className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "#64748b" }}>
            &copy; 2026 Hastane LMS. Tum haklari saklidir.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/kvkk" className="text-xs transition-colors hover:text-white" style={{ color: "#64748b" }}>
              KVKK
            </Link>
            <Link href="/privacy" className="text-xs transition-colors hover:text-white" style={{ color: "#64748b" }}>
              Gizlilik
            </Link>
            <Link href="/terms" className="text-xs transition-colors hover:text-white" style={{ color: "#64748b" }}>
              Sartlar
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg)" }}>
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
