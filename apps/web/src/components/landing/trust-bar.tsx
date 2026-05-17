"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Stethoscope, Factory, Users, GraduationCap, Award, Building2 } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

const LOGO_MARKS = [
  { sector: "health" as const, name: "Devakent Hastanesi", short: "DK" },
  { sector: "health" as const, name: "Atlas Klinik", short: "AT" },
  { sector: "health" as const, name: "Mavi Eczane", short: "ME" },
  { sector: "industry" as const, name: "Hedef Üretim", short: "HÜ" },
  { sector: "industry" as const, name: "Volt Endüstri", short: "VE" },
  { sector: "industry" as const, name: "Akış Lojistik", short: "AL" },
];

const STATS = [
  { value: 12500, suffix: "+", label: "Aktif Personel", Icon: Users },
  { value: 480, suffix: "+", label: "Tamamlanan Eğitim", Icon: GraduationCap },
  { value: 32000, suffix: "+", label: "Sertifika", Icon: Award },
  { value: 96, suffix: "", label: "Kurum", Icon: Building2 },
];

export function TrustBar() {
  const shouldReduce = useReducedMotion();
  const duplicated = [...LOGO_MARKS, ...LOGO_MARKS];

  return (
    <section
      className="relative py-12 sm:py-16 overflow-hidden"
      style={{ backgroundColor: "var(--landing-bg)" }}
      aria-label="Müşteri kurumlar ve platform metrikleri"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-8"
        >
          <p
            className="text-[10px] sm:text-[11px] font-black tracking-[0.24em] uppercase"
            style={{ color: "var(--landing-ink-soft)" }}
          >
            Sağlıktan üretime, klinik disiplinde
          </p>
        </motion.div>

        {/* Logo marquee */}
        <div className="relative overflow-hidden mb-12 sm:mb-16">
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, var(--landing-bg) 0%, transparent 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(to left, var(--landing-bg) 0%, transparent 100%)",
            }}
          />
          <motion.div
            initial={{ x: 0 }}
            animate={shouldReduce ? { x: 0 } : { x: "-50%" }}
            transition={{ duration: 38, ease: "linear", repeat: Infinity }}
            className="flex gap-3 sm:gap-4 w-max"
          >
            {duplicated.map((mark, i) => {
              const Icon = mark.sector === "health" ? Stethoscope : Factory;
              const accent =
                mark.sector === "health"
                  ? "var(--landing-sector-health)"
                  : "var(--landing-sector-industry)";
              return (
                <div
                  key={`${mark.name}-${i}`}
                  className="flex items-center gap-3 px-5 py-3 rounded-2xl whitespace-nowrap"
                  style={{
                    backgroundColor: "var(--landing-surface)",
                    border: "1px solid var(--landing-rule)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm tracking-tight"
                    style={{
                      background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 75%, black) 100%)`,
                      color: "white",
                    }}
                  >
                    {mark.short}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--landing-ink)" }}
                    >
                      {mark.name}
                    </span>
                    <span
                      className="text-[10px] font-bold tracking-[0.14em] uppercase mt-0.5 inline-flex items-center gap-1"
                      style={{ color: accent }}
                    >
                      <Icon className="w-3 h-3" strokeWidth={2.4} />
                      {mark.sector === "health" ? "Sağlık" : "Üretim"}
                    </span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* KPI grid */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {STATS.map((s, i) => {
            const Icon = s.Icon;
            return (
              <div
                key={s.label}
                className="relative p-5 sm:p-6 rounded-2xl group"
                style={{
                  backgroundColor: "var(--landing-surface)",
                  border: "1px solid var(--landing-rule)",
                  boxShadow: "var(--landing-shadow-soft)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--landing-brand) 12%, transparent)",
                    color: "var(--landing-brand)",
                  }}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <div
                  className="text-3xl sm:text-4xl font-black leading-none mb-2 font-mono tracking-tight"
                  style={{ color: "var(--landing-ink)" }}
                >
                  <NumberTicker
                    value={s.value}
                    delay={0.2 + i * 0.1}
                    style={{ color: "var(--landing-ink)" }}
                  />
                  {s.suffix && (
                    <span style={{ color: "var(--landing-brand)" }}>
                      {s.suffix}
                    </span>
                  )}
                </div>
                <p
                  className="text-xs sm:text-sm font-semibold"
                  style={{ color: "var(--landing-ink-soft)" }}
                >
                  {s.label}
                </p>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
