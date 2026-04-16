"use client";

import Link from "next/link";
import { BookOpen, Award, Users, ArrowRight, CheckCircle } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

export function CtaSection() {
  return (
    <section id="guvenlik" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div
        className="rounded-3xl overflow-hidden grid md:grid-cols-2 relative"
        style={{ backgroundColor: "#1a3a28" }}
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Glow accent */}
        <div
          className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ backgroundColor: "var(--brand-600)" }}
        />

        {/* Left stats grid */}
        <div className="relative grid grid-cols-2 gap-2 sm:gap-3 p-4 sm:p-6">
          {[
            { label: "Toplam Eğitim", num: 120, prefix: "", suffix: "+", icon: BookOpen,    bar: 80, color: "var(--brand-600)" },
            { label: "Tamamlanma",    num: 94,  prefix: "%", suffix: "", icon: CheckCircle, bar: 94, color: "#4ade80" },
            { label: "Sertifika",     num: 850, prefix: "", suffix: "+", icon: Award,       bar: 70, color: "#f59e0b" },
            { label: "Kullanıcı",     num: 500, prefix: "", suffix: "+", icon: Users,       bar: 60, color: "var(--brand-600)" },
          ].map(({ label, num, prefix, suffix, icon: Icon, bar, color }, i) => (
            <div
              key={label}
              className="rounded-2xl p-3 sm:p-5 flex flex-col gap-0 relative overflow-hidden border"
              style={{
                backgroundColor: "#0d2818",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              {/* Icon */}
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${color}22`,
                    boxShadow: `0 0 16px ${color}33`,
                  }}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
                </div>
                <span
                  className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {bar}%
                </span>
              </div>

              {/* Value */}
              <p className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none mb-1">
                {prefix}
                <NumberTicker value={num} delay={i * 0.12} className="text-xl sm:text-2xl font-black text-white" />
                {suffix}
              </p>
              <p className="text-[11px] sm:text-xs mb-2 sm:mb-4" style={{ color: "#6dba92" }}>{label}</p>

              {/* Progress bar */}
              <div
                className="w-full h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${bar}%`, backgroundColor: color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Right text */}
        <div className="relative p-5 sm:p-10 flex flex-col justify-center">
          <p
            className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: "var(--brand-600)" }}
          >
            İhtiyacınız Olan Her Şey
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-5 sm:mb-6">
            Sağlıklı Personel,
            <br />
            <span style={{ color: "var(--brand-600)" }}>Güçlü Hastane.</span>
          </h2>
          <p className="text-sm leading-relaxed mb-5 sm:mb-8" style={{ color: "#6dba92" }}>
            Video eğitimden sertifikaya, raporlamadan bildirimlere — tüm
            eğitim altyapısı tek platformda.
          </p>

          {/* Feature bullets */}
          <ul className="space-y-2.5 mb-5 sm:mb-8">
            {[
              "7/24 kesintisiz erişim",
              "KVKK & GDPR uyumlu güvenli altyapı",
              "Otomatik sertifika & QR doğrulama",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "#a0d4b8" }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand-600)" }} />
                {item}
              </li>
            ))}
          </ul>

          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 w-fit px-7 py-3.5 rounded-full text-sm font-black uppercase tracking-wide transition-transform hover:scale-105"
            style={{
              backgroundColor: "#f59e0b",
              color: "#1a3a28",
              boxShadow: "0 8px 24px rgba(245,158,11,0.3)",
            }}
          >
            Hemen Başlayın <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
