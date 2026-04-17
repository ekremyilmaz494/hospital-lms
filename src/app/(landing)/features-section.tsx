"use client";

import { useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  BarChart3,
  Shield,
  Award,
  Bell,
  ClipboardList,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import {
  VideoTrainingIllustration,
  ExamIllustration,
  ReportsIllustration,
  CertificatesIllustration,
  NotificationsIllustration,
  SecurityIllustration,
} from "@/components/landing/category-illustrations";

type CategoryKey =
  | "video"
  | "exam"
  | "reports"
  | "certificates"
  | "notifications"
  | "security";

type Feature = { title: string; desc: string };

type Category = {
  key: CategoryKey;
  label: string;
  Icon: LucideIcon;
  Illustration: React.ComponentType<{ className?: string }>;
  accent: string;
  ink: string;
  dim: string;
  bg: string;
  tagline: string;
  summary: string;
  features: Feature[];
};

const CATEGORIES: Category[] = [
  {
    key: "video",
    label: "Video Eğitimler",
    Icon: BookOpen,
    Illustration: VideoTrainingIllustration,
    accent: "#0d9668",
    ink: "#ffffff",
    dim: "#a7f3d0",
    bg: "linear-gradient(135deg, #1a3a28 0%, #0d2010 100%)",
    tagline: "Kaliteli akış, gerçek izleme.",
    summary:
      "AWS CloudFront üzerinden 1080p akış. İleri sarma koruması ve frame-level izleme süresi takibi.",
    features: [
      { title: "Yüksek Kaliteli Akış", desc: "CloudFront CDN, 1080p'ye kadar destek." },
      { title: "İleri Sarma Koruması", desc: "Atlama engelli, gerçek izleme kaydı." },
      { title: "Çoklu Format", desc: "MP4, WebM ve SCORM desteği." },
    ],
  },
  {
    key: "exam",
    label: "Sınav Sistemi",
    Icon: ClipboardList,
    Illustration: ExamIllustration,
    accent: "#0d9668",
    ink: "#1a3a28",
    dim: "#4a7060",
    bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    tagline: "Kopya yok, değerlendirme anında.",
    summary:
      "Çoktan seçmeli soru bankası. Timer'lı oturumlar, rastgele seçim ve anlık skor.",
    features: [
      { title: "Otomatik Sınav", desc: "Video bitince otomatik başlar." },
      { title: "Soru Bankası", desc: "Kategorize havuz, rastgele seçim." },
      { title: "Yeniden Deneme", desc: "Bekleme süresi ve hak sayısı yapılandırılabilir." },
    ],
  },
  {
    key: "reports",
    label: "Raporlama",
    Icon: BarChart3,
    Illustration: ReportsIllustration,
    accent: "#b45309",
    ink: "#1a3a28",
    dim: "#78350f",
    bg: "linear-gradient(135deg, #fffaf0 0%, #fde68a 100%)",
    tagline: "Canlı dashboard, net kırılım.",
    summary:
      "Departman ve personel bazında anlık performans. Excel/PDF export ve trend grafikleri.",
    features: [
      { title: "Gerçek Zamanlı Dashboard", desc: "Recharts tabanlı canlı grafikler." },
      { title: "Excel / PDF Export", desc: "Tek tıkla format düzenli çıktı." },
      { title: "Uyumluluk Takibi", desc: "Zorunlu eğitimlerin tamamlanma oranı." },
    ],
  },
  {
    key: "certificates",
    label: "Sertifikalar",
    Icon: Award,
    Illustration: CertificatesIllustration,
    accent: "#b45309",
    ink: "#1a3a28",
    dim: "#4a7060",
    bg: "linear-gradient(135deg, #fffdf6 0%, #fef3c7 100%)",
    tagline: "QR doğrulamalı, KVKK onaylı.",
    summary:
      "Başarılı sonuç sonrası otomatik üretim. E-posta ile teslim, benzersiz QR kod doğrulaması.",
    features: [
      { title: "Otomatik Sertifika", desc: "Sınav bitince anında üretilir." },
      { title: "QR Doğrulama", desc: "Her sertifikada benzersiz QR kod." },
      { title: "Geçerlilik Takibi", desc: "Süre sonu bildirimi ve yenileme hatırlatması." },
    ],
  },
  {
    key: "notifications",
    label: "Bildirimler",
    Icon: Bell,
    Illustration: NotificationsIllustration,
    accent: "#ffffff",
    ink: "#ffffff",
    dim: "#a7f3d0",
    bg: "linear-gradient(135deg, #0d9668 0%, #065f46 100%)",
    tagline: "Realtime push, zamanında ulaşım.",
    summary:
      "Platform içi anlık bildirimler, SMTP e-posta ve son teslim tarihine özel hatırlatıcılar.",
    features: [
      { title: "Gerçek Zamanlı", desc: "Supabase Realtime ile anlık push." },
      { title: "E-posta Bildirimleri", desc: "SMTP üzerinden atama ve sonuç mail'i." },
      { title: "Hatırlatıcılar", desc: "Son tarihe yaklaşanlar için otomatik." },
    ],
  },
  {
    key: "security",
    label: "Güvenlik",
    Icon: Shield,
    Illustration: SecurityIllustration,
    accent: "#f59e0b",
    ink: "#ffffff",
    dim: "#a7f3d0",
    bg: "linear-gradient(135deg, #0d2010 0%, #1a3a28 100%)",
    tagline: "KVKK uyumlu, RLS korumalı.",
    summary:
      "KVKK ve GDPR uyumlu veri işleme. Supabase RLS tüm tablolarda, role-based erişim.",
    features: [
      { title: "KVKK Uyumlu", desc: "Kişisel veriler şifreli saklanır." },
      { title: "Rol Tabanlı Erişim", desc: "Super Admin, Admin, Personel rolleri." },
      { title: "Denetim Kayıtları", desc: "Yasal denetim için audit log sistemi." },
    ],
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function FeaturesSection() {
  const [active, setActive] = useState<CategoryKey>("video");
  const shouldReduce = useReducedMotion();
  const current = CATEGORIES.find((c) => c.key === active)!;
  const idx = CATEGORIES.findIndex((c) => c.key === active);

  const panelRef = useRef<HTMLDivElement>(null);
  const handleSelect = (key: CategoryKey) => {
    setActive(key);
    // On narrow viewports the panel sits below the rail — scroll it into view.
    if (typeof window === "undefined") return;
    const isWide = window.matchMedia("(min-width: 768px)").matches;
    if (isWide) return;
    // Defer until state-driven content swap has mounted
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: shouldReduce ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const iconOnAccent =
    current.accent === "#ffffff" || current.accent === "#f59e0b" ? current.ink : current.accent;

  return (
    <section
      id="ozellikler"
      className="relative py-14 sm:py-20 md:py-24 overflow-hidden"
      style={{ backgroundColor: "#ece7d7" }}
      aria-label="Platform özellikleri"
    >
      {/* Ambient blob */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-10%",
          right: "-5%",
          width: 600,
          height: 600,
          borderRadius: "55% 45% 40% 60%",
          background: "radial-gradient(circle, rgba(13,150,104,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 sm:gap-6 mb-8 sm:mb-12"
        >
          <div>
            <p
              className="text-[10px] sm:text-xs font-black tracking-[0.22em] uppercase mb-3"
              style={{ color: "var(--brand-600)" }}
            >
              Platform Özellikleri
            </p>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl xl:text-[2.75rem] font-black leading-[1.05] tracking-tight"
              style={{ color: "#1a3a28", maxWidth: 720 }}
            >
              Neden Devakent?{" "}
              <span style={{ color: "var(--brand-600)" }}>Altı yüzü, bir arada.</span>
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed max-w-[500px]" style={{ color: "#4a7060" }}>
              Personel eğitiminin yaşam döngüsü — atama, izleme, sınav, sertifika,
              bildirim, güvenlik — hepsini tek platform üstlenir.
            </p>
          </div>

          <div
            className="flex items-center gap-2 text-[11px] font-black tracking-[0.2em] uppercase"
            style={{ color: "#4a7060" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--brand-600)" }}
            />
            Bir kategoriye tıkla
          </div>
        </motion.div>

        {/* Main grid — rail + panel side-by-side from md breakpoint up */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-5 md:gap-6 xl:gap-8 items-start">
          {/* ── LEFT: Category rail ── */}
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:sticky md:top-24 md:self-start -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 no-scrollbar">
            {CATEGORIES.map((cat, i) => {
              const isActive = active === cat.key;
              const Icon = cat.Icon;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleSelect(cat.key)}
                  aria-pressed={isActive}
                  className="group relative flex items-center gap-2.5 px-3.5 py-3 min-h-11 rounded-2xl text-left cursor-pointer whitespace-nowrap md:whitespace-normal flex-shrink-0 transition-colors"
                  style={{
                    backgroundColor: isActive ? "#1a3a28" : "rgba(255,255,255,0.6)",
                    border: `1px solid ${isActive ? "#1a3a28" : "rgba(26,58,40,0.08)"}`,
                    color: isActive ? "#f5f0e6" : "#1a3a28",
                    boxShadow: isActive
                      ? "0 12px 28px -10px rgba(26,58,40,0.45)"
                      : "0 2px 8px -4px rgba(26,58,40,0.1)",
                  }}
                >
                  {/* Number */}
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black font-mono"
                    style={{
                      backgroundColor: isActive ? "rgba(245,240,230,0.15)" : "rgba(26,58,40,0.05)",
                      color: isActive ? "#a7f3d0" : "#4a7060",
                    }}
                  >
                    0{i + 1}
                  </span>

                  {/* Icon + label */}
                  <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: isActive ? "#a7f3d0" : "#4a7060" }}
                    strokeWidth={2.2}
                  />
                  <span className="text-sm font-black flex-1">{cat.label}</span>

                  {/* Arrow indicator */}
                  <ArrowRight
                    className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                    style={{
                      color: isActive ? "#a7f3d0" : "transparent",
                      transform: isActive ? "translateX(0)" : "translateX(-6px)",
                    }}
                    strokeWidth={2.5}
                  />
                </button>
              );
            })}
          </div>

          {/* ── RIGHT: Showcase panel ── */}
          <div
            ref={panelRef}
            className="relative rounded-3xl overflow-hidden md:min-h-[460px] lg:min-h-[480px] scroll-mt-24"
            style={{
              background: current.bg,
              boxShadow: "0 30px 60px -20px rgba(26,58,40,0.3), 0 0 0 1px rgba(26,58,40,0.05)",
              transition: "background 0.6s ease",
            }}
          >
            {/* Decorative glows */}
            <div
              aria-hidden
              className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
              style={{
                backgroundColor: current.accent === "#ffffff" ? "#f59e0b" : current.accent,
                opacity: 0.15,
                filter: "blur(60px)",
                transition: "background-color 0.6s ease",
              }}
            />
            <div
              aria-hidden
              className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full pointer-events-none"
              style={{
                backgroundColor: "#0d9668",
                opacity: 0.1,
                filter: "blur(50px)",
              }}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={current.key}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduce ? 0 : -10 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="relative h-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 p-5 sm:p-7 md:p-8 lg:p-10"
              >
                {/* Left side: text content */}
                <div className="flex flex-col">
                  {/* Top meta */}
                  <div className="flex items-center justify-between mb-5 sm:mb-7">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-[10px] font-black tracking-[0.22em] font-mono"
                        style={{ color: current.dim }}
                      >
                        0{idx + 1} / 0{CATEGORIES.length}
                      </span>
                      <div className="h-px w-12" style={{ backgroundColor: current.dim, opacity: 0.4 }} />
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor:
                          current.accent === "#ffffff"
                            ? "rgba(255,255,255,0.15)"
                            : `${current.accent}22`,
                        border: `1px solid ${
                          current.accent === "#ffffff"
                            ? "rgba(255,255,255,0.3)"
                            : `${current.accent}55`
                        }`,
                      }}
                    >
                      <current.Icon className="w-5 h-5" style={{ color: iconOnAccent }} strokeWidth={2} />
                    </div>
                  </div>

                  {/* Title block */}
                  <p
                    className="text-[10px] font-black tracking-[0.22em] uppercase mb-2"
                    style={{ color: current.dim }}
                  >
                    {current.label}
                  </p>
                  <h3
                    className="text-xl sm:text-2xl md:text-3xl font-black leading-[1.1] tracking-tight mb-3"
                    style={{ color: current.ink }}
                  >
                    {current.tagline}
                  </h3>
                  <p
                    className="text-sm md:text-base leading-relaxed mb-6 sm:mb-8 max-w-[420px]"
                    style={{ color: current.dim }}
                  >
                    {current.summary}
                  </p>

                  {/* Feature bullets */}
                  <div className="space-y-3.5 sm:space-y-4 mb-6 sm:mb-8 flex-1">
                    {current.features.map((f, i) => (
                      <motion.div
                        key={f.title}
                        initial={{ opacity: 0, x: shouldReduce ? 0 : -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.08 }}
                        className="flex items-start gap-3"
                      >
                        <div
                          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] font-mono mt-0.5"
                          style={{
                            backgroundColor:
                              current.accent === "#ffffff"
                                ? "rgba(255,255,255,0.15)"
                                : `${current.accent}22`,
                            color: iconOnAccent,
                            border: `1px solid ${
                              current.accent === "#ffffff"
                                ? "rgba(255,255,255,0.3)"
                                : `${current.accent}55`
                            }`,
                          }}
                        >
                          0{i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black mb-1" style={{ color: current.ink }}>
                            {f.title}
                          </p>
                          <p className="text-[13px] leading-snug" style={{ color: current.dim }}>
                            {f.desc}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="mt-auto">
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.15em] uppercase group"
                      style={{ color: iconOnAccent }}
                    >
                      Detayları Gör
                      <ArrowRight
                        className="w-4 h-4 transition-transform group-hover:translate-x-1"
                        strokeWidth={2.5}
                      />
                    </Link>
                  </div>
                </div>

                {/* Right side: illustration */}
                <div className="relative flex items-center justify-center min-h-[200px] sm:min-h-[240px] md:min-h-[360px]">
                  <motion.div
                    key={`ill-${current.key}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
                    className="w-full max-w-[420px]"
                  >
                    <current.Illustration className="w-full h-auto" />
                  </motion.div>

                  {/* Live badge */}
                  <div
                    className="absolute top-0 right-0 px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.22em] uppercase"
                    style={{
                      backgroundColor: iconOnAccent,
                      color:
                        iconOnAccent === "#ffffff" || iconOnAccent === "#f59e0b"
                          ? "#1a3a28"
                          : "#ffffff",
                    }}
                  >
                    ● Canlı
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
