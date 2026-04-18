"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useMobile } from "@/hooks/use-mobile";

const EASE = [0.22, 1, 0.36, 1] as const;

export function CtaSection() {
  const shouldReduce = useReducedMotion();
  const isMobile = useMobile();
  const disable3D = shouldReduce || isMobile;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: shouldReduce ? 0 : 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative rounded-3xl overflow-hidden grid md:grid-cols-2 gap-0"
        style={{
          backgroundColor: "#1a3a28",
          boxShadow:
            "0 40px 80px -30px rgba(26,58,40,0.5), 0 0 0 1px rgba(26,58,40,0.1)",
        }}
      >
        {/* ── LEFT: Photo panel ── */}
        <motion.div
          initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
          className="relative min-h-[340px] sm:min-h-[420px] md:min-h-[560px] flex items-center justify-center p-6 sm:p-8 md:p-10"
          style={{
            perspective: disable3D ? undefined : 1400,
            perspectiveOrigin: "50% 50%",
          }}
        >
          {/* Tilted wrapper */}
          <div
            className="relative w-full max-w-[320px] sm:max-w-[400px]"
            style={{
              transformStyle: disable3D ? undefined : "preserve-3d",
              transform: disable3D
                ? "none"
                : "rotateY(-8deg) rotateX(4deg)",
              transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {/* Photo card — rounded + big drop shadow for depth */}
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                boxShadow:
                  "0 40px 80px -15px rgba(0,0,0,0.55), 0 20px 40px -10px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
                transform: shouldReduce ? "none" : "translateZ(0)",
              }}
            >
              <Image
                src="/landing/learner.png"
                alt="Sağlık personeli online eğitim izliyor"
                width={840}
                height={1120}
                sizes="(min-width: 768px) 400px, 90vw"
                className="w-full h-auto object-cover block"
                priority
                unoptimized
              />

              {/* Subtle photo vignette — adds depth */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.25) 100%)",
                  mixBlendMode: "multiply",
                }}
              />

              {/* Top gloss highlight — gives a "screen / glass" feel */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-20 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, transparent 100%)",
                }}
              />
            </div>

            {/* Behind-card glow — adds 3D float */}
            <div
              aria-hidden
              className="absolute -inset-8 pointer-events-none rounded-[40px]"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 60%, rgba(13,150,104,0.22) 0%, transparent 65%)",
                filter: "blur(28px)",
                zIndex: -1,
              }}
            />

            {/* ── FLOATING CHIP: Top-left (Active Session) ── */}
            <motion.div
              initial={{ opacity: 0, x: shouldReduce ? 0 : -20, y: shouldReduce ? 0 : -8 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.7 }}
              className="absolute top-4 sm:top-6 -left-2 sm:-left-5 md:-left-10 z-30 flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl"
              style={{
                backgroundColor: "rgba(13,40,24,0.94)",
                border: "1px solid rgba(109,186,146,0.25)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 24px 48px -12px rgba(0,0,0,0.55)",
                transform: disable3D ? "none" : "translateZ(60px)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #0d9668 0%, #065f46 100%)",
                  boxShadow: "0 0 18px rgba(13,150,104,0.5)",
                }}
              >
                <CheckCircle className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] font-extrabold tracking-[0.16em] uppercase" style={{ color: "#6dba92" }}>
                  Realtime
                </p>
                <p className="text-sm font-extrabold text-white">Anlık senkron</p>
              </div>
            </motion.div>

            {/* ── FLOATING CHIP: Bottom-right (This Week) ── */}
            <motion.div
              initial={{ opacity: 0, x: shouldReduce ? 0 : 20, y: shouldReduce ? 0 : 10 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.9 }}
              className="absolute bottom-6 sm:bottom-10 -right-2 sm:-right-5 md:-right-10 z-30 flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl"
              style={{
                backgroundColor: "#f59e0b",
                boxShadow: "0 24px 48px -10px rgba(245,158,11,0.6)",
                transform: disable3D ? "none" : "translateZ(70px)",
              }}
            >
              <div className="leading-tight">
                <p className="text-[10px] font-extrabold tracking-[0.16em] uppercase" style={{ color: "#78350f" }}>
                  Otomatik
                </p>
                <p className="text-sm font-extrabold" style={{ color: "#1a3a28" }}>
                  Sertifika + QR
                </p>
              </div>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: "#1a3a28",
                  animation: shouldReduce ? "none" : "ctaPulse 2s ease-in-out infinite",
                }}
              />
            </motion.div>

            {/* ── FLOATING CHIP: Middle-left (Live rating) ── */}
            <motion.div
              initial={{ opacity: 0, x: shouldReduce ? 0 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: EASE, delay: 1.1 }}
              className="absolute bottom-32 -left-3 md:-left-8 hidden lg:flex items-center gap-2.5 px-3.5 py-2 rounded-full z-30"
              style={{
                backgroundColor: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 12px 32px -8px rgba(0,0,0,0.4)",
                transform: disable3D ? "none" : "translateZ(40px)",
              }}
            >
              <span className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b">
                    <path d="M12 2 L14.85 8.6 L22 9.3 L16.5 14.3 L18.2 21.2 L12 17.5 L5.8 21.2 L7.5 14.3 L2 9.3 L9.15 8.6 Z" />
                  </svg>
                ))}
              </span>
              <span className="text-[11px] font-extrabold" style={{ color: "#1a3a28" }}>
                Beta
              </span>
              <span className="text-[10px]" style={{ color: "#3d5e51" }}>
                erken erişim
              </span>
            </motion.div>
          </div>
        </motion.div>

        {/* ── RIGHT: Text + CTA ── */}
        <div className="relative p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center">
          {/* Subtle dot grid */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Soft glow */}
          <div
            aria-hidden
            className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none"
            style={{ backgroundColor: "#0d9668", opacity: 0.12 }}
          />

          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            className="relative"
          >
            <p
              className="text-xs font-extrabold tracking-[0.18em] uppercase mb-4"
              style={{ color: "#6dba92" }}
            >
              — Tek Sözleşme, Tüm Operasyon
            </p>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-[1.05] mb-4 sm:mb-5"
              style={{ letterSpacing: "-0.025em" }}
            >
              Eğitimden uyuma,
              <br />
              <span style={{ color: "var(--brand-600)" }}>tek panelden yönetin.</span>
            </h2>
            <p
              className="text-[15px] leading-relaxed mb-8 max-w-[460px]"
              style={{ color: "#a7f3d0" }}
            >
              Atama, video izleme, sınav, sertifika doğrulama ve raporlama —
              sağlık kurumunuzun eğitim döngüsü tek platformda, gerçek zamanlı.
            </p>

            {/* Feature bullets */}
            <ul className="space-y-2.5 mb-8">
              {[
                "Multi-tenant izolasyon — her kurum kendi alanında",
                "KVKK uyumlu altyapı, RLS ile satır seviyesinde güvenlik",
                "QR doğrulamalı sertifika, denetime hazır audit log",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] leading-snug"
                  style={{ color: "#a7f3d0" }}
                >
                  <CheckCircle
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    style={{ color: "var(--brand-600)" }}
                    strokeWidth={2.5}
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 px-7 h-12 sm:h-auto sm:py-3.5 rounded-full text-sm font-bold uppercase tracking-[0.12em] transition-transform hover:scale-105"
                style={{
                  backgroundColor: "#f59e0b",
                  color: "#1a3a28",
                  boxShadow: "0 12px 32px rgba(245,158,11,0.35)",
                }}
              >
                Demo Talep Et <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </Link>
              <Link
                href="#sss"
                className="inline-flex items-center justify-center sm:justify-start gap-2 text-xs font-bold tracking-[0.14em] uppercase transition-opacity hover:opacity-70 h-12 sm:h-auto"
                style={{ color: "#a7f3d0" }}
              >
                Sıkça Sorulanlar
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <style>{`
        @keyframes ctaPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </section>
  );
}
