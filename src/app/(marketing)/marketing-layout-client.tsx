"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Navigation config                                                   */
/* ------------------------------------------------------------------ */
const NAV_LINKS = [
  { label: "Anasayfa", href: "/" },
  { label: "Ozellikler", href: "/#ozellikler" },
  { label: "Nasil Calisir", href: "/#nasil-calisir" },
  { label: "Fiyatlandirma", href: "/pricing" },
  { label: "Iletisim", href: "/contact" },
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div
          className="rounded-2xl px-5 py-3 flex items-center justify-between transition-all duration-300"
          style={{
            backgroundColor: scrolled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.6)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: `1px solid ${scrolled ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.03)"}`,
            boxShadow: scrolled
              ? "0 4px 30px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
              : "none",
          }}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm"
              style={{ background: "linear-gradient(135deg, #0d9668, #065f46)" }}
            >
              H
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ color: "#0f172a" }}>
              Hastane<span style={{ color: "#0d9668" }}>LMS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={label}
                  href={href}
                  className="px-3.5 py-2 rounded-xl text-[13px] font-medium transition-colors hover:bg-black/[0.03]"
                  style={{
                    color: isActive ? "#0d9668" : "#475569",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              href="/auth/login"
              className="text-[13px] font-medium px-4 py-2 rounded-xl transition-colors hover:bg-black/[0.03]"
              style={{ color: "#475569" }}
            >
              Giris Yap
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #0d9668, #059669)",
                boxShadow: "0 2px 8px rgba(13,150,104,0.25)",
              }}
            >
              Ucretsiz Deneyin
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 -mr-1 rounded-xl transition-colors hover:bg-black/[0.03] cursor-pointer"
            style={{ color: "#0f172a" }}
            aria-label={mobileOpen ? "Menuyu kapat" : "Menuyu ac"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
                backgroundColor: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
              }}
            >
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium py-2.5 px-3 rounded-xl transition-colors hover:bg-black/[0.03]"
                  style={{ color: "#334155" }}
                >
                  {label}
                </Link>
              ))}
              <div className="border-t mt-2 pt-3 space-y-2" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium py-2.5 text-center rounded-xl border"
                  style={{ color: "#334155", borderColor: "rgba(0,0,0,0.08)" }}
                >
                  Giris Yap
                </Link>
                <Link
                  href="/demo"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-semibold py-2.5 text-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #0d9668, #059669)" }}
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
      title: "Platform",
      links: [
        { label: "Ozellikler", href: "/#ozellikler" },
        { label: "Fiyatlandirma", href: "/pricing" },
        { label: "Demo Talep Et", href: "/demo" },
        { label: "SSS", href: "/#sss" },
      ],
    },
    {
      title: "Hizmetler",
      links: [
        { label: "Egitim Yonetimi", href: "/#ozellikler" },
        { label: "Sinav Sistemi", href: "/#ozellikler" },
        { label: "Sertifika Yonetimi", href: "/#ozellikler" },
        { label: "AI Icerik Studyosu", href: "/#ozellikler" },
      ],
    },
    {
      title: "Yasal",
      links: [
        { label: "Kullanim Sartlari", href: "/terms" },
        { label: "Gizlilik Politikasi", href: "/privacy" },
        { label: "KVKK Aydinlatma", href: "/kvkk" },
        { label: "Veri Saklama Politikasi", href: "/data-retention" },
      ],
    },
    {
      title: "Iletisim",
      links: [
        { label: "destek@hastane-lms.com", href: "mailto:destek@hastane-lms.com" },
        { label: "+90 850 000 0000", href: "tel:+908500000000" },
        { label: "Ankara, Turkiye", href: "/contact" },
      ],
    },
  ];

  return (
    <footer style={{ backgroundColor: "#fafbfc" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Main footer */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {footerLinks.map(({ title, links }) => (
            <div key={title}>
              <h4 className="font-semibold text-sm mb-4" style={{ color: "#0f172a" }}>
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13px] transition-colors hover:text-[#0d9668]"
                      style={{ color: "#64748b" }}
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
          className="border-t py-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: "linear-gradient(135deg, #0d9668, #065f46)" }}
            >
              H
            </div>
            <p className="text-xs" style={{ color: "#94a3b8" }}>
              &copy; 2026 Hastane LMS. Tum haklari saklidir.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {["KVKK", "Gizlilik", "Sartlar"].map((label) => (
              <Link
                key={label}
                href={`/${label.toLowerCase()}`}
                className="text-xs transition-colors hover:text-[#0d9668]"
                style={{ color: "#94a3b8" }}
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
  const isHomePage = pathname === "/";

  if (isHomePage) {
    return (
      <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ backgroundColor: "#f5f0e6" }}>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#ffffff" }}>
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
