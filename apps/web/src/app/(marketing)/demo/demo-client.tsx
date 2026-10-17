"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Send,
  CheckCircle,
  Shield,
  Presentation,
  FlaskConical,
  CalendarClock,
  Smartphone,
  Loader2,
} from "lucide-react";

const STAFF_OPTIONS = ["1-50", "51-100", "101-250", "251-500", "501-1000", "1000+"];

/** Sol kolon: demoda ne olacağı. Yalnızca doğrulanmış ürün özellikleri ve süreç bilgisi. */
const DEMO_POINTS = [
  {
    icon: Presentation,
    title: "Kendi senaryonuzla gösterim",
    desc: "Eğitimin yüklenmesinden atamaya, sınavdan sertifikaya kadar tüm akışı kurumunuzun örnek bir eğitimi üzerinden izlersiniz.",
  },
  {
    icon: FlaskConical,
    title: "Demo ortamı",
    desc: "Platformu, gerçek personel verilerinizi kullanmadan hazırlanmış bir demo ortamında kendiniz de gezebilirsiniz.",
  },
  {
    icon: Smartphone,
    title: "Web paneli ve mobil uygulama",
    desc: "Yönetici panelini web'de, personelin eğitim ve sınav deneyimini iOS ve Android uygulamasında görürsünüz.",
  },
  {
    icon: CalendarClock,
    title: "30 günlük ücretsiz deneme",
    desc: "Demonun ardından platformu kurumunuzda 30 gün boyunca ücretsiz deneyebilirsiniz.",
  },
  {
    icon: Shield,
    title: "Bağlayıcı değil",
    desc: "Demo talebi herhangi bir taahhüt oluşturmaz.",
  },
] as const;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  staffCount: string;
  message: string;
};

const INPUT_CLASS =
  "w-full rounded-xl border px-4 py-3 text-base transition-colors focus:border-[var(--landing-brand)] sm:text-sm";

const INPUT_STYLE: React.CSSProperties = {
  borderColor: "var(--landing-rule-strong)",
  backgroundColor: "var(--landing-bg)",
  color: "var(--landing-ink)",
  fontFamily: "var(--font-body)",
};

const LABEL_CLASS = "mb-1.5 block text-sm font-medium";

/** Zorunlu alan işareti. */
function Required() {
  return (
    <span aria-hidden="true" style={{ color: "var(--color-error)" }}>
      *
    </span>
  );
}

/** Demo talep sayfası: landing-3d tasarım dili (kabuk (marketing)/layout'tan gelir). */
export function DemoClient() {
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationName: "",
    staffCount: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/public/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Bir hata oluştu. Lütfen tekrar deneyin.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Bağlantı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="pb-20 pt-10 lg:pb-28">
        <div className="mx-auto max-w-lg px-6 text-center">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(13,150,104,0.12)" }}
          >
            <CheckCircle className="h-8 w-8" style={{ color: "var(--landing-brand)" }} />
          </div>
          <h2
            className="mb-3 text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--landing-ink)" }}
          >
            Talebiniz alındı!
          </h2>
          <p
            className="mb-8 text-base leading-relaxed"
            style={{ color: "var(--landing-ink-soft)" }}
          >
            Demo talebiniz başarıyla iletildi. Ekibimiz en kısa sürede sizinle iletişime geçecek.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--landing-brand)", fontFamily: "var(--font-display)" }}
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 pt-6 sm:pb-24 lg:pt-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
          {/* Sol bilgi kolonu */}
          <div className="lg:col-span-2">
            <span className="l3d-eyebrow">DEMO TALEP ET</span>
            <h1
              className="mb-4 mt-3 font-bold"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 4.4vw, 48px)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "var(--landing-ink)",
              }}
            >
              Platformu kurumunuzda deneyin
            </h1>
            <p
              className="mb-10 text-base leading-relaxed"
              style={{ color: "var(--landing-ink-soft)" }}
            >
              Formu doldurun; ekibimiz size özel bir demo gösterimi için ulaşsın. Ardından 30
              günlük ücretsiz deneme erişimi de sunuyoruz.
            </p>

            <ul className="space-y-5">
              {DEMO_POINTS.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "rgba(13,150,104,0.1)" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: "var(--landing-brand)" }} />
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{ fontFamily: "var(--font-display)", color: "var(--landing-ink)" }}
                    >
                      {title}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--landing-ink-soft)" }}>
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Sağ form */}
          <div className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border p-6 sm:p-8"
              style={{
                backgroundColor: "var(--landing-surface)",
                borderColor: "var(--landing-rule)",
              }}
            >
              <div className="mb-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="demo-firstName" className={LABEL_CLASS} style={{ color: "var(--landing-ink)" }}>
                    Ad <Required />
                  </label>
                  <input
                    id="demo-firstName"
                    type="text"
                    name="firstName"
                    required
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Adınız"
                    className={INPUT_CLASS}
                    style={INPUT_STYLE}
                  />
                </div>
                <div>
                  <label htmlFor="demo-lastName" className={LABEL_CLASS} style={{ color: "var(--landing-ink)" }}>
                    Soyad <Required />
                  </label>
                  <input
                    id="demo-lastName"
                    type="text"
                    name="lastName"
                    required
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Soyadınız"
                    className={INPUT_CLASS}
                    style={INPUT_STYLE}
                  />
                </div>
              </div>

              <div className="mb-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="demo-email" className={LABEL_CLASS} style={{ color: "var(--landing-ink)" }}>
                    E-posta <Required />
                  </label>
                  <input
                    id="demo-email"
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="ornek@kurum.com"
                    className={INPUT_CLASS}
                    style={INPUT_STYLE}
                  />
                </div>
                <div>
                  <label htmlFor="demo-phone" className={LABEL_CLASS} style={{ color: "var(--landing-ink)" }}>
                    Telefon <Required />
                  </label>
                  <input
                    id="demo-phone"
                    type="tel"
                    name="phone"
                    required
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+90 5XX XXX XX XX"
                    className={INPUT_CLASS}
                    style={INPUT_STYLE}
                  />
                </div>
              </div>

              <div className="mb-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="demo-organizationName" className={LABEL_CLASS} style={{ color: "var(--landing-ink)" }}>
                    Kurum Adı <Required />
                  </label>
                  <input
                    id="demo-organizationName"
                    type="text"
                    name="organizationName"
                    required
                    value={form.organizationName}
                    onChange={handleChange}
                    placeholder="Kurumunuzun adı"
                    className={INPUT_CLASS}
                    style={INPUT_STYLE}
                  />
                </div>
                <div>
                  <label htmlFor="demo-staffCount" className={LABEL_CLASS} style={{ color: "var(--landing-ink)" }}>
                    Personel Sayısı <Required />
                  </label>
                  <select
                    id="demo-staffCount"
                    name="staffCount"
                    required
                    value={form.staffCount}
                    onChange={handleChange}
                    className={INPUT_CLASS}
                    style={{
                      ...INPUT_STYLE,
                      color: form.staffCount ? "var(--landing-ink)" : "var(--landing-ink-soft)",
                    }}
                  >
                    <option value="">Seçiniz</option>
                    {STAFF_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="demo-message" className={LABEL_CLASS} style={{ color: "var(--landing-ink)" }}>
                  Mesaj (İsteğe Bağlı)
                </label>
                <textarea
                  id="demo-message"
                  name="message"
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Özel gereksinimleriniz veya sorularınız varsa yazabilirsiniz..."
                  className={`${INPUT_CLASS} resize-none`}
                  style={INPUT_STYLE}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl px-4 py-3 text-sm"
                  style={{ backgroundColor: "var(--color-error-bg)", color: "var(--color-error)" }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                style={{
                  backgroundColor: "var(--landing-brand)",
                  fontFamily: "var(--font-display)",
                  boxShadow: "0 8px 24px rgba(13,150,104,0.25)",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Demo Talep Et
                  </>
                )}
              </button>

              <p
                className="mt-4 text-center text-xs leading-relaxed"
                style={{ color: "var(--landing-ink-soft)" }}
              >
                Bilgileriniz yalnızca demo talebinizi yanıtlamak için kullanılır. Ayrıntılar için{" "}
                <Link href="/kvkk" className="underline underline-offset-2">
                  KVKK aydınlatma metnini
                </Link>{" "}
                inceleyebilirsiniz.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
