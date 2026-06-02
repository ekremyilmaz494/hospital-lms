"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, Send, CheckCircle, Loader2 } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Header } from "@/components/landing-3d/header";
import { Footer } from "@/components/landing-3d/footer";

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const INPUT_STYLE: React.CSSProperties = {
  borderColor: "var(--landing-rule)",
  backgroundColor: "var(--landing-bg)",
  color: "var(--landing-ink)",
  fontFamily: "var(--font-body)",
};

/** İletişim sayfası — landing-3d tasarım dili (l3d header/footer + --landing-* token). */
export function ContactClient() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Backend korunur: iletişim formu demo-request endpoint'ine düşer.
      const res = await fetch("/api/public/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.name,
          lastName: "-",
          email: form.email,
          phone: "-",
          organizationName: form.subject,
          staffCount: "-",
          message: `[ILETISIM FORMU] ${form.message}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Bir hata oluştu. Lütfen tekrar deneyin.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="l3d-page" style={{ minHeight: "100vh" }}>
      <Header />
      <main style={{ paddingTop: "132px", paddingBottom: "96px" }}>
        <div className="max-w-6xl mx-auto px-6">
          {/* Başlık */}
          <div className="max-w-2xl mx-auto text-center mb-12 lg:mb-16">
            <span className="l3d-eyebrow">İLETİŞİM</span>
            <h1
              className="mt-3 mb-4 font-bold"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(34px, 5vw, 56px)",
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                color: "var(--landing-ink)",
              }}
            >
              Bize ulaşın
            </h1>
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--landing-ink-soft)", fontFamily: "var(--font-body)" }}
            >
              Sorularınız, önerileriniz veya iş birliği talepleriniz için bizimle
              iletişime geçin.
            </p>
          </div>

          {submitted ? (
            <div className="max-w-lg mx-auto text-center py-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: "rgba(13,150,104,0.12)" }}
              >
                <CheckCircle className="w-8 h-8" style={{ color: "var(--landing-brand)" }} />
              </div>
              <h2
                className="text-2xl font-bold mb-3"
                style={{ fontFamily: "var(--font-display)", color: "var(--landing-ink)" }}
              >
                Mesajınız iletildi!
              </h2>
              <p
                className="text-base leading-relaxed mb-8"
                style={{ color: "var(--landing-ink-soft)" }}
              >
                En kısa sürede size geri dönüş yapacağız.
              </p>
              <Link
                href="/landing-3d"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white"
                style={{
                  backgroundColor: "var(--landing-brand)",
                  fontFamily: "var(--font-display)",
                }}
              >
                Ana sayfaya dön
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
              {/* İletişim bilgileri */}
              <div className="space-y-5">
                {[
                  {
                    icon: Mail,
                    title: "E-posta",
                    value: BRAND.supportEmail,
                    desc: "İş günleri 09:00 - 18:00 arası yanıt",
                  },
                  {
                    icon: Phone,
                    title: "Telefon",
                    value: BRAND.contact.phone,
                    desc: "Pazartesi - Cuma, 09:00 - 18:00",
                  },
                  {
                    icon: MapPin,
                    title: "Adres",
                    value: BRAND.contact.city,
                    desc: "Türkiye",
                  },
                ].map(({ icon: Icon, title, value, desc }) => (
                  <div
                    key={title}
                    className="rounded-2xl border p-6"
                    style={{
                      backgroundColor: "var(--landing-surface)",
                      borderColor: "var(--landing-rule)",
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "rgba(13,150,104,0.1)" }}
                      >
                        <Icon className="w-5 h-5" style={{ color: "var(--landing-brand)" }} />
                      </div>
                      <div>
                        <p
                          className="text-sm font-bold mb-0.5"
                          style={{ fontFamily: "var(--font-display)", color: "var(--landing-ink)" }}
                        >
                          {title}
                        </p>
                        <p className="text-sm font-medium" style={{ color: "var(--landing-brand)" }}>
                          {value}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--landing-ink-soft)" }}>
                          {desc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form */}
              <div className="lg:col-span-2">
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border p-6 sm:p-8"
                  style={{
                    backgroundColor: "var(--landing-surface)",
                    borderColor: "var(--landing-rule)",
                  }}
                >
                  <div className="grid sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label
                        className="block text-sm font-medium mb-1.5"
                        style={{ color: "var(--landing-ink)" }}
                      >
                        Ad Soyad <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Adınız Soyadınız"
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                        style={INPUT_STYLE}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium mb-1.5"
                        style={{ color: "var(--landing-ink)" }}
                      >
                        E-posta <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="ornek@kurum.com"
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                        style={INPUT_STYLE}
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: "var(--landing-ink)" }}
                    >
                      Konu <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="subject"
                      required
                      value={form.subject}
                      onChange={handleChange}
                      placeholder="Mesajınızın konusu"
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                      style={INPUT_STYLE}
                    />
                  </div>

                  <div className="mb-6">
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: "var(--landing-ink)" }}
                    >
                      Mesaj <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      name="message"
                      rows={5}
                      required
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Mesajınızı yazın..."
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668] resize-none"
                      style={INPUT_STYLE}
                    />
                  </div>

                  {error && (
                    <div
                      className="rounded-xl px-4 py-3 text-sm mb-5"
                      style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#dc2626" }}
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 cursor-pointer"
                    style={{
                      backgroundColor: "var(--landing-brand)",
                      fontFamily: "var(--font-display)",
                      boxShadow: "0 8px 24px rgba(13,150,104,0.25)",
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Mesaj Gönder
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
