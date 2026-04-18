"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Sparkles,
  HeartHandshake,
  Compass,
  Lock,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { BRAND } from "@/lib/brand";

const EASE = [0.22, 1, 0.36, 1] as const;

const BETA_BENEFITS = [
  {
    icon: Sparkles,
    title: "Lansman öncesi avantajlı koşullar",
    desc: "Erken erişime özel fiyatlandırma ve uzatılmış sözleşme avantajları.",
  },
  {
    icon: HeartHandshake,
    title: "Ürün ekibiyle doğrudan iletişim",
    desc: "Sorunlarınızı saatler içinde değerlendirip versiyon bazında çözeriz.",
  },
  {
    icon: Compass,
    title: "Yol haritasına etki",
    desc: "İK, kalite, denetim modüllerinin önceliğini birlikte belirleyelim.",
  },
  {
    icon: Lock,
    title: "Veri taşıma desteği",
    desc: "Mevcut eğitim içeriklerinizi platforma biz aktarırız.",
  },
];

export function TestimonialsSection() {
  const shouldReduce = useReducedMotion();

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: shouldReduce ? 0 : 0.08 } },
  };

  const cardIn = {
    hidden: { opacity: 0, y: shouldReduce ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
  };

  const footerCol = {
    hidden: { opacity: 0, y: shouldReduce ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };

  const footerStagger = {
    hidden: {},
    visible: { transition: { staggerChildren: shouldReduce ? 0 : 0.1 } },
  };

  return (
    <>
      {/* ── BETA / EARLY ACCESS ── */}
      <section
        id="beta"
        className="relative py-14 sm:py-20 overflow-hidden"
        style={{ backgroundColor: "#ece7d7" }}
        aria-label="Beta erken erişim programı"
      >
        {/* Soft brand glow */}
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: "#0d9668", opacity: 0.06 }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-center mb-10 sm:mb-14"
          >
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5"
              style={{
                backgroundColor: "rgba(13,150,104,0.1)",
                border: "1px solid rgba(13,150,104,0.25)",
              }}
            >
              <span
                className="relative inline-flex w-2 h-2 rounded-full"
                style={{ backgroundColor: "#0d9668" }}
              >
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: "#0d9668", opacity: 0.5 }}
                />
              </span>
              <span
                className="text-[11px] font-extrabold tracking-[0.18em] uppercase"
                style={{ color: "var(--brand-600)" }}
              >
                Erken Erişim Programı
              </span>
            </div>
            <h2
              className="text-2xl sm:text-3xl md:text-5xl font-extrabold leading-[1.05] mb-5"
              style={{ color: "#1a3a28", letterSpacing: "-0.025em" }}
            >
              İlk müşterilere
              <br />
              <span style={{ color: "var(--brand-600)" }}>özel avantajlarla katılın.</span>
            </h2>
            <p
              className="text-[15px] sm:text-base leading-relaxed mx-auto"
              style={{ color: "#3d5e51", maxWidth: 580 }}
            >
              {BRAND.name} şu an erken erişim aşamasında. Beta dönemine
              katılan kurumlar, fiyatlandırmadan modül önceliklerine kadar
              avantajlı koşullarla başlar.
            </p>
          </motion.div>

          {/* ── Benefit grid ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5"
          >
            {BETA_BENEFITS.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={cardIn}
                whileHover={
                  shouldReduce
                    ? undefined
                    : { y: -4, transition: { duration: 0.25 } }
                }
                className="relative rounded-3xl p-6 sm:p-7 bg-white"
                style={{
                  boxShadow:
                    "0 20px 40px -24px rgba(26,58,40,0.22), 0 0 0 1px rgba(26,58,40,0.05)",
                }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    backgroundColor: "rgba(13,150,104,0.1)",
                    border: "1px solid rgba(13,150,104,0.2)",
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: "var(--brand-600)" }}
                    strokeWidth={2.2}
                  />
                </div>
                <h3
                  className="text-base sm:text-lg font-extrabold mb-1.5"
                  style={{ color: "#1a3a28", letterSpacing: "-0.01em" }}
                >
                  {title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#3d5e51" }}
                >
                  {desc}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* ── CTA bar ── */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            className="mt-10 sm:mt-12 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5"
            style={{
              backgroundColor: "#1a3a28",
              boxShadow:
                "0 30px 60px -28px rgba(26,58,40,0.45), 0 0 0 1px rgba(26,58,40,0.1)",
            }}
          >
            <div>
              <p
                className="text-[11px] font-extrabold tracking-[0.18em] uppercase mb-2"
                style={{ color: "#6dba92" }}
              >
                Sınırlı Kontenjan
              </p>
              <h3
                className="text-lg sm:text-xl md:text-2xl font-extrabold text-white leading-snug"
                style={{ letterSpacing: "-0.01em" }}
              >
                Kurumunuza özel demoyu planlayın.
              </h3>
            </div>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-7 h-12 sm:h-auto sm:py-3.5 rounded-full text-sm font-bold uppercase tracking-[0.12em] transition-transform hover:scale-105 flex-shrink-0"
              style={{
                backgroundColor: "#f59e0b",
                color: "#1a3a28",
                boxShadow: "0 12px 32px rgba(245,158,11,0.35)",
              }}
            >
              Demo Talep Et <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
          </motion.div>

          {/* ── Trust bar — design intent, not certifications ── */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            className="mt-10 sm:mt-14 flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 gap-y-3 sm:gap-y-4"
          >
            {[
              "KVKK için tasarlandı",
              "JCI denetimine hazır",
              "Multi-tenant izolasyon",
              "Audit log ile şeffaflık",
            ].map((label) => (
              <div
                key={label}
                className="flex items-center gap-2"
                style={{ color: "#3d5e51" }}
              >
                <BadgeCheck
                  className="w-4 h-4"
                  style={{ color: "#0d9668" }}
                  strokeWidth={2.5}
                />
                <span className="text-xs font-extrabold tracking-[0.1em] uppercase">
                  {label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 sm:py-12" style={{ backgroundColor: "#1a3a28" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={footerStagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10"
          >
            {/* Newsletter */}
            <motion.div variants={footerCol}>
              <h4 className="font-bold text-white text-sm mb-3">
                Beta haberlerine abone olun
              </h4>
              <p className="text-xs mb-4" style={{ color: "#6dba92" }}>
                Modül lansmanları ve yol haritası güncellemeleri.
              </p>
              <form
                className="flex gap-2"
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="E-posta adresiniz"
                  className="flex-1 rounded-xl px-4 py-2.5 text-white text-sm outline-none border min-w-0"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.07)",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                  suppressHydrationWarning
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl font-bold transition-transform hover:scale-105 flex-shrink-0"
                  style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
                  aria-label="Abone ol"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>

            {[
              {
                title: "Platform",
                items: ["Modüller", "Eğitim Kataloğu", "SSS", "Yol Haritası"],
              },
              {
                title: "Modüller",
                items: [
                  "Video Eğitim",
                  "Sınav & Soru Bankası",
                  "Sertifika & QR",
                  "Raporlama",
                ],
              },
              {
                title: "İletişim",
                items: [BRAND.contact.email, BRAND.contact.phone, BRAND.contact.city],
              },
            ].map(({ title, items }) => (
              <motion.div key={title} variants={footerCol}>
                <h4 className="font-bold text-white text-sm mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        className="text-sm hover:text-white transition-colors"
                        style={{ color: "#6dba92" }}
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          <div
            className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-xs" style={{ color: "#6dba92" }}>
              © {BRAND.legal.copyrightYear} {BRAND.name}. Tüm hakları saklıdır.
            </p>
            <Link
              href="/kvkk"
              className="text-xs hover:text-white transition-colors"
              style={{ color: "#6dba92" }}
            >
              KVKK Aydınlatma Metni
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
