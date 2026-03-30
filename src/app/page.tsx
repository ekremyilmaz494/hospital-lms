"use client";

import { useState } from "react";
import type React from "react";
import Link from "next/link";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  BookOpen,
  BarChart3,
  Shield,
  ChevronRight,
  Award,
  Users,
  Clock,
  Star,
  ArrowRight,
  CheckCircle,
  GraduationCap,
  Bell,
  Play,
  TrendingUp,
  FileText,
  Lock,
  ClipboardList,
  QrCode,
  Mail,
  Timer,
  AlertCircle,
  Database,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

type Feature = {
  icon: React.ElementType;
  title: string;
  desc: string;
  badge?: string;
};

const categoryFeatures: Record<string, Feature[]> = {
  "Video Eğitimler": [
    {
      icon: BookOpen,
      title: "Yüksek Kaliteli Akış",
      desc: "AWS CloudFront CDN üzerinden kesintisiz video akışı. 1080p'ye kadar destek.",
      badge: "Yeni",
    },
    {
      icon: Timer,
      title: "İleri Sarma Koruması",
      desc: "Personelin videoyu atlamaması için ileri sarma kilidi. Gerçek izleme süresi takibi.",
    },
    {
      icon: FileText,
      title: "Çoklu Format",
      desc: "MP4, WebM ve SCORM içerik formatlarını destekler. Mevcut materyallerinizi kolayca aktarın.",
    },
  ],
  "Sınav Sistemi": [
    {
      icon: ClipboardList,
      title: "Otomatik Sınav",
      desc: "Eğitim tamamlanınca sınav otomatik başlar. Çoktan seçmeli soru tipleri desteklenir.",
    },
    {
      icon: Database,
      title: "Soru Bankası",
      desc: "Kategorize edilmiş soru havuzu. Her sınavda rastgele soru seçimi ile kopya önleme.",
      badge: "Güçlü",
    },
    {
      icon: AlertCircle,
      title: "Yeniden Deneme",
      desc: "Başarısız denemeler için yapılandırılabilir yeniden deneme hakkı ve bekleme süresi.",
    },
  ],
  "Raporlama": [
    {
      icon: BarChart3,
      title: "Gerçek Zamanlı Dashboard",
      desc: "Departman ve personel bazında anlık performans grafikleri. Recharts tabanlı görselleştirme.",
      badge: "Canlı",
    },
    {
      icon: FileText,
      title: "Excel / PDF Export",
      desc: "Tüm raporları tek tıkla Excel veya PDF olarak dışa aktarın. Otomatik format düzeni.",
    },
    {
      icon: TrendingUp,
      title: "Uyumluluk Takibi",
      desc: "Zorunlu eğitimlerin tamamlanma oranlarını departman kırılımıyla izleyin.",
    },
  ],
  "Sertifikalar": [
    {
      icon: Award,
      title: "Otomatik Sertifika",
      desc: "Başarılı sınav sonrası sertifika anında oluşturulur ve personele e-posta ile gönderilir.",
    },
    {
      icon: QrCode,
      title: "QR Doğrulama",
      desc: "Her sertifikada benzersiz QR kod. Üçüncü taraflar sertifikanın geçerliliğini doğrulayabilir.",
      badge: "Yeni",
    },
    {
      icon: Clock,
      title: "Geçerlilik Takibi",
      desc: "Sertifika süre sonu bildirimleri ve yenileme hatırlatmaları otomatik olarak gönderilir.",
    },
  ],
  "Bildirimler": [
    {
      icon: Bell,
      title: "Gerçek Zamanlı",
      desc: "Supabase Realtime altyapısıyla anlık bildirimler. Sayfa yenilemesi gerekmez.",
      badge: "Canlı",
    },
    {
      icon: Mail,
      title: "E-posta Bildirimleri",
      desc: "Eğitim ataması, sınav hatırlatması ve sertifika bildirimlerini SMTP üzerinden gönderin.",
    },
    {
      icon: Timer,
      title: "Hatırlatıcılar",
      desc: "Son tarihe yaklaşan eğitimler için otomatik hatırlatma e-postaları ve platform bildirimleri.",
    },
  ],
  "Güvenlik": [
    {
      icon: Shield,
      title: "KVKK Uyumlu",
      desc: "Türk KVKK ve GDPR uyumlu veri işleme. Tüm kişisel veriler şifreli saklanır.",
    },
    {
      icon: Lock,
      title: "Rol Tabanlı Erişim",
      desc: "Super Admin, Hastane Admin ve Personel rolleri. Her rol sadece kendi verisini görür.",
      badge: "RLS",
    },
    {
      icon: FileText,
      title: "Denetim Kayıtları",
      desc: "Tüm kritik işlemler zaman damgasıyla kaydedilir. Yasal denetimler için hazır log sistemi.",
    },
  ],
};

/* ─────────────────────────────────────────────
   HERO VISUAL — static dashboard mockup
───────────────────────────────────────────── */
function HeroVisual() {
  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Soft glow rings */}
      <div
        className="absolute w-[480px] h-[480px] rounded-full border opacity-[0.07]"
        style={{ borderColor: "#0d9668" }}
      />
      <div
        className="absolute w-[380px] h-[380px] rounded-full border opacity-[0.12]"
        style={{ borderColor: "#0d9668" }}
      />

      {/* Organic blob */}
      <div
        className="relative w-[420px] h-[420px] flex-shrink-0"
        style={{
          borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
          background: "linear-gradient(145deg, #1a3a28 0%, #0d2010 100%)",
          overflow: "hidden",
        }}
      >
        {/* Inner decorative glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: "#0d9668" }}
        />
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-10"
          style={{ backgroundColor: "#4ade80" }}
        />

        {/* Dashboard card content */}
        <div className="absolute inset-0 flex flex-col justify-center px-7 py-7 gap-3">
          {/* Active training card */}
          <div
            className="rounded-2xl p-4 border"
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
                Aktif Eğitim
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }}
              >
                ● Devam Ediyor
              </span>
            </div>
            <p className="text-white font-bold text-sm mb-3">Acil Müdahale & CPR Eğitimi</p>
            <div
              className="w-full h-1.5 rounded-full mb-1.5"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-1.5 rounded-full"
                style={{ width: "68%", backgroundColor: "#0d9668" }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                68% tamamlandı
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                4 / 6 ders
              </span>
            </div>
          </div>

          {/* Mini stat cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Başarı Oranı", value: "%94", icon: TrendingUp, color: "#4ade80" },
              { label: "Katılımcı", value: "218", icon: Users, color: "#f59e0b" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-xl p-3"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                <Icon className="w-3.5 h-3.5 mb-1.5" style={{ color }} />
                <p className="text-xl font-black text-white leading-none">{value}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Achievement notification */}
          <div
            className="rounded-xl p-3 flex items-center gap-2.5 border"
            style={{
              backgroundColor: "rgba(245,158,11,0.1)",
              borderColor: "rgba(245,158,11,0.2)",
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(245,158,11,0.2)" }}
            >
              <Award className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white leading-tight">Sertifika Kazanıldı!</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                Hijyen Eğitimi — Ayşe K.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div
        className="absolute top-0 right-10 w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center text-center z-10 pointer-events-none"
        style={{
          backgroundColor: "#f59e0b",
          color: "#1a3a28",
          boxShadow: "0 4px 20px rgba(245,158,11,0.45)",
        }}
      >
        <span className="text-xl font-black leading-none">7/24</span>
        <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5">
          Erişim
        </span>
      </div>

      {/* Floating testimonial bubble */}
      <div
        className="absolute -left-2 top-12 bg-white rounded-2xl px-3 py-2.5 shadow-xl flex items-center gap-2.5 z-10"
        style={{ maxWidth: 195 }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: "#0d9668" }}
        >
          Dr
        </div>
        <p className="text-[11px] font-medium leading-snug" style={{ color: "#1a3a28" }}>
          &ldquo;Personelimiz artık çok daha hazırlıklı!&rdquo;
        </p>
      </div>

      {/* Floating notification pill */}
      <div
        className="absolute bottom-10 -right-2 bg-white rounded-full px-3 py-2 shadow-lg flex items-center gap-2 z-10"
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#ecfdf5" }}
        >
          <Bell className="w-2.5 h-2.5" style={{ color: "#0d9668" }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: "#1a3a28" }}>
          Yeni sertifika hazır
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: "#0d9668" }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState("Video Eğitimler");
  return (
    <div
      className="min-h-screen font-sans overflow-x-hidden"
      style={{ backgroundColor: "#f5f0e6", color: "#1a3a28", scrollBehavior: "smooth" }}
    >
      {/* ── NAVBAR ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "#f5f0e6",
          borderColor: "rgba(26,58,40,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg"
              style={{ background: "linear-gradient(135deg, #0d9668, #1a3a28)" }}
            >
              H
            </div>
            <div className="leading-none">
              <p className="font-bold text-base" style={{ color: "#1a3a28" }}>
                Hastane LMS
              </p>
              <p
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "#0d9668" }}
              >
                Eğitim Platformu
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "Hakkında",   href: "#hakkinda"   },
              { label: "Özellikler", href: "#ozellikler" },
              { label: "Güvenlik",   href: "#guvenlik"   },
              { label: "SSS",        href: "#sss"        },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium transition-opacity hover:opacity-60"
                style={{ color: "#1a3a28" }}
              >
                {label}
              </a>
            ))}
          </nav>

          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black uppercase tracking-wide transition-transform hover:scale-105"
            style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
          >
            Giriş Yap <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-6 py-16 xl:py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left text */}
        <div>
          <span
            className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase px-4 py-1.5 rounded-full border mb-7"
            style={{ color: "#0d9668", borderColor: "#0d9668" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#0d9668" }}
            />
            Personel Eğitim Platformu
          </span>

          <h1
            className="text-[2.75rem] xl:text-[3.5rem] font-black leading-[1.0] mb-6 tracking-tight"
            style={{ color: "#1a3a28" }}
          >
            <span
              className="inline-block border-[3px] border-current px-2 mr-2 mb-1 align-middle"
              style={{ borderColor: "#1a3a28" }}
            >
              Eğitimi
            </span>
            Yönet,
            <br />
            Başarıyı{" "}
            <span style={{ color: "#0d9668" }}>Ölç.</span>
          </h1>

          <p
            className="text-base leading-relaxed max-w-[400px] mb-10"
            style={{ color: "#4a7060" }}
          >
            Hastane personellerinize video tabanlı eğitimler atayın, sınav
            yapın ve performansı gerçek zamanlı takip edin.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-12">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-black uppercase tracking-wide transition-transform hover:scale-105 shadow-lg"
              style={{
                backgroundColor: "#f59e0b",
                color: "#1a3a28",
                boxShadow: "0 8px 32px rgba(245,158,11,0.35)",
              }}
            >
              Eğitimlere Başla <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-60"
              style={{ color: "#1a3a28" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                style={{ borderColor: "#1a3a28" }}
              >
                <Play className="w-3 h-3 ml-0.5" />
              </div>
              Demo İzle
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {(
                [
                  { bg: "#0d9668", letter: "A" },
                  { bg: "#1a3a28", letter: "M" },
                  { bg: "#b45309", letter: "F" },
                  { bg: "#0d9668", letter: "K" },
                ] as const
              ).map(({ bg, letter }) => (
                <div
                  key={letter}
                  className="w-9 h-9 rounded-full border-[2.5px] flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: bg, borderColor: "#f5f0e6" }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                ))}
              </div>
              <p className="text-xs font-medium" style={{ color: "#4a7060" }}>
                500+ aktif kullanıcı tarafından güveniliyor
              </p>
            </div>
          </div>
        </div>

        {/* Right — static dashboard mockup */}
        <div className="flex justify-center lg:justify-end">
          <HeroVisual />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section id="hakkinda" style={{ backgroundColor: "#1a3a28" }}>
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4">
          {[
            { prefix: "",   num: 500, suffix: "+", label: "Aktif Personel" },
            { prefix: "",   num: 120, suffix: "+", label: "Eğitim Modülü" },
            { prefix: "%",  num: 94,  suffix: "",  label: "Tamamlanma Oranı" },
            { prefix: "7/", num: 24,  suffix: "",  label: "Kesintisiz Erişim" },
          ].map(({ prefix, num, suffix, label }, i) => (
            <div
              key={label}
              className="text-center py-2 px-4"
              style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.1)" : "none" }}
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
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p
              className="text-xs font-bold tracking-widest uppercase mb-2"
              style={{ color: "#0d9668" }}
            >
              Öne Çıkanlar
            </p>
            <h2 className="text-3xl font-black" style={{ color: "#1a3a28" }}>
              Bu Hafta Önerilen Eğitimler
            </h2>
          </div>
          <Link
            href="/auth/login"
            className="hidden md:flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-60"
            style={{ color: "#0d9668" }}
          >
            Tümünü Gör <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div
            className="relative rounded-3xl p-8 overflow-hidden group"
            style={{ backgroundColor: "#1a3a28" }}
          >
            <div
              className="absolute -top-8 -right-8 w-44 h-44 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
              style={{ backgroundColor: "#0d9668" }}
            />
            <div
              className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5"
              style={{ backgroundColor: "#4ade80" }}
            />
            <div className="relative">
              <span
                className="inline-block text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full mb-5"
                style={{ backgroundColor: "#0d9668", color: "white" }}
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
              <div className="flex items-center justify-between">
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-transform hover:scale-105"
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
              style={{ backgroundColor: "#0d9668" }}
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
            <div className="relative p-8">
              <span
                className="inline-block text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full border mb-5"
                style={{ color: "#0d9668", borderColor: "#0d9668" }}
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
              <div className="flex items-center justify-between">
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-transform hover:scale-105"
                  style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
                >
                  <GraduationCap className="w-4 h-4" /> Başla
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section id="ozellikler" className="py-20" style={{ backgroundColor: "#ece7d7" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
            <div>
              <p
                className="text-xs font-bold tracking-widest uppercase mb-2"
                style={{ color: "#0d9668" }}
              >
                Platform Özellikleri
              </p>
              <h2 className="text-3xl font-black" style={{ color: "#1a3a28" }}>
                Neden Hastane LMS?
              </h2>
            </div>
            <p
              className="text-sm leading-relaxed max-w-xs md:text-right"
              style={{ color: "#4a7060" }}
            >
              Personelinizi geliştirmek için ihtiyaç duyduğunuz her şey tek
              platformda.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Category sidebar */}
            <div className="lg:w-48 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 flex-shrink-0">
              {Object.keys(categoryFeatures).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={[
                    "text-sm font-semibold px-4 py-2.5 rounded-full text-left whitespace-nowrap",
                    "cursor-pointer select-none",
                    "transition-colors transition-transform",
                    "active:scale-95",
                    activeCategory === cat
                      ? "text-white shadow-md"
                      : "hover:bg-[#0d9668]/10 hover:text-[#1a3a28]",
                  ].join(" ")}
                  style={
                    activeCategory === cat
                      ? { backgroundColor: "#0d9668", color: "white" }
                      : { color: "#4a7060" }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Feature cards — changes with active category */}
            <div className="flex-1 grid sm:grid-cols-3 gap-4">
              {categoryFeatures[activeCategory].map(({ icon: Icon, title, desc, badge }) => (
                <div
                  key={title}
                  className="bg-white rounded-2xl p-6 relative overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {badge && (
                    <span
                      className="absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
                    >
                      {badge}
                    </span>
                  )}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: "#ecfdf5" }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "#0d9668" }} />
                  </div>
                  <h3
                    className="font-bold text-base mb-2"
                    style={{ color: "#1a3a28" }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#4a7060" }}>
                    {desc}
                  </p>
                  <div
                    className="mt-5 flex items-center gap-1 text-xs font-bold"
                    style={{ color: "#0d9668" }}
                  >
                    Daha Fazla <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section id="guvenlik" className="max-w-7xl mx-auto px-6 py-20">
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
            style={{ backgroundColor: "#0d9668" }}
          />

          {/* Left stats grid */}
          <div className="relative grid grid-cols-2 gap-3 p-6">
            {[
              { label: "Toplam Eğitim", num: 120, prefix: "", suffix: "+", icon: BookOpen,    bar: 80, color: "#0d9668" },
              { label: "Tamamlanma",    num: 94,  prefix: "%", suffix: "", icon: CheckCircle, bar: 94, color: "#4ade80" },
              { label: "Sertifika",     num: 850, prefix: "", suffix: "+", icon: Award,       bar: 70, color: "#f59e0b" },
              { label: "Kullanıcı",     num: 500, prefix: "", suffix: "+", icon: Users,       bar: 60, color: "#0d9668" },
            ].map(({ label, num, prefix, suffix, icon: Icon, bar, color }, i) => (
              <div
                key={label}
                className="rounded-2xl p-5 flex flex-col gap-0 relative overflow-hidden border"
                style={{
                  backgroundColor: "#0d2818",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                {/* Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: `${color}22`,
                      boxShadow: `0 0 16px ${color}33`,
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {bar}%
                  </span>
                </div>

                {/* Value */}
                <p className="text-2xl font-black text-white tabular-nums leading-none mb-1">
                  {prefix}
                  <NumberTicker value={num} delay={i * 0.12} className="text-2xl font-black text-white" />
                  {suffix}
                </p>
                <p className="text-xs mb-4" style={{ color: "#6dba92" }}>{label}</p>

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
          <div className="relative p-10 flex flex-col justify-center">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: "#0d9668" }}
            >
              İhtiyacınız Olan Her Şey
            </p>
            <h2 className="text-3xl font-black text-white leading-tight mb-6">
              Sağlıklı Personel,
              <br />
              <span style={{ color: "#0d9668" }}>Güçlü Hastane.</span>
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "#6dba92" }}>
              Video eğitimden sertifikaya, raporlamadan bildirimlere — tüm
              eğitim altyapısı tek platformda.
            </p>

            {/* Feature bullets */}
            <ul className="space-y-2.5 mb-8">
              {[
                "7/24 kesintisiz erişim",
                "KVKK & GDPR uyumlu güvenli altyapı",
                "Otomatik sertifika & QR doğrulama",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "#a0d4b8" }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#0d9668" }} />
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

      {/* ── TESTIMONIAL ── */}
      <section id="sss" className="py-16" style={{ backgroundColor: "#ece7d7" }}>
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p
              className="text-[80px] font-black leading-none -mb-4 select-none"
              style={{ color: "#1a3a28", opacity: 0.1 }}
            >
              &#8220;
            </p>
            <h3 className="text-2xl font-black mb-6" style={{ color: "#1a3a28" }}>
              Kullanıcılarımızdan
              <br />
              Değerlendirmeler
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[
                  { bg: "#0d9668", l: "A" },
                  { bg: "#1a3a28", l: "M" },
                  { bg: "#b45309", l: "F" },
                ].map(({ bg, l }) => (
                  <div
                    key={l}
                    className="w-9 h-9 rounded-full border-[2.5px] flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: bg, borderColor: "#ece7d7" }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium" style={{ color: "#4a7060" }}>
                3 farklı hastaneden yorumlar
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: "#0d9668" }}
              >
                Dr
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: "#1a3a28" }}>
                  Dr. Ayşe Kaya
                </p>
                <p className="text-xs" style={{ color: "#4a7060" }}>
                  Eğitim Koordinatörü — Ankara Şehir Hastanesi
                </p>
              </div>
            </div>
            <div className="flex gap-0.5 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b]" />
              ))}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#4a7060" }}>
              &ldquo;Personelimizin zorunlu eğitimleri tamamlama oranı %60&apos;tan
              %94&apos;e çıktı. Sistem son derece kullanımı kolay ve raporlama
              özellikleri gerçekten güçlü.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12" style={{ backgroundColor: "#1a3a28" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            {/* Newsletter */}
            <div>
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
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl font-bold transition-transform hover:scale-105 flex-shrink-0"
                  style={{ backgroundColor: "#f59e0b", color: "#1a3a28" }}
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

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
              <div key={title}>
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
              </div>
            ))}
          </div>

          <div
            className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-xs" style={{ color: "#6dba92" }}>
              © 2026 Hastane LMS Platformu. Tüm hakları saklıdır.
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
    </div>
  );
}
