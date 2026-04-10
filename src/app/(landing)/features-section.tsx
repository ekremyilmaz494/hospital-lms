"use client";

import { useState } from "react";
import type React from "react";
import Link from "next/link";
import {
  BookOpen,
  BarChart3,
  Shield,
  Award,
  Clock,
  ArrowRight,
  Bell,
  FileText,
  Lock,
  ClipboardList,
  QrCode,
  Mail,
  Timer,
  AlertCircle,
  Database,
  TrendingUp,
} from "lucide-react";

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

export function FeaturesSection() {
  const [activeCategory, setActiveCategory] = useState("Video Eğitimler");

  return (
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
                <Link
                  href="/register"
                  className="mt-5 flex items-center gap-1 text-xs font-bold group"
                  style={{ color: "#0d9668" }}
                >
                  Daha Fazla <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
