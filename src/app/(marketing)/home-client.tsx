"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  ClipboardCheck,
  Award,
  ShieldCheck,
  Sparkles,
  Link2,
  BarChart3,
  Smartphone,
  ArrowRight,
  ChevronDown,
  CheckCircle,
  Play,
  Users,
  FileCheck,
  Zap,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                   */
/* ------------------------------------------------------------------ */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

/* ------------------------------------------------------------------ */
/*  HERO                                                                */
/* ------------------------------------------------------------------ */
function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(13,150,104,0.08), transparent)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full border mb-6"
              style={{ color: "#0d9668", borderColor: "rgba(13,150,104,0.3)", backgroundColor: "rgba(13,150,104,0.06)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#0d9668" }} />
              Saglik Sektorune Ozel
            </motion.span>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl lg:text-5xl xl:text-[3.5rem] font-black leading-[1.08] tracking-tight mb-6"
              style={{ color: "var(--color-text-primary)" }}
            >
              Hastane Personel
              <br />
              <span style={{ color: "#0d9668" }}>Egitim ve Sinav</span>
              <br />
              Yonetim Sistemi
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-base lg:text-lg leading-relaxed max-w-lg mb-8"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Video tabanli egitimler atayin, sinavlar duzenleyin, sertifikalari yonetin
              ve personelinizin gelisimini gercek zamanli takip edin.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-4 mb-10">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105"
                style={{
                  backgroundColor: "#0d9668",
                  boxShadow: "0 8px 24px rgba(13,150,104,0.3)",
                }}
              >
                Ucretsiz Deneyin <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/#nasil-calisir"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold border transition-colors hover:border-[#0d9668]"
                style={{
                  color: "var(--color-text-primary)",
                  borderColor: "var(--color-border)",
                }}
              >
                <Play className="w-4 h-4" style={{ color: "#0d9668" }} />
                Nasil Calisir?
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["A", "M", "S", "K"].map((letter, i) => (
                  <div
                    key={letter}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      backgroundColor: i % 2 === 0 ? "#0d9668" : "#065f46",
                      borderColor: "var(--color-bg)",
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                <strong style={{ color: "var(--color-text-primary)" }}>500+</strong> hastane tarafindan tercih ediliyor
              </p>
            </motion.div>
          </motion.div>

          {/* Visual — Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative hidden lg:block"
          >
            <div
              className="rounded-2xl p-6 border"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
              }}
            >
              {/* Mock header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    Dashboard
                  </p>
                  <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                    Ankara Sehir Hastanesi
                  </p>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: "rgba(13,150,104,0.1)", color: "#0d9668" }}
                >
                  Canli
                </div>
              </div>

              {/* Mock stat cards */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Aktif Egitim", value: "24", color: "#0d9668" },
                  { label: "Bu Ay Sinav", value: "156", color: "#f59e0b" },
                  { label: "Basari Orani", value: "%94", color: "#0d9668" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 border"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <p className="text-2xl font-black" style={{ color }}>{value}</p>
                    <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Mock progress items */}
              {[
                { name: "Hijyen Egitimi", progress: 92 },
                { name: "CPR & Ilk Yardim", progress: 78 },
                { name: "Hasta Guv. Protokolleri", progress: 65 },
              ].map(({ name, progress }) => (
                <div key={name} className="flex items-center gap-3 py-2.5">
                  <p className="text-sm font-medium flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
                    {name}
                  </p>
                  <div
                    className="w-24 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--color-border)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progress}%`, backgroundColor: "#0d9668" }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                    %{progress}
                  </span>
                </div>
              ))}
            </div>

            {/* Floating notification */}
            <div
              className="absolute -bottom-4 -left-4 rounded-xl px-4 py-3 border flex items-center gap-3"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
                <Award className="w-4 h-4" style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>Yeni Sertifika</p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Ayse K. - Hijyen Egitimi</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FEATURES                                                            */
/* ------------------------------------------------------------------ */
const FEATURES = [
  {
    icon: BookOpen,
    title: "Egitim Yonetimi",
    desc: "Video tabanli egitimler olusturun, departmanlara atayin. Ileri sarma kilidi ile gercek izleme garantisi.",
  },
  {
    icon: ClipboardCheck,
    title: "Sinav Sistemi",
    desc: "Otomatik sinav olusturma, soru bankasi, rastgele soru secimi ve yapilandirabilir yeniden deneme haklari.",
  },
  {
    icon: Award,
    title: "Sertifika Yonetimi",
    desc: "Basarili sinavlarda otomatik sertifika uretimi, QR dogrulama ve gecerlilik suresi takibi.",
  },
  {
    icon: ShieldCheck,
    title: "Akreditasyon Takibi",
    desc: "JCI ve ulusal akreditasyon standartlarina uyum takibi. Zorunlu egitimlerde otomatik hatirlatma.",
  },
  {
    icon: Sparkles,
    title: "AI Icerik Studyosu",
    desc: "Yapay zeka destekli soru uretimi, egitim ozetleri ve kisisellestirilmis ogrenme yollari.",
  },
  {
    icon: Link2,
    title: "HIS Entegrasyonu",
    desc: "Hastane Bilgi Sistemi ile entegrasyon. Personel verileri otomatik senkronizasyon.",
  },
  {
    icon: BarChart3,
    title: "Raporlama & Analiz",
    desc: "Departman bazli performans grafikleri, uyum raporlari. Excel ve PDF export destegi.",
  },
  {
    icon: Smartphone,
    title: "Mobil Uyumluluk",
    desc: "PWA destegi ile mobil cihazlardan egitimlere erisim. Offline mod ve push bildirimleri.",
  },
];

function FeaturesSection() {
  return (
    <section id="ozellikler" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p
            className="text-xs font-bold tracking-widest uppercase mb-3"
            style={{ color: "#0d9668" }}
          >
            Platform Ozellikleri
          </p>
          <h2 className="text-3xl lg:text-4xl font-black mb-4" style={{ color: "var(--color-text-primary)" }}>
            Egitim Yonetiminde Ihtiyaciniz Olan Her Sey
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Hastane personelinizin gelisimini uctan uca yonetin. Egitim atamadan sertifikaya, sinavdan rapora tek platform.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              custom={i}
              className="group rounded-2xl p-6 border transition-shadow hover:shadow-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: "rgba(13,150,104,0.08)" }}
              >
                <Icon className="w-5 h-5" style={{ color: "#0d9668" }} />
              </div>
              <h3 className="font-bold text-base mb-2" style={{ color: "var(--color-text-primary)" }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  HOW IT WORKS                                                        */
/* ------------------------------------------------------------------ */
const STEPS = [
  {
    num: "01",
    icon: BookOpen,
    title: "Egitimleri Olusturun",
    desc: "Video ve dokumanlarinizi yukleyin, sorularinizi hazirlayin. 4 adimli sihirbaz ile dakikalar icinde egitim modulleri olusturun.",
  },
  {
    num: "02",
    icon: Users,
    title: "Personele Atayin",
    desc: "Departman, unvan veya kisi bazinda egitim atamalari yapin. Son tarih ve hatirlatma ayarlari ile takip edin.",
  },
  {
    num: "03",
    icon: FileCheck,
    title: "Sonuclari Takip Edin",
    desc: "Gercek zamanli dashboard ile tamamlanma oranlarini, sinav sonuclarini ve sertifika durumlarini izleyin.",
  },
];

function HowItWorksSection() {
  return (
    <section
      id="nasil-calisir"
      className="py-20 lg:py-28"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#0d9668" }}>
            Basit Adimlar
          </p>
          <h2 className="text-3xl lg:text-4xl font-black mb-4" style={{ color: "var(--color-text-primary)" }}>
            Nasil Calisir?
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Uc basit adimda personelinizin egitim surecini dijitallestirin.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connection line */}
          <div
            className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          {STEPS.map(({ num, icon: Icon, title, desc }, i) => (
            <motion.div
              key={num}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              custom={i}
              className="relative text-center"
            >
              <div className="relative inline-flex mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10"
                  style={{
                    backgroundColor: "#0d9668",
                    boxShadow: "0 8px 24px rgba(13,150,104,0.25)",
                  }}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <span
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black z-20"
                  style={{ backgroundColor: "#f59e0b", color: "#0f172a" }}
                >
                  {num}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ color: "var(--color-text-primary)" }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  STATS                                                               */
/* ------------------------------------------------------------------ */
function StatsSection() {
  return (
    <section className="py-16" style={{ backgroundColor: "#0f172a" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 500, suffix: "+", label: "Hastane" },
            { value: 50000, suffix: "+", label: "Personel" },
            { value: 1, suffix: "M+", label: "Tamamlanan Sinav" },
            { value: 99.9, suffix: "%", label: "Uptime" },
          ].map(({ value, suffix, label }, i) => (
            <motion.div
              key={label}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
            >
              <p className="text-3xl lg:text-4xl font-black text-white tabular-nums mb-1">
                <NumberTicker value={value} delay={i * 0.15} className="text-3xl lg:text-4xl font-black text-white" />
                {suffix}
              </p>
              <p className="text-sm" style={{ color: "#94a3b8" }}>{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ                                                                 */
/* ------------------------------------------------------------------ */
const FAQ_ITEMS = [
  {
    q: "Hastane LMS nedir?",
    a: "Hastane LMS, hastane ve saglik kuruluslari icin ozel olarak gelistirilmis bir personel egitim ve sinav yonetim platformudur. Video tabanli egitimler, otomatik sinavlar, sertifika yonetimi ve akreditasyon takibi gibi ozellikler sunar.",
  },
  {
    q: "Kurulum icin teknik altyapi gerekli mi?",
    a: "Hayir. Hastane LMS tamamen bulut tabanli (SaaS) bir platformdur. Herhangi bir sunucu kurulumu veya yazilim yuklenmesi gerektirmez. Web tarayicinizdan veya mobil cihazinizdan erisebilirsiniz.",
  },
  {
    q: "Mevcut HIS (Hastane Bilgi Sistemi) ile entegre olabiliyor mu?",
    a: "Evet. API tabanli entegrasyon ile mevcut HIS sisteminizden personel verilerini otomatik olarak senkronize edebilirsiniz. LDAP/Active Directory destegi de mevcuttur.",
  },
  {
    q: "KVKK ve veri guvenligi standartlarina uyumlu mu?",
    a: "Kesinlikle. Tum veriler Turkiye'deki sunucularda saklanir, uctan uca sifreleme kullanilir. KVKK, GDPR ve ISO 27001 standartlarina tam uyumluyuz. Row Level Security (RLS) ile multi-tenant veri izolasyonu saglanir.",
  },
  {
    q: "Kac personel kullanabilir?",
    a: "Baslangic paketi 100 personele kadar, Profesyonel paketi 500 personele kadar destekler. Kurumsal pakette personel siniri yoktur. Ihtiyaciniza gore olceklenir.",
  },
  {
    q: "Ucretsiz deneme suresi var mi?",
    a: "Evet, 14 gunluk ucretsiz deneme suresi sunuyoruz. Kredi karti bilgisi gerekmez. Deneme sureniz boyunca tum ozelliklere erisebilirsiniz.",
  },
  {
    q: "Sinav sistemi nasil calisiyor?",
    a: "Egitim tamamlandiktan sonra sinav otomatik olarak baslar. Soru bankasi, rastgele soru secimi, sure sinirlamasi ve yapilandirabilir yeniden deneme haklari mevcuttur. Sonuclar aninda raporlanir.",
  },
  {
    q: "Sertifikalar nasil dogrulanir?",
    a: "Her sertifikada benzersiz bir QR kod bulunur. Ucuncu taraflar (akreditasyon kurumlari, diger hastaneler) bu QR kodu tarayarak sertifikanin gecerliligini dogrulayabilir.",
  },
  {
    q: "Mobil cihazlardan erisilebilir mi?",
    a: "Evet. PWA (Progressive Web App) destegi ile hem iOS hem Android cihazlardan uygulamayi yukleyebilirsiniz. Offline mod sayesinde internet baglantisi olmadan da egitimlere devam edebilirsiniz.",
  },
  {
    q: "Teknik destek nasil saglanir?",
    a: "Tum paketlerde e-posta destegi mevcuttur. Profesyonel ve Kurumsal paketlerde oncelikli destek, Kurumsal pakette ise 7/24 telefon ve ozel hesap yoneticisi destegi sunulur.",
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="sss" className="py-20 lg:py-28" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#0d9668" }}>
            Sikca Sorulan Sorular
          </p>
          <h2 className="text-3xl lg:text-4xl font-black" style={{ color: "var(--color-text-primary)" }}>
            Merak Edilenler
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map(({ q, a }, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="rounded-2xl border overflow-hidden transition-colors"
                style={{
                  borderColor: isOpen ? "rgba(13,150,104,0.3)" : "var(--color-border)",
                  backgroundColor: isOpen ? "rgba(13,150,104,0.02)" : "transparent",
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer"
                >
                  <span className="text-sm font-semibold pr-4" style={{ color: "var(--color-text-primary)" }}>
                    {q}
                  </span>
                  <ChevronDown
                    className="w-5 h-5 flex-shrink-0 transition-transform"
                    style={{
                      color: "var(--color-text-muted)",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.25 }}
                    className="px-6 pb-4"
                  >
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      {a}
                    </p>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CTA                                                                 */
/* ------------------------------------------------------------------ */
function CTASection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div
          className="rounded-3xl relative overflow-hidden px-8 py-16 lg:px-16 lg:py-20 text-center"
          style={{ backgroundColor: "#0f172a" }}
        >
          {/* Decorative elements */}
          <div
            className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-[0.06] pointer-events-none"
            style={{ backgroundColor: "#0d9668" }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-[0.04] pointer-events-none"
            style={{ backgroundColor: "#f59e0b" }}
          />

          <div className="relative">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            >
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5" style={{ color: "#f59e0b" }} />
                <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>
                  14 Gun Ucretsiz Deneme
                </span>
              </motion.div>

              <motion.h2
                variants={fadeUp}
                custom={1}
                className="text-3xl lg:text-4xl font-black text-white mb-4"
              >
                Hemen Baslayin
              </motion.h2>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="text-base max-w-lg mx-auto mb-10"
                style={{ color: "#94a3b8" }}
              >
                Personelinizin egitim surecini dijitallestirin. Kredi karti gerekmez,
                dakikalar icinde baslatin.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105"
                  style={{
                    backgroundColor: "#0d9668",
                    boxShadow: "0 8px 24px rgba(13,150,104,0.35)",
                  }}
                >
                  Ucretsiz Deneyin <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
                  style={{
                    color: "white",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  Demo Talep Edin
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUp}
                custom={4}
                className="flex flex-wrap items-center justify-center gap-6 mt-8"
              >
                {["Kredi karti gerekmez", "14 gun ucretsiz", "Aninda kurulum"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5 text-sm" style={{ color: "#64748b" }}>
                    <CheckCircle className="w-4 h-4" style={{ color: "#0d9668" }} />
                    {item}
                  </span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN EXPORT                                                         */
/* ------------------------------------------------------------------ */
export function MarketingHomeClient() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
