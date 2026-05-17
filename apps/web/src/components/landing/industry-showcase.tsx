"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Stethoscope,
  HardHat,
  ShieldCheck,
  HeartPulse,
  ClipboardCheck,
  Award,
  Flame,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { TiltCard } from "./tilt-card";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const EASE = [0.22, 1, 0.36, 1] as const;

type Card = {
  title: string;
  desc: string;
  duration: string;
  badge: { label: string; tone: "required" | "new" | "popular" };
  Icon: typeof Stethoscope;
};

type Panel = {
  key: "health" | "industry";
  tag: string;
  Icon: typeof Stethoscope;
  title: string;
  desc: string;
  accent: string;
  accentSoft: string;
  bgGradient: string;
  cards: Card[];
};

const PANELS: Panel[] = [
  {
    key: "health",
    tag: "Sektör 01 — Sağlık",
    Icon: Stethoscope,
    title: "Klinik kalite, JCI denetimine hazır.",
    desc: "Hastane, klinik ve eczanelere özel zorunlu eğitim modülleri. KVKK, Sağlık Bakanlığı ve JCI uyum paketleri ile tek tıkla atama.",
    accent: "var(--landing-sector-health)",
    accentSoft: "var(--landing-sector-health-soft)",
    bgGradient:
      "linear-gradient(145deg, #0a2418 0%, #061a10 100%)",
    cards: [
      {
        title: "Hijyen & Enfeksiyon Kontrolü",
        desc: "WHO el hijyeni protokolleri, izolasyon prosedürleri, hastane edinimli enfeksiyon önleme.",
        duration: "2 saat",
        badge: { label: "Zorunlu", tone: "required" },
        Icon: ShieldCheck,
      },
      {
        title: "Acil Müdahale & CPR",
        desc: "Temel yaşam desteği, kalp-akciğer canlandırma, defibrilatör kullanımı — sertifikalı.",
        duration: "4 saat",
        badge: { label: "Sertifikalı", tone: "new" },
        Icon: HeartPulse,
      },
      {
        title: "Hasta Güvenliği & KVKK",
        desc: "Kimliklendirme, ilaç güvenliği, KVKK aydınlatma süreçleri ve hasta hakları.",
        duration: "3 saat",
        badge: { label: "Popüler", tone: "popular" },
        Icon: ClipboardCheck,
      },
      {
        title: "JCI Akreditasyon",
        desc: "Joint Commission International standartları, denetim öncesi hazırlık ve doküman.",
        duration: "6 saat",
        badge: { label: "Zorunlu", tone: "required" },
        Icon: Award,
      },
    ],
  },
  {
    key: "industry",
    tag: "Sektör 02 — Üretim & Lojistik",
    Icon: HardHat,
    title: "Saha disiplini, ISO 45001 uyumlu.",
    desc: "Fabrika, depo ve saha personeline yönelik İSG, kalite ve operasyonel eğitimler. Vardiya-uyumlu mobil erişim, SCORM içerik aktarımı.",
    accent: "var(--landing-sector-industry)",
    accentSoft: "var(--landing-sector-industry-soft)",
    bgGradient:
      "linear-gradient(145deg, #2a1c0a 0%, #1a1206 100%)",
    cards: [
      {
        title: "İSG Temel Modülü",
        desc: "6331 sayılı İSG Kanunu, risk değerlendirmesi, KKD kullanımı — yıllık tekrar zorunlu.",
        duration: "8 saat",
        badge: { label: "Zorunlu", tone: "required" },
        Icon: ShieldCheck,
      },
      {
        title: "ISO 45001 İş Sağlığı & Güvenliği",
        desc: "Yönetim sistemi standardı, dokümantasyon, iç denetim — tedarikçi onayı için kritik.",
        duration: "5 saat",
        badge: { label: "Sertifikalı", tone: "new" },
        Icon: Award,
      },
      {
        title: "Forklift & Saha Operatörlüğü",
        desc: "Pratik + teorik forklift sertifikası, yüksekte çalışma, kapalı alan güvenliği.",
        duration: "10 saat",
        badge: { label: "Popüler", tone: "popular" },
        Icon: Truck,
      },
      {
        title: "Acil Tahliye & Yangın",
        desc: "Yangın söndürücü tipleri, tahliye senaryoları, ilk yardım entegrasyonu — yıllık tatbikat.",
        duration: "4 saat",
        badge: { label: "Zorunlu", tone: "required" },
        Icon: Flame,
      },
    ],
  },
];

const BADGE_STYLES: Record<
  Card["badge"]["tone"],
  { bg: string; fg: string; Icon: typeof Flame }
> = {
  required: { bg: "var(--landing-accent)", fg: "var(--landing-ink)", Icon: AlertTriangle },
  new: { bg: "var(--landing-brand)", fg: "white", Icon: Award },
  popular: { bg: "var(--landing-ink)", fg: "var(--landing-surface)", Icon: ShieldCheck },
};

export function IndustryShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const isMobile = useMobile();
  const disablePin = isMobile || shouldReduce;

  useGSAP(
    () => {
      if (disablePin) return;
      const track = trackRef.current;
      const container = containerRef.current;
      if (!track || !container) return;

      const ctx = gsap.context(() => {
        gsap.to(track, {
          xPercent: -50,
          ease: "none",
          scrollTrigger: {
            trigger: container,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            end: () => `+=${window.innerHeight * 1.5}`,
            invalidateOnRefresh: true,
          },
        });
      }, container);

      return () => ctx.revert();
    },
    { dependencies: [disablePin] },
  );

  return (
    <section
      id="sektorler"
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        backgroundColor: "var(--landing-bg)",
        minHeight: disablePin ? "auto" : "100vh",
      }}
      aria-label="Sektörler — sağlık ve üretim"
    >
      {/* Mobil / reduced motion → vertical stack */}
      {disablePin && (
        <div className="py-14 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-center mb-10"
          >
            <p
              className="text-[10px] font-black tracking-[0.24em] uppercase mb-3"
              style={{ color: "var(--landing-brand)" }}
            >
              Sektörler
            </p>
            <h2
              className="text-2xl sm:text-3xl font-black leading-[1.1] tracking-tight"
              style={{ color: "var(--landing-ink)" }}
            >
              Her sektör için{" "}
              <span style={{ color: "var(--landing-brand)" }}>
                hazır eğitim seti.
              </span>
            </h2>
          </motion.div>

          <div className="space-y-10 sm:space-y-14">
            {PANELS.map((panel, panelIdx) => (
              <SectorPanel
                key={panel.key}
                panel={panel}
                isStacked
                animationDelay={panelIdx * 0.1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Desktop → horizontal pin */}
      {!disablePin && (
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div
            ref={trackRef}
            className="flex flex-nowrap"
            style={{ width: `${PANELS.length * 100}vw` }}
          >
            {PANELS.map((panel) => (
              <div
                key={panel.key}
                className="flex-shrink-0 w-screen h-screen flex items-center px-8 lg:px-16 xl:px-24"
                aria-hidden={false}
              >
                <SectorPanel panel={panel} isStacked={false} />
              </div>
            ))}
          </div>

          <ProgressIndicator />
        </div>
      )}
    </section>
  );
}

function SectorPanel({
  panel,
  isStacked,
  animationDelay = 0,
}: {
  panel: Panel;
  isStacked: boolean;
  animationDelay?: number;
}) {
  const shouldReduce = useReducedMotion();
  const SectorIcon = panel.Icon;

  return (
    <div
      id={`sektor-${panel.key}`}
      className={
        isStacked
          ? "rounded-3xl overflow-hidden"
          : "w-full max-w-7xl mx-auto grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16 items-center"
      }
      style={
        isStacked
          ? {
              backgroundColor: "var(--landing-surface)",
              border: "1px solid var(--landing-rule)",
              boxShadow: "var(--landing-shadow-card)",
            }
          : undefined
      }
    >
      <motion.header
        initial={
          isStacked
            ? { opacity: 0, y: shouldReduce ? 0 : 16 }
            : false
        }
        whileInView={isStacked ? { opacity: 1, y: 0 } : undefined}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: EASE, delay: animationDelay }}
        className={
          isStacked ? "p-6 sm:p-8" : "flex flex-col gap-5 max-w-md"
        }
      >
        <span
          className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black tracking-[0.18em] uppercase"
          style={{
            backgroundColor: panel.accentSoft,
            color: panel.accent,
          }}
        >
          <SectorIcon className="w-3.5 h-3.5" strokeWidth={2.4} />
          {panel.tag}
        </span>
        <h3
          className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem] font-black leading-[1.05] tracking-tight mt-4 lg:mt-5"
          style={{ color: "var(--landing-ink)" }}
        >
          {panel.title}
        </h3>
        <p
          className="text-sm sm:text-base leading-relaxed mt-3"
          style={{ color: "var(--landing-ink-soft)", maxWidth: 440 }}
        >
          {panel.desc}
        </p>
        {!isStacked && (
          <div
            className="mt-4 inline-flex items-center gap-3 text-[11px] font-black tracking-[0.18em] uppercase"
            style={{ color: "var(--landing-ink-soft)" }}
          >
            <span
              className="w-8 h-[2px] rounded-full"
              style={{ backgroundColor: panel.accent }}
            />
            4 zorunlu modül · SCORM destekli
          </div>
        )}
      </motion.header>

      <div
        className={
          isStacked
            ? "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-6 sm:p-8 pt-0 sm:pt-0"
            : "grid grid-cols-2 gap-4 lg:gap-5"
        }
      >
        {panel.cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={
              isStacked
                ? { opacity: 0, y: shouldReduce ? 0 : 20 }
                : false
            }
            whileInView={isStacked ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.55,
              ease: EASE,
              delay: animationDelay + idx * 0.06,
            }}
          >
            <TrainingCard card={card} accent={panel.accent} bgGradient={panel.bgGradient} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TrainingCard({
  card,
  accent,
  bgGradient,
}: {
  card: Card;
  accent: string;
  bgGradient: string;
}) {
  const badge = BADGE_STYLES[card.badge.tone];
  const BadgeIcon = badge.Icon;
  const CardIcon = card.Icon;

  return (
    <TiltCard
      intensity={5}
      className="relative h-full rounded-2xl overflow-hidden"
    >
      <div
        className="relative h-full min-h-[220px] sm:min-h-[260px] p-5 sm:p-6 flex flex-col"
        style={{
          background: bgGradient,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 24px 48px -22px rgba(0,0,0,0.45)",
        }}
      >
        <div
          aria-hidden
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-30 pointer-events-none"
          style={{ backgroundColor: accent, filter: "blur(40px)" }}
        />

        <div className="relative flex items-center justify-between mb-5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: accent,
            }}
          >
            <CardIcon className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-[0.12em] uppercase"
            style={{ backgroundColor: badge.bg, color: badge.fg }}
          >
            <BadgeIcon className="w-2.5 h-2.5" strokeWidth={2.6} />
            {card.badge.label}
          </span>
        </div>

        <h4
          className="relative text-base sm:text-lg font-black leading-tight mb-2"
          style={{ color: "white" }}
        >
          {card.title}
        </h4>
        <p
          className="relative text-xs sm:text-sm leading-relaxed mb-5 flex-1"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          {card.desc}
        </p>

        <div
          className="relative pt-4 mt-auto flex items-center justify-between text-[11px] font-bold tracking-[0.1em] uppercase"
          style={{
            color: "rgba(255,255,255,0.55)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span>{card.duration}</span>
          <span
            className="inline-flex items-center gap-1"
            style={{ color: accent }}
          >
            Modüle git →
          </span>
        </div>
      </div>
    </TiltCard>
  );
}

function ProgressIndicator() {
  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-5 py-2.5 rounded-full"
      style={{
        backgroundColor: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(10px)",
        border: "1px solid var(--landing-rule)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: "var(--landing-brand)" }}
      />
      <span
        className="text-[10px] font-black tracking-[0.2em] uppercase"
        style={{ color: "var(--landing-ink)" }}
      >
        Kaydır → 2 sektör
      </span>
    </div>
  );
}
