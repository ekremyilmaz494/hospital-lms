"use client";

import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";

export function TestimonialsSection() {
  return (
    <>
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
                  { bg: "var(--brand-600)", l: "A" },
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
                style={{ backgroundColor: "var(--brand-600)" }}
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
