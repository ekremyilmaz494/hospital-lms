"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Menu, X, Stethoscope, Factory } from "lucide-react";
import { BRAND } from "@/lib/brand";

const PRIMARY_NAV = [
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Sektörler", href: "#sektorler" },
  { label: "Süreç", href: "#surec" },
  { label: "SSS", href: "#sss" },
];

const SECTOR_LINKS = [
  {
    key: "health",
    label: "Sağlık",
    sub: "Hastane, klinik, eczane",
    icon: Stethoscope,
    accent: "var(--landing-sector-health)",
  },
  {
    key: "industry",
    label: "Üretim & Lojistik",
    sub: "Fabrika, depo, saha",
    icon: Factory,
    accent: "var(--landing-sector-industry)",
  },
] as const;

export function SiteNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sectorOpen, setSectorOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: scrolled
          ? "color-mix(in srgb, var(--landing-surface) 88%, transparent)"
          : "var(--landing-surface)",
        borderColor: scrolled ? "var(--landing-rule)" : "transparent",
        transition: "background-color 220ms var(--landing-ease), border-color 220ms var(--landing-ease)",
      }}
    >
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between"
        style={{
          height: scrolled ? 56 : 68,
          transition: "height 220ms var(--landing-ease)",
        }}
      >
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, var(--landing-brand) 0%, var(--landing-brand-deep) 100%)",
              boxShadow: "0 6px 20px rgba(13,150,104,0.28)",
            }}
          >
            {BRAND.name.charAt(0)}
          </div>
          <div className="leading-none">
            <p
              className="font-bold text-base"
              style={{ color: "var(--landing-ink)" }}
            >
              {BRAND.name}
            </p>
            <p
              className="text-[10px] font-bold tracking-[0.2em] uppercase mt-0.5"
              style={{ color: "var(--landing-brand)" }}
            >
              Kurumsal Eğitim
            </p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <div
            className="relative"
            onMouseEnter={() => setSectorOpen(true)}
            onMouseLeave={() => setSectorOpen(false)}
          >
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={sectorOpen}
              onClick={() => setSectorOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSectorOpen(false);
              }}
              className="text-sm font-semibold hover:opacity-70 flex items-center gap-1"
              style={{ color: "var(--landing-ink)" }}
            >
              Sektörler
              <ChevronRight
                className="w-3.5 h-3.5"
                style={{
                  transform: sectorOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 180ms var(--landing-ease)",
                }}
              />
            </button>
            <AnimatePresence>
              {sectorOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3"
                >
                  <div
                    className="w-[340px] max-w-[calc(100vw-32px)] rounded-2xl p-2 shadow-2xl"
                    style={{
                      backgroundColor: "var(--landing-bg)",
                      border: "1px solid var(--landing-rule)",
                      boxShadow: "var(--landing-shadow-card)",
                    }}
                  >
                    {SECTOR_LINKS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <a
                          key={s.key}
                          href={`#sektor-${s.key}`}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-black/[0.03]"
                          style={{ transition: "background-color 160ms var(--landing-ease)" }}
                        >
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: s.accent, color: "white" }}
                          >
                            <Icon className="w-5 h-5" strokeWidth={2.2} />
                          </div>
                          <div>
                            <p
                              className="text-sm font-bold"
                              style={{ color: "var(--landing-ink)" }}
                            >
                              {s.label}
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "var(--landing-ink-soft)" }}
                            >
                              {s.sub}
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {PRIMARY_NAV.filter((n) => n.label !== "Sektörler").map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm font-semibold hover:opacity-70"
              style={{
                color: "var(--landing-ink)",
                transition: "opacity 180ms var(--landing-ease)",
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            prefetch={false}
            href="/auth/login"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black uppercase tracking-wide hover:scale-105"
            style={{
              backgroundColor: "var(--landing-accent)",
              color: "var(--landing-ink)",
              transition: "transform 200ms var(--landing-ease-spring)",
              boxShadow: "0 6px 20px rgba(245,158,11,0.32)",
            }}
          >
            Giriş Yap
            <ChevronRight className="w-4 h-4" />
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 -mr-1 rounded-xl hover:bg-black/5 cursor-pointer"
            style={{
              color: "var(--landing-ink)",
              transition: "background-color 160ms var(--landing-ease)",
            }}
            aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mx-4 mb-3 rounded-2xl p-4"
            style={{
              backgroundColor: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--landing-rule)",
              boxShadow: "var(--landing-shadow-card)",
            }}
          >
            <div className="grid grid-cols-2 gap-2 mb-3">
              {SECTOR_LINKS.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.key}
                    href={`#sektor-${s.key}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 p-2.5 rounded-xl"
                    style={{
                      backgroundColor: "color-mix(in srgb, " + s.accent + " 8%, transparent)",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-white"
                      style={{ backgroundColor: s.accent }}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.2} />
                    </div>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "var(--landing-ink)" }}
                    >
                      {s.label}
                    </span>
                  </a>
                );
              })}
            </div>

            {PRIMARY_NAV.filter((n) => n.label !== "Sektörler").map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-semibold py-2.5 px-3 rounded-xl hover:bg-black/5"
                style={{
                  color: "var(--landing-ink)",
                  transition: "background-color 160ms var(--landing-ease)",
                }}
              >
                {label}
              </a>
            ))}

            <div
              className="border-t mt-2 pt-3"
              style={{ borderColor: "var(--landing-rule)" }}
            >
              <Link
                prefetch={false}
                href="/auth/login"
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-black text-center py-2.5 rounded-xl uppercase tracking-wide"
                style={{
                  backgroundColor: "var(--landing-accent)",
                  color: "var(--landing-ink)",
                }}
              >
                Giriş Yap
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
