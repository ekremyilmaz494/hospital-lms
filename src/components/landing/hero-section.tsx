"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ArrowRight,
  Play,
  Star,
  TrendingUp,
  Users,
  Award,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function HeroVisual() {
  return (
    <div className="relative flex items-center justify-center select-none w-full max-w-[420px] mx-auto">
      {/* Soft glow rings */}
      <div
        className="absolute w-[115%] aspect-square rounded-full border opacity-[0.07]"
        style={{ borderColor: "var(--brand-600)" }}
      />
      <div
        className="absolute w-[90%] aspect-square rounded-full border opacity-[0.12]"
        style={{ borderColor: "var(--brand-600)" }}
      />

      {/* Organic blob */}
      <div
        className="relative w-full aspect-square flex-shrink-0"
        style={{
          borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
          background: "linear-gradient(145deg, #1a3a28 0%, #0d2010 100%)",
          overflow: "hidden",
        }}
      >
        {/* Inner decorative glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: "var(--brand-600)" }}
        />
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-10"
          style={{ backgroundColor: "#4ade80" }}
        />

        {/* Dashboard card content */}
        <div className="absolute inset-0 flex flex-col justify-center px-7 py-7 gap-3">
          {/* Active training card */}
          <div
            className="rounded-2xl p-4 border"
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
                Aktif Eğitim
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }}
              >
                ● Devam Ediyor
              </span>
            </div>
            <p className="text-white font-bold text-sm mb-3">Acil Müdahale & CPR Eğitimi</p>
            <div
              className="w-full h-1.5 rounded-full mb-1.5"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-1.5 rounded-full"
                style={{ width: "68%", backgroundColor: "var(--brand-600)" }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                68% tamamlandı
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                4 / 6 ders
              </span>
            </div>
          </div>

          {/* Mini stat cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Başarı Oranı", value: "%94", icon: TrendingUp, color: "#4ade80" },
              { label: "Katılımcı", value: "218", icon: Users, color: "#f59e0b" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-xl p-3"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                <Icon className="w-3.5 h-3.5 mb-1.5" style={{ color }} />
                <p className="text-xl font-black text-white leading-none">{value}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Achievement notification */}
          <div
            className="rounded-xl p-3 flex items-center gap-2.5 border"
            style={{
              backgroundColor: "rgba(245,158,11,0.1)",
              borderColor: "rgba(245,158,11,0.2)",
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(245,158,11,0.2)" }}
            >
              <Award className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white leading-tight">Sertifika Kazanıldı!</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                Hijyen Eğitimi — Ayşe K.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div
        className="absolute top-0 right-4 sm:right-10 w-14 h-14 sm:w-18 sm:h-18 rounded-full flex flex-col items-center justify-center text-center z-10 pointer-events-none"
        style={{
          backgroundColor: "#f59e0b",
          color: "#1a3a28",
          boxShadow: "0 4px 20px rgba(245,158,11,0.45)",
        }}
      >
        <span className="text-base sm:text-xl font-black leading-none">7/24</span>
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide mt-0.5">
          Erişim
        </span>
      </div>

      {/* Floating testimonial bubble */}
      <div
        className="absolute -left-2 top-12 bg-white rounded-2xl px-3 py-2.5 shadow-xl hidden sm:flex items-center gap-2.5 z-10"
        style={{ maxWidth: 195 }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: "var(--brand-600)" }}
        >
          Dr
        </div>
        <p className="text-[11px] font-medium leading-snug" style={{ color: "#1a3a28" }}>
          &ldquo;Personelimiz artık çok daha hazırlıklı!&rdquo;
        </p>
      </div>

      {/* Floating notification pill */}
      <div
        className="absolute bottom-10 -right-2 bg-white rounded-full px-3 py-2 shadow-lg hidden sm:flex items-center gap-2 z-10"
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--brand-50)" }}
        >
          <Bell className="w-2.5 h-2.5" style={{ color: "var(--brand-600)" }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: "#1a3a28" }}>
          Yeni sertifika hazır
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: "var(--brand-600)" }}
        />
      </div>
    </div>
  );
}

const HERO_NAV = [
  { label: "Hakkında",   href: "#hakkinda"   },
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Güvenlik",   href: "#guvenlik"   },
  { label: "SSS",        href: "#sss"        },
];

export function HeroSection() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── NAVBAR ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "#f5f0e6",
          borderColor: "rgba(26,58,40,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg"
              style={{ background: "linear-gradient(135deg, var(--brand-600), #1a3a28)" }}
            >
              H
            </div>
            <div className="leading-none">
              <p className="font-bold text-base" style={{ color: "#1a3a28" }}>
                Hastane LMS
              </p>
              <p
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "var(--brand-600)" }}
              >
                Eğitim Platformu
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {HERO_NAV.map(({ label, href }) => (
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

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 -mr-1 rounded-xl transition-colors hover:bg-black/5 cursor-pointer"
              style={{ color: "#1a3a28" }}
              aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mx-4 mb-3 rounded-2xl p-4"
              style={{
                backgroundColor: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
              }}
            >
              {HERO_NAV.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium py-2.5 px-3 rounded-xl transition-colors hover:bg-black/5"
                  style={{ color: "#1a3a28" }}
                >
                  {label}
                </a>
              ))}
              <div className="border-t mt-2 pt-3" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-black text-center py-2.5 rounded-xl uppercase tracking-wide"
                  style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
                >
                  Giriş Yap
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 xl:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left text */}
        <div>
          <span
            className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase px-4 py-1.5 rounded-full border mb-7"
            style={{ color: "var(--brand-600)", borderColor: "var(--brand-600)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "var(--brand-600)" }}
            />
            Personel Eğitim Platformu
          </span>

          <h1
            className="text-[2rem] sm:text-[2.75rem] xl:text-[3.5rem] font-black leading-none mb-5 sm:mb-6 tracking-tight"
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
          </h1>

          <p
            className="text-sm sm:text-base leading-relaxed max-w-[400px] mb-8 sm:mb-10"
            style={{ color: "#4a7060" }}
          >
            Hastane personellerinize video tabanlı eğitimler atayın, sınav
            yapın ve performansı gerçek zamanlı takip edin.
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 sm:mb-12">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-full text-sm font-black uppercase tracking-wide transition-transform hover:scale-105 shadow-lg"
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
              className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-60"
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
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4">
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
          </div>
        </div>

        {/* Right — static dashboard mockup */}
        <div className="flex justify-center lg:justify-end overflow-hidden">
          <HeroVisual />
        </div>
      </section>
    </>
  );
}
