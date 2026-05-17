"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star, Stethoscope, HardHat } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

type Testimonial = {
  sector: "health" | "industry";
  initials: string;
  name: string;
  role: string;
  org: string;
  quote: string;
  metric: { label: string; value: string };
};

const TESTIMONIALS: Testimonial[] = [
  {
    sector: "health",
    initials: "AK",
    name: "Dr. Ayşe Kaya",
    role: "Eğitim Koordinatörü",
    org: "Devakent Hastanesi",
    quote:
      "Zorunlu eğitim tamamlama oranımız %60'tan %94'e çıktı. Hijyen ve CPR sertifikaları JCI denetimine 1 günde hazırlandı.",
    metric: { label: "Tamamlanma", value: "%94" },
  },
  {
    sector: "industry",
    initials: "MD",
    name: "Murat Demir",
    role: "İSG Uzmanı",
    org: "Hedef Üretim — Konya",
    quote:
      "Forklift ve yüksekte çalışma sertifikalarını saha vardiyasıyla senkron yürütüyoruz. Bürokrasi 4 günden 1 güne indi.",
    metric: { label: "Süre kazancı", value: "4×" },
  },
];

const SECTOR_META: Record<
  Testimonial["sector"],
  { label: string; Icon: typeof Stethoscope; accent: string }
> = {
  health: {
    label: "Sağlık",
    Icon: Stethoscope,
    accent: "var(--landing-sector-health)",
  },
  industry: {
    label: "Üretim & Lojistik",
    Icon: HardHat,
    accent: "var(--landing-sector-industry)",
  },
};

export function ProofSection() {
  const shouldReduce = useReducedMotion();

  return (
    <section
      className="relative py-14 sm:py-20 md:py-24 overflow-hidden"
      style={{ backgroundColor: "var(--landing-surface-deep)" }}
      aria-label="Müşteri görüşleri"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-10 sm:mb-14"
        >
          <p
            className="text-[10px] sm:text-xs font-black tracking-[0.24em] uppercase mb-3"
            style={{ color: "var(--landing-brand)" }}
          >
            Kurumlardan
          </p>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-black leading-[1.1] tracking-tight"
            style={{ color: "var(--landing-ink)" }}
          >
            Sağlıktan üretime,{" "}
            <span style={{ color: "var(--landing-brand)" }}>
              aynı klinik disiplin.
            </span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-7">
          {TESTIMONIALS.map((t, i) => {
            const meta = SECTOR_META[t.sector];
            const Icon = meta.Icon;
            return (
              <motion.article
                key={t.name}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.65,
                  ease: EASE,
                  delay: i * 0.1,
                }}
                className="relative rounded-3xl p-6 sm:p-8 lg:p-10 flex flex-col"
                style={{
                  backgroundColor: "var(--landing-bg)",
                  border: "1px solid var(--landing-rule)",
                  boxShadow: "var(--landing-shadow-card)",
                }}
              >
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
                  style={{
                    background: `linear-gradient(90deg, ${meta.accent} 0%, color-mix(in srgb, ${meta.accent} 60%, transparent) 100%)`,
                  }}
                />

                <div className="flex items-center justify-between mb-6">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.18em] uppercase px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${meta.accent} 12%, transparent)`,
                      color: meta.accent,
                    }}
                  >
                    <Icon className="w-3 h-3" strokeWidth={2.4} />
                    {meta.label}
                  </span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, idx) => (
                      <Star
                        key={idx}
                        className="w-3.5 h-3.5"
                        style={{
                          fill: "var(--landing-accent)",
                          color: "var(--landing-accent)",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <p
                  className="text-base sm:text-lg leading-relaxed mb-7 font-medium"
                  style={{ color: "var(--landing-ink)" }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="mt-auto pt-6 flex items-center justify-between border-t" style={{ borderColor: "var(--landing-rule)" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-black"
                      style={{
                        background: `linear-gradient(135deg, ${meta.accent} 0%, color-mix(in srgb, ${meta.accent} 70%, black) 100%)`,
                      }}
                    >
                      {t.initials}
                    </div>
                    <div className="leading-tight">
                      <p
                        className="text-sm font-bold"
                        style={{ color: "var(--landing-ink)" }}
                      >
                        {t.name}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--landing-ink-soft)" }}
                      >
                        {t.role} · {t.org}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className="text-2xl font-black font-mono tracking-tight"
                      style={{ color: meta.accent }}
                    >
                      {t.metric.value}
                    </p>
                    <p
                      className="text-[10px] font-black tracking-[0.14em] uppercase mt-0.5"
                      style={{ color: "var(--landing-ink-soft)" }}
                    >
                      {t.metric.label}
                    </p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
