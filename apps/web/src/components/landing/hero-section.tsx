"use client";

import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  Play,
  Star,
  TrendingUp,
  Users,
  Award,
  Bell,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";

type Sector = "health";

const EASE = [0.22, 1, 0.36, 1] as const;

const SECTOR_CONFIG: Record<
  Sector,
  {
    label: string;
    Icon: typeof Stethoscope;
    accent: string;
    headline: string;
    badge: string;
    badgeTone: string;
    activeTraining: string;
    badgeIcon: typeof ShieldCheck;
    stats: { label: string; value: string; icon: typeof TrendingUp; color: string }[];
    notification: { title: string; person: string };
    quote: { initials: string; text: string };
    bgGradient: string;
  }
> = {
  health: {
    label: "Sağlık",
    Icon: Stethoscope,
    accent: "var(--landing-sector-health)",
    headline: "Hijyen, CPR, Hasta Güvenliği",
    badge: "Aktif Eğitim",
    badgeTone: "● Devam Ediyor",
    activeTraining: "Acil Müdahale & CPR Eğitimi",
    badgeIcon: ShieldCheck,
    stats: [
      { label: "Başarı Oranı", value: "%94", icon: TrendingUp, color: "#4ade80" },
      { label: "Katılımcı", value: "218", icon: Users, color: "#f59e0b" },
    ],
    notification: { title: "Sertifika Kazanıldı!", person: "Hijyen Eğitimi — Ayşe K." },
    quote: { initials: "Dr", text: "Personelimiz artık çok daha hazırlıklı!" },
    bgGradient: "linear-gradient(145deg, #1a3a28 0%, #0d2010 100%)",
  },
};

function HeroVisual({ sector }: { sector: Sector }) {
  const cfg = SECTOR_CONFIG[sector];
  const BadgeIcon = cfg.badgeIcon;

  return (
    <div className="relative flex items-center justify-center select-none w-full max-w-[420px] mx-auto overflow-hidden">
      <div
        className="absolute w-[115%] aspect-square rounded-full border opacity-[0.07]"
        style={{ borderColor: "var(--landing-brand)" }}
      />
      <div
        className="absolute w-[90%] aspect-square rounded-full border opacity-[0.12]"
        style={{ borderColor: "var(--landing-brand)" }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={sector}
          initial={{ opacity: 0, scale: 0.96, rotateY: -8 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.96, rotateY: 8 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="relative w-full aspect-square flex-shrink-0"
          style={{
            borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
            background: cfg.bgGradient,
            overflow: "hidden",
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: cfg.accent }}
          />
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-10"
            style={{ backgroundColor: "#4ade80" }}
          />

          <div className="absolute inset-0 flex flex-col justify-center px-7 py-7 gap-3">
            <div
              className="rounded-2xl p-4 border"
              style={{
                backgroundColor: "rgba(255,255,255,0.07)",
                borderColor: "rgba(255,255,255,0.12)",
              }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {cfg.badge}
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }}
                >
                  {cfg.badgeTone}
                </span>
              </div>
              <p className="text-white font-bold text-sm mb-3">{cfg.activeTraining}</p>
              <div
                className="w-full h-1.5 rounded-full mb-1.5"
                style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "68%" }}
                  transition={{ duration: 1, ease: EASE, delay: 0.3 }}
                  className="h-1.5 rounded-full"
                  style={{ backgroundColor: cfg.accent }}
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

            <div className="grid grid-cols-2 gap-2.5">
              {cfg.stats.map(({ label, value, icon: Icon, color }) => (
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
                <Award className="w-3.5 h-3.5" style={{ color: "var(--landing-accent)" }} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-white leading-tight">
                  {cfg.notification.title}
                </p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {cfg.notification.person}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div
        className="absolute top-0 right-4 sm:right-10 w-14 h-14 sm:w-18 sm:h-18 rounded-full flex flex-col items-center justify-center text-center z-10 pointer-events-none"
        style={{
          backgroundColor: "var(--landing-accent)",
          color: "var(--landing-ink)",
          boxShadow: "0 4px 20px rgba(245,158,11,0.45)",
        }}
      >
        <BadgeIcon className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide mt-0.5">
          {sector === "health" ? "JCI" : "ISO"}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`quote-${sector}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="absolute -left-2 top-12 bg-white rounded-2xl px-3 py-2.5 shadow-xl hidden sm:flex items-center gap-2.5 z-10"
          style={{ maxWidth: 220 }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ backgroundColor: cfg.accent }}
          >
            {cfg.quote.initials}
          </div>
          <p
            className="text-[11px] font-medium leading-snug"
            style={{ color: "var(--landing-ink)" }}
          >
            &ldquo;{cfg.quote.text}&rdquo;
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-10 -right-2 bg-white rounded-full px-3 py-2 shadow-lg hidden sm:flex items-center gap-2 z-10">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in srgb, var(--landing-brand) 14%, white)" }}
        >
          <Bell className="w-2.5 h-2.5" style={{ color: "var(--landing-brand)" }} />
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--landing-ink)" }}
        >
          Yeni sertifika hazır
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: "var(--landing-brand)" }}
        />
      </div>
    </div>
  );
}

const HEADLINE_WORDS = [
  "Klinik",
  "disiplinli",
  "kurumsal",
  "eğitim.",
  "Sağlık",
  "ekibinize",
  "özel.",
];

const HIGHLIGHT_INDICES = new Set([0, 1]);

export function HeroSection() {
  const shouldReduce = useReducedMotion();
  const sector: Sector = "health";

  return (
    <section
      id="hero"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 xl:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
    >
      <div>
        <h1
          className="text-[2rem] sm:text-[2.75rem] xl:text-[3.5rem] font-black leading-[1.04] mb-5 sm:mb-6 tracking-tight"
          style={{ color: "var(--landing-ink)" }}
        >
          {HEADLINE_WORDS.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ opacity: 0, y: shouldReduce ? 0 : 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.5,
                ease: EASE,
                delay: shouldReduce ? 0 : 0.1 + i * 0.06,
              }}
              className="inline-block mr-[0.28em]"
              style={
                HIGHLIGHT_INDICES.has(i)
                  ? {
                      color: "var(--landing-brand)",
                    }
                  : undefined
              }
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: shouldReduce ? 0 : 0.6 }}
          className="text-sm sm:text-base leading-relaxed max-w-[440px] mb-8 sm:mb-10"
          style={{ color: "var(--landing-ink-soft)" }}
        >
          Personelinizi atayın, video ile eğitin, sınava sokun ve sertifikalandırın.
          Hijyenden iş güvenliğine, klinik disiplinde tek panel — sağlık merkezinden
          üretim hattına aynı standart.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: shouldReduce ? 0 : 0.75 }}
          className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 sm:mb-12"
        >
          <Link
            prefetch={false}
            href="/auth/login"
            className="inline-flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-full text-sm font-black uppercase tracking-wide shadow-lg hover:scale-105"
            style={{
              backgroundColor: "var(--landing-accent)",
              color: "var(--landing-ink)",
              boxShadow: "0 12px 32px rgba(245,158,11,0.32)",
              transition: "transform 240ms var(--landing-ease-spring)",
            }}
          >
            Demo Talep Et <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            prefetch={false}
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-60"
            style={{
              color: "var(--landing-ink)",
              transition: "opacity 180ms var(--landing-ease)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: "var(--landing-ink)" }}
            >
              <Play className="w-3 h-3 ml-0.5" />
            </div>
            Süreci İzle
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: shouldReduce ? 0 : 0.9 }}
          className="flex items-center gap-4"
        >
          <div className="flex -space-x-2.5">
            {(
              [
                { bg: "var(--landing-sector-health)", letter: "A" },
                { bg: "var(--landing-ink)", letter: "M" },
                { bg: "var(--landing-sector-industry)", letter: "F" },
                { bg: "var(--landing-brand)", letter: "K" },
              ] as const
            ).map(({ bg, letter }) => (
              <div
                key={letter}
                className="w-9 h-9 rounded-full border-[2.5px] flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: bg, borderColor: "var(--landing-bg)" }}
              >
                {letter}
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-0.5 mb-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-3.5 h-3.5"
                  style={{
                    fill: "var(--landing-accent)",
                    color: "var(--landing-accent)",
                  }}
                />
              ))}
            </div>
            <p
              className="text-xs font-medium"
              style={{ color: "var(--landing-ink-soft)" }}
            >
              <strong style={{ color: "var(--landing-ink)" }}>96 kurum</strong>{" "}
              ·{" "}
              <span>{SECTOR_CONFIG[sector].headline}</span>
            </p>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-center lg:justify-end overflow-hidden">
        <HeroVisual sector={sector} />
      </div>
    </section>
  );
}
