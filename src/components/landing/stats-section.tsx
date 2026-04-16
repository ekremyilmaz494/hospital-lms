"use client";

import Link from "next/link";
import { ArrowRight, Clock, Users, Award, GraduationCap } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

export function StatsSection() {
  return (
    <>
      {/* ── STATS BAR ── */}
      <section id="hakkinda" style={{ backgroundColor: "#1a3a28" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-2 md:grid-cols-4">
          {[
            { prefix: "",   num: 500, suffix: "+", label: "Aktif Personel" },
            { prefix: "",   num: 120, suffix: "+", label: "Eğitim Modülü" },
            { prefix: "%",  num: 94,  suffix: "",  label: "Tamamlanma Oranı" },
            { prefix: "7/", num: 24,  suffix: "",  label: "Kesintisiz Erişim" },
          ].map(({ prefix, num, suffix, label }, i) => (
            <div
              key={label}
              className="text-center py-2 px-3 sm:px-4 border-b md:border-b-0 border-r border-white/10 last:border-r-0 nth-2:border-r-0 md:nth-2:border-r nth-3:border-b-0 nth-4:border-b-0"
            >
              <p className="text-3xl font-black text-white tabular-nums">
                {prefix}
                <NumberTicker
                  value={num}
                  delay={i * 0.15}
                  className="text-3xl font-black text-white"
                />
                {suffix}
              </p>
              <p className="text-sm mt-1" style={{ color: "#6dba92" }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED TRAININGS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-10 gap-3">
          <div>
            <p
              className="text-xs font-bold tracking-widest uppercase mb-2"
              style={{ color: "var(--brand-600)" }}
            >
              Öne Çıkanlar
            </p>
            <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1a3a28" }}>
              Bu Hafta Önerilen Eğitimler
            </h2>
          </div>
          <Link
            href="/auth/login"
            className="hidden md:flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-60"
            style={{ color: "var(--brand-600)" }}
          >
            Tümünü Gör <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div
            className="relative rounded-3xl p-5 sm:p-8 overflow-hidden group"
            style={{ backgroundColor: "#1a3a28" }}
          >
            <div
              className="absolute -top-8 -right-8 w-44 h-44 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
              style={{ backgroundColor: "var(--brand-600)" }}
            />
            <div
              className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5"
              style={{ backgroundColor: "#4ade80" }}
            />
            <div className="relative">
              <span
                className="inline-block text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full mb-5"
                style={{ backgroundColor: "var(--brand-600)", color: "white" }}
              >
                Zorunlu Eğitim
              </span>
              <h3 className="text-2xl font-black text-white mb-2">
                Hijyen & Enfeksiyon Kontrolü
              </h3>
              <p
                className="text-sm leading-relaxed mb-6"
                style={{ color: "#6dba92" }}
              >
                Hastane ortamında enfeksiyonun önlenmesi için kritik protokoller
                ve uygulamalı prosedürler.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: "#4ade80" }}
                  >
                    <Clock className="w-4 h-4" />
                    <span>2 saat</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: "#4ade80" }}
                  >
                    <Users className="w-4 h-4" />
                    <span>342 kişi</span>
                  </div>
                </div>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-transform hover:scale-105 w-full sm:w-auto justify-center"
                  style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
                >
                  <GraduationCap className="w-4 h-4" /> Başla
                </Link>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div
            className="relative rounded-3xl overflow-hidden group"
            style={{ backgroundColor: "#0d2818" }}
          >
            <div
              className="absolute -bottom-12 -right-12 w-56 h-56 rounded-full opacity-20 group-hover:opacity-30 transition-opacity"
              style={{ backgroundColor: "var(--brand-600)" }}
            />
            {/* Rating badge */}
            <div
              className="absolute top-5 right-5 w-[58px] h-[58px] rounded-full flex flex-col items-center justify-center text-center z-10"
              style={{
                backgroundColor: "#f59e0b",
                color: "#1a3a28",
                boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
              }}
            >
              <span className="text-base font-black leading-none">4.9</span>
              <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5">puan</span>
            </div>
            <div className="relative p-5 sm:p-8">
              <span
                className="inline-block text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full border mb-5"
                style={{ color: "var(--brand-600)", borderColor: "var(--brand-600)" }}
              >
                Acil Tıp
              </span>
              <h3 className="text-2xl font-black text-white mb-2">
                Acil Durum Müdahale & CPR
              </h3>
              <p
                className="text-sm leading-relaxed mb-6"
                style={{ color: "#6dba92" }}
              >
                Hayat kurtaran acil müdahale teknikleri, CPR ve temel yaşam
                desteği protokolleri. Sertifika dahil.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: "#4ade80" }}
                  >
                    <Clock className="w-4 h-4" />
                    <span>4 saat</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: "#4ade80" }}
                  >
                    <Award className="w-4 h-4" />
                    <span>Sertifikalı</span>
                  </div>
                </div>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-transform hover:scale-105 w-full sm:w-auto justify-center"
                  style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
                >
                  <GraduationCap className="w-4 h-4" /> Başla
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
