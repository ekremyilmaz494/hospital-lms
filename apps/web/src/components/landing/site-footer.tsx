"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";

const COLUMNS = [
  {
    title: "Platform",
    items: [
      { label: "Özellikler", href: "#ozellikler" },
      { label: "Süreç", href: "#sureç" },
      { label: "Güvenlik & KVKK", href: "#guvenlik" },
      { label: "SSS", href: "#sss" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer
      className="relative py-12 sm:py-16 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, var(--landing-brand-deep) 0%, #0a1810 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute -top-32 -right-24 w-96 h-96 rounded-full opacity-[0.08] pointer-events-none"
        style={{ backgroundColor: "var(--landing-brand)", filter: "blur(80px)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg"
                style={{
                  background:
                    "linear-gradient(135deg, var(--landing-brand) 0%, #0a1810 100%)",
                  boxShadow: "0 6px 20px rgba(13,150,104,0.32)",
                }}
              >
                {BRAND.name.charAt(0)}
              </div>
              <span
                className="font-bold text-base text-white"
              >
                {BRAND.name}
              </span>
            </Link>
            <p
              className="text-xs leading-relaxed mb-5 max-w-[260px]"
              style={{ color: "var(--landing-ink-muted)" }}
            >
              Sağlık kurumları için klinik disiplinli personel eğitim
              platformu.
            </p>

            <form
              className="flex gap-2 max-w-[280px]"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="E-posta adresiniz"
                className="flex-1 rounded-xl px-4 py-2.5 text-white text-sm outline-none border min-w-0"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,255,255,0.12)",
                }}
                suppressHydrationWarning
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl font-bold hover:scale-105 flex-shrink-0"
                style={{
                  backgroundColor: "var(--landing-accent)",
                  color: "var(--landing-ink)",
                  transition: "transform 200ms var(--landing-ease-spring)",
                }}
                aria-label="Bültene abone ol"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-bold text-white text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm hover:text-white inline-flex items-center gap-2"
                      style={{
                        color: "var(--landing-ink-muted)",
                        transition: "color 160ms var(--landing-ease)",
                      }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="font-bold text-white text-sm mb-4">İletişim</h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="text-sm hover:text-white"
                  style={{
                    color: "var(--landing-ink-muted)",
                    transition: "color 160ms var(--landing-ease)",
                  }}
                >
                  {BRAND.supportEmail}
                </a>
              </li>
              <li
                className="text-sm"
                style={{ color: "var(--landing-ink-muted)" }}
              >
                {BRAND.contact.phone}
              </li>
              <li
                className="text-sm"
                style={{ color: "var(--landing-ink-muted)" }}
              >
                {BRAND.contact.city}
              </li>
            </ul>
          </div>
        </div>

        <div
          className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "var(--landing-ink-muted)" }}>
            © {BRAND.legal.copyrightYear} {BRAND.fullName}. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/kvkk"
              className="text-xs hover:text-white"
              style={{
                color: "var(--landing-ink-muted)",
                transition: "color 160ms var(--landing-ease)",
              }}
            >
              KVKK Aydınlatma
            </Link>
            <Link
              href="/kullanim-kosullari"
              className="text-xs hover:text-white"
              style={{
                color: "var(--landing-ink-muted)",
                transition: "color 160ms var(--landing-ease)",
              }}
            >
              Kullanım Koşulları
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
