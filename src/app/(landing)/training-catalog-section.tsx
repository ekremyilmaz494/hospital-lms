"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const TRAININGS = [
  "El Hijyeni & KKD",
  "CPR / Temel Yaşam Desteği",
  "Enfeksiyon Kontrol",
  "Yangın & Tahliye",
  "Hasta Güvenliği",
  "İletişim & Empati",
  "KVKK & Hasta Mahremiyeti",
  "Tıbbi Etik",
  "Atık Yönetimi",
  "İlaç Güvenliği",
  "JCI Hazırlık",
  "Oryantasyon",
] as const;

export function TrainingCatalogSection() {
  const shouldReduce = useReducedMotion();

  return (
    <section
      id="katalog"
      className="relative py-14 sm:py-20 md:py-24 overflow-hidden"
      style={{ backgroundColor: "#f5f0e6" }}
      aria-label="Eğitim kataloğu"
    >
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "-20%",
          left: "-10%",
          width: 540,
          height: 540,
          borderRadius: "60% 40% 50% 50%",
          background:
            "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="max-w-2xl mb-10 sm:mb-12"
        >
          <p
            className="text-[10px] sm:text-xs font-extrabold tracking-[0.18em] uppercase mb-3"
            style={{ color: "var(--brand-600)" }}
          >
            Ne Türde Eğitimler Verilebilir?
          </p>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl xl:text-[2.5rem] font-extrabold leading-[1.05]"
            style={{ color: "#1a3a28", letterSpacing: "-0.025em" }}
          >
            Sağlık kurumunuzun her zorunlu eğitimi{" "}
            <span style={{ color: "var(--brand-600)" }}>
              tek platformdan yönetilir.
            </span>
          </h2>
          <p
            className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed"
            style={{ color: "#3d5e51" }}
          >
            Hazır içerik şart değil — kendi videolarınızı, sınavlarınızı ve
            sertifika şablonlarınızı yükleyin. Platform içerik değil, çerçeve
            sunar.
          </p>
        </motion.div>

        {/* Chip grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: shouldReduce ? 0 : 0.04 } },
          }}
          className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3"
        >
          {TRAININGS.map((label) => (
            <motion.span
              key={label}
              variants={{
                hidden: { opacity: 0, y: shouldReduce ? 0 : 8 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold"
              style={{
                backgroundColor: "rgba(255,255,255,0.7)",
                color: "#1a3a28",
                border: "1px solid rgba(26,58,40,0.1)",
                boxShadow: "0 2px 8px -4px rgba(26,58,40,0.08)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "var(--brand-600)" }}
              />
              {label}
            </motion.span>
          ))}

          {/* "Add your own" chip */}
          <motion.span
            variants={{
              hidden: { opacity: 0, y: shouldReduce ? 0 : 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-extrabold"
            style={{
              backgroundColor: "#1a3a28",
              color: "#f5f0e6",
              boxShadow: "0 8px 20px -8px rgba(26,58,40,0.4)",
            }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Kendi içeriğinizi yükleyin
          </motion.span>
        </motion.div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          className="mt-10 sm:mt-12 inline-flex items-start gap-3 px-5 py-4 rounded-2xl"
          style={{
            backgroundColor: "rgba(13,150,104,0.08)",
            border: "1px solid rgba(13,150,104,0.2)",
          }}
        >
          <Sparkles
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{ color: "var(--brand-600)" }}
            strokeWidth={2.2}
          />
          <p className="text-sm leading-relaxed" style={{ color: "#1a3a28" }}>
            <span className="font-extrabold">SCORM ve video formatları</span>{" "}
            destekli. Mevcut eğitim içeriklerinizi kayıpsız taşıyabilirsiniz.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
