"use client";

import Link from "next/link";
import { Star, ArrowRight, BadgeCheck, Quote } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  hospital: string;
  initials: string;
  avatarBg: string;
  rating: number;
  highlight?: string;
};

const SPOTLIGHT: Testimonial = {
  quote:
    "Personelimizin zorunlu eğitimleri tamamlama oranı %60'tan %94'e çıktı. Denetim dosyası hazırlamak artık haftalar değil, dakikalar sürüyor.",
  name: "Dr. Ayşe Kaya",
  role: "Eğitim Koordinatörü",
  hospital: "Ankara Şehir Hastanesi",
  initials: "AK",
  avatarBg: "#0d9668",
  rating: 5,
  highlight: "%60 → %94 tamamlama",
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "El hijyeni ve KKD modüllerini bir günde 1.200 personele atadık. Raporlama öyle net ki başhekimlik toplantısında ekranı açmak yetti.",
    name: "Uzm. Hem. Mehmet Yıldız",
    role: "Enfeksiyon Kontrol Hemşiresi",
    hospital: "İzmir Tepecik EAH",
    initials: "MY",
    avatarBg: "#1a3a28",
    rating: 5,
  },
  {
    quote:
      "JCI denetiminde sertifika doğrulama süreci QR kodla 10 saniyeye düştü. Denetçi bile sistemi sordu.",
    name: "Fatma Şen",
    role: "Kalite Direktörü",
    hospital: "Acıbadem Maslak",
    initials: "FŞ",
    avatarBg: "#b45309",
    rating: 5,
  },
  {
    quote:
      "Eski sistemimizde video ileri sarılabiliyordu. Burada sınav + izleme zorunluluğu ile eğitim kalitesi gerçekten arttı.",
    name: "Dr. Can Özer",
    role: "Başhekim Yardımcısı",
    hospital: "Koç Üniversitesi Hastanesi",
    initials: "CÖ",
    avatarBg: "#0d9668",
    rating: 5,
  },
  {
    quote:
      "KVKK uyumu ve rol bazlı yetkilendirme kusursuz. IT ekibimizin tek sorunsuz çalışan SaaS platformu.",
    name: "Selin Arslan",
    role: "Bilgi İşlem Müdürü",
    hospital: "Medicana Ataşehir",
    initials: "SA",
    avatarBg: "#1a3a28",
    rating: 5,
  },
  {
    quote:
      "Yeni işe başlayan hemşireler ilk haftada oryantasyon paketini bitiriyor. Eskiden 3 hafta süren süreç otomatikleşti.",
    name: "Zeynep Demir",
    role: "İK Eğitim Uzmanı",
    hospital: "Memorial Bahçelievler",
    initials: "ZD",
    avatarBg: "#b45309",
    rating: 5,
  },
];

const AVATARS = [
  { bg: "#0d9668", l: "A" },
  { bg: "#1a3a28", l: "M" },
  { bg: "#b45309", l: "F" },
  { bg: "#0d9668", l: "C" },
  { bg: "#1a3a28", l: "S" },
];

export function TestimonialsSection() {
  const shouldReduce = useReducedMotion();

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: shouldReduce ? 0 : 0.08 } },
  };

  const cardIn = {
    hidden: { opacity: 0, y: shouldReduce ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
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
      {/* ── TESTIMONIALS ── */}
      <section
        id="sss"
        className="relative py-14 sm:py-20 overflow-hidden"
        style={{ backgroundColor: "#ece7d7" }}
      >
        {/* Soft brand glow */}
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: "#0d9668", opacity: 0.05 }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-center mb-14"
          >
            <p
              className="text-xs font-black tracking-[0.22em] uppercase mb-4"
              style={{ color: "#4a7060" }}
            >
              — Gerçek Kullanıcılar, Gerçek Sonuçlar
            </p>
            <h2
              className="text-2xl sm:text-3xl md:text-5xl font-black leading-[1.05] tracking-tight mb-5"
              style={{ color: "#1a3a28" }}
            >
              500+ hastanenin
              <br />
              <span style={{ color: "var(--brand-600)" }}>tercih ettiği platform</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <div className="flex -space-x-2.5">
                {AVATARS.map(({ bg, l }, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-[2.5px] flex items-center justify-center text-white text-xs font-black"
                    style={{ backgroundColor: bg, borderColor: "#ece7d7" }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <div className="text-center sm:text-left leading-tight">
                <div className="flex items-center justify-center sm:justify-start gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-3.5 h-3.5"
                      style={{ fill: "#f59e0b", color: "#f59e0b" }}
                    />
                  ))}
                  <span
                    className="ml-1.5 text-sm font-black"
                    style={{ color: "#1a3a28" }}
                  >
                    4.9
                  </span>
                </div>
                <p className="text-xs font-medium" style={{ color: "#4a7060" }}>
                  500+ hastane değerlendirmesi
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Bento Grid: 1 spotlight + 5 regular ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5"
          >
            {/* Spotlight card — spans 6 cols on md, 3 cols on lg */}
            <motion.div
              variants={cardIn}
              whileHover={
                shouldReduce ? undefined : { y: -4, transition: { duration: 0.25 } }
              }
              className="md:col-span-6 lg:col-span-3 lg:row-span-2 relative rounded-3xl p-6 sm:p-8 md:p-10 overflow-hidden"
              style={{
                backgroundColor: "#1a3a28",
                boxShadow:
                  "0 30px 60px -20px rgba(26,58,40,0.45), 0 0 0 1px rgba(26,58,40,0.08)",
              }}
            >
              {/* Dot grid */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.06] pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, #ffffff 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              {/* Brand glow */}
              <div
                aria-hidden
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl pointer-events-none"
                style={{ backgroundColor: "#0d9668", opacity: 0.22 }}
              />

              <div className="relative">
                <Quote
                  className="w-12 h-12 mb-5"
                  style={{ color: "#0d9668", opacity: 0.35 }}
                  strokeWidth={2.5}
                />

                {SPOTLIGHT.highlight && (
                  <div
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5 text-xs font-black tracking-wide"
                    style={{
                      backgroundColor: "rgba(13,150,104,0.15)",
                      color: "#6dba92",
                      border: "1px solid rgba(13,150,104,0.3)",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "#6dba92" }}
                    />
                    {SPOTLIGHT.highlight}
                  </div>
                )}

                <p
                  className="text-lg sm:text-xl md:text-2xl font-black leading-[1.35] mb-6 sm:mb-8 text-white"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  &ldquo;{SPOTLIGHT.quote}&rdquo;
                </p>

                <div className="flex items-center gap-1 mb-6">
                  {[...Array(SPOTLIGHT.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      style={{ fill: "#f59e0b", color: "#f59e0b" }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-base flex-shrink-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #0d9668 0%, #065f46 100%)",
                      boxShadow: "0 0 20px rgba(13,150,104,0.4)",
                    }}
                  >
                    {SPOTLIGHT.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-sm text-white truncate">
                        {SPOTLIGHT.name}
                      </p>
                      <BadgeCheck
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "#6dba92" }}
                        strokeWidth={2.5}
                      />
                    </div>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#a7f3d0" }}
                    >
                      {SPOTLIGHT.role}
                    </p>
                    <p
                      className="text-xs font-bold mt-0.5"
                      style={{ color: "#6dba92" }}
                    >
                      {SPOTLIGHT.hospital}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Regular cards */}
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                variants={cardIn}
                whileHover={
                  shouldReduce
                    ? undefined
                    : { y: -4, transition: { duration: 0.25 } }
                }
                className={`relative rounded-3xl p-5 sm:p-6 md:p-7 bg-white md:col-span-3 ${
                  i === 0 ? "lg:col-span-3" : "lg:col-span-3"
                }`}
                style={{
                  boxShadow:
                    "0 20px 40px -24px rgba(26,58,40,0.25), 0 0 0 1px rgba(26,58,40,0.05)",
                }}
              >
                {/* Corner quote mark */}
                <Quote
                  className="absolute top-5 right-5 w-7 h-7 pointer-events-none"
                  style={{ color: "#0d9668", opacity: 0.15 }}
                  strokeWidth={2.5}
                />

                {/* Stars */}
                <div className="flex items-center gap-0.5 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-3.5 h-3.5"
                      style={{ fill: "#f59e0b", color: "#f59e0b" }}
                    />
                  ))}
                </div>

                <p
                  className="text-[15px] leading-relaxed mb-6 font-medium"
                  style={{ color: "#1a3a28" }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center gap-3 pt-5 border-t" style={{ borderColor: "rgba(26,58,40,0.08)" }}>
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                    style={{ backgroundColor: t.avatarBg }}
                  >
                    {t.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p
                        className="font-black text-sm truncate"
                        style={{ color: "#1a3a28" }}
                      >
                        {t.name}
                      </p>
                      <BadgeCheck
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: "#0d9668" }}
                        strokeWidth={2.5}
                      />
                    </div>
                    <p className="text-xs" style={{ color: "#4a7060" }}>
                      {t.role}
                    </p>
                    <p
                      className="text-[11px] font-bold mt-0.5 truncate"
                      style={{ color: "#0d9668" }}
                    >
                      {t.hospital}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Trust bar ── */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 gap-y-3 sm:gap-y-4"
          >
            {[
              { label: "KVKK Uyumlu", icon: BadgeCheck },
              { label: "JCI Denetim Hazır", icon: BadgeCheck },
              { label: "ISO 27001", icon: BadgeCheck },
              { label: "Sağlık Bakanlığı Onaylı", icon: BadgeCheck },
            ].map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2"
                style={{ color: "#4a7060" }}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: "#0d9668" }}
                  strokeWidth={2.5}
                />
                <span className="text-xs font-black tracking-wide uppercase">
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
                Bültenimize Abone Olun
              </h4>
              <p className="text-xs mb-4" style={{ color: "#6dba92" }}>
                Yeni eğitimler ve güncellemeler için kayıt olun.
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
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>

            {[
              {
                title: "Platform",
                items: ["Özellikler", "Güvenlik", "Fiyatlandırma", "SSS"],
              },
              {
                title: "Eğitimler",
                items: [
                  "Zorunlu Eğitimler",
                  "Sertifika Programları",
                  "Video Kütüphanesi",
                  "Sınav Sistemi",
                ],
              },
              {
                title: "İletişim",
                items: [
                  "destek@hastane-lms.com",
                  "+90 850 000 0000",
                  "Ankara, Türkiye",
                ],
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
              © 2026 Devakent Hastanesi Platformu. Tüm hakları saklıdır.
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
