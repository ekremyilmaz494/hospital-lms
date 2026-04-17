"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ArrowRight,
  Play,
  Star,
  Menu,
  X,
} from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";

const EASE = [0.22, 1, 0.36, 1] as const;

const HeroPlayer = dynamic(
  () => import("@/components/landing/hero-player").then((m) => m.HeroPlayer),
  { ssr: false, loading: () => <HeroVisualFallback /> },
);

function HeroVisualFallback() {
  return (
    <div
      className="relative w-full max-w-[520px] mx-auto aspect-[4/3] flex items-center justify-center"
      style={{
        borderRadius: 24,
        background: "linear-gradient(145deg, #1a3a28 0%, #0d2010 100%)",
      }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-4xl"
        style={{ background: "linear-gradient(135deg, var(--brand-600), #1a3a28)" }}
      >
        D
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { label: "Hakkında", href: "#hakkinda" },
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Güvenlik", href: "#guvenlik" },
  { label: "SSS", href: "#sss" },
] as const;

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const shouldReduce = useReducedMotion();
  const isMobile = useMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const disableParallax = shouldReduce || isMobile;

  const textY = useTransform(scrollYProgress, [0, 1], [0, disableParallax ? 0 : -60]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.65], [1, disableParallax ? 1 : 0.2]);
  const visualY = useTransform(scrollYProgress, [0, 1], [0, disableParallax ? 0 : 40]);

  const textVariants = {
    hidden: { opacity: 0, y: shouldReduce ? 0 : 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: i * 0.08, ease: EASE },
    }),
  };

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Close menu on ESC
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuOpen]);

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          backgroundColor: "rgba(245,240,230,0.85)",
          borderColor: "rgba(26,58,40,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white font-black text-base sm:text-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--brand-600), #1a3a28)" }}
            >
              D
            </div>
            <div className="leading-none min-w-0">
              <p className="font-bold text-sm sm:text-base truncate" style={{ color: "#1a3a28" }}>
                Devakent Hastanesi
              </p>
              <p
                className="hidden sm:block text-[10px] font-bold tracking-widest uppercase truncate"
                style={{ color: "var(--brand-600)" }}
              >
                Eğitim Platformu
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium transition-opacity hover:opacity-60"
                style={{ color: "#1a3a28" }}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black uppercase tracking-wide transition-transform hover:scale-105"
              style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
            >
              Giriş Yap <ChevronRight className="w-4 h-4" />
            </Link>

            {/* Mobile compact login */}
            <Link
              href="/auth/login"
              className="sm:hidden inline-flex items-center justify-center rounded-full text-xs font-black uppercase tracking-wide px-4 h-11"
              style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
            >
              Giriş
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Menüyü aç"
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full"
              style={{ color: "#1a3a28" }}
            >
              <Menu className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMenuOpen(false)}
              className="md:hidden fixed inset-0 z-[60] backdrop-blur-sm"
              style={{ backgroundColor: "rgba(13,32,16,0.45)" }}
              aria-hidden
            />

            {/* Drawer panel */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: EASE }}
              className="md:hidden fixed top-0 right-0 bottom-0 z-[70] w-[85%] max-w-sm flex flex-col"
              style={{
                backgroundColor: "#f5f0e6",
                boxShadow: "-20px 0 40px -10px rgba(0,0,0,0.25)",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Mobil menü"
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 h-14 border-b"
                style={{ borderColor: "rgba(26,58,40,0.08)" }}
              >
                <span
                  className="text-xs font-black tracking-[0.2em] uppercase"
                  style={{ color: "var(--brand-600)" }}
                >
                  Menü
                </span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Menüyü kapat"
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full"
                  style={{ color: "#1a3a28" }}
                >
                  <X className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 px-2 py-6 overflow-y-auto">
                <ul className="space-y-1">
                  {NAV_ITEMS.map(({ label, href }, i) => (
                    <motion.li
                      key={label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, delay: 0.1 + i * 0.05, ease: EASE }}
                    >
                      <a
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-4 rounded-2xl text-lg font-black transition-colors"
                        style={{ color: "#1a3a28" }}
                      >
                        {label}
                        <ChevronRight
                          className="w-5 h-5 opacity-40"
                          strokeWidth={2.5}
                        />
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              {/* Footer CTA */}
              <div
                className="p-5 border-t"
                style={{ borderColor: "rgba(26,58,40,0.08)" }}
              >
                <Link
                  href="/auth/login"
                  onClick={() => setMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full text-sm font-black uppercase tracking-wide"
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#1a3a28",
                    boxShadow: "0 8px 24px rgba(245,158,11,0.35)",
                  }}
                >
                  Eğitimlere Başla <ArrowRight className="w-4 h-4" />
                </Link>
                <p
                  className="text-[11px] text-center mt-3"
                  style={{ color: "#4a7060" }}
                >
                  500+ hastanenin güvendiği platform
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <section
        ref={heroRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 xl:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
      >
        <motion.div style={{ y: textY, opacity: textOpacity }} className="order-2 lg:order-1">
          <motion.span
            custom={0}
            initial="hidden"
            animate="visible"
            variants={textVariants}
            className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-bold tracking-[0.18em] sm:tracking-[0.2em] uppercase px-3 sm:px-4 py-1.5 rounded-full border mb-5 sm:mb-7"
            style={{ color: "var(--brand-600)", borderColor: "var(--brand-600)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "var(--brand-600)" }}
            />
            Personel Eğitim Platformu
          </motion.span>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={textVariants}
            className="text-[2.25rem] sm:text-[2.75rem] xl:text-[3.5rem] font-black leading-[1.0] mb-5 sm:mb-6 tracking-tight"
            style={{ color: "#1a3a28" }}
          >
            <span
              className="inline-block border-[3px] border-current px-2 mr-2 mb-1 align-middle"
              style={{ borderColor: "#1a3a28" }}
            >
              Eğitimi
            </span>
            Yönet,
            <br />
            Başarıyı{" "}
            <span style={{ color: "var(--brand-600)" }}>Ölç.</span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={textVariants}
            className="text-base sm:text-base leading-relaxed max-w-[400px] mb-8 sm:mb-10"
            style={{ color: "#4a7060" }}
          >
            Hastane personellerinize video tabanlı eğitimler atayın, sınav
            yapın ve performansı gerçek zamanlı takip edin.
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={textVariants}
            className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 mb-10 sm:mb-12"
          >
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-7 h-12 sm:h-auto sm:py-3.5 rounded-full text-sm font-black uppercase tracking-wide transition-transform hover:scale-105 shadow-lg"
              style={{
                backgroundColor: "#f59e0b",
                color: "#1a3a28",
                boxShadow: "0 8px 32px rgba(245,158,11,0.35)",
              }}
            >
              Eğitimlere Başla <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold transition-opacity hover:opacity-60 h-12 sm:h-auto"
              style={{ color: "#1a3a28" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                style={{ borderColor: "#1a3a28" }}
              >
                <Play className="w-3 h-3 ml-0.5" />
              </div>
              Demo İzle
            </Link>
          </motion.div>

          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={textVariants}
            className="flex items-center gap-4"
          >
            <div className="flex -space-x-2.5">
              {(
                [
                  { bg: "var(--brand-600)", letter: "A" },
                  { bg: "#1a3a28", letter: "M" },
                  { bg: "#b45309", letter: "F" },
                  { bg: "var(--brand-600)", letter: "K" },
                ] as const
              ).map(({ bg, letter }) => (
                <div
                  key={letter}
                  className="w-9 h-9 rounded-full border-[2.5px] flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: bg, borderColor: "#f5f0e6" }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                ))}
              </div>
              <p className="text-xs font-medium" style={{ color: "#4a7060" }}>
                500+ aktif kullanıcı tarafından güveniliyor
              </p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: visualY }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          className="order-1 lg:order-2 flex justify-center lg:justify-end"
        >
          <HeroPlayer />
        </motion.div>
      </section>
    </>
  );
}
