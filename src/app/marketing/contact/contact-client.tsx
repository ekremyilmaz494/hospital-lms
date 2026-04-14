"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle,
  Loader2,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
        body: JSON.stringify({
          firstName: form.name,
          lastName: "-",
          email: form.email,
          phone: "-",
          hospitalName: form.subject,
          staffCount: "-",
          message: `[ILETISIM FORMU] ${form.message}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Bir hata olustu. Lutfen tekrar deneyin.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Baglanti hatasi. Lutfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-20 lg:py-28">
        <div className="max-w-lg mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: "rgba(13,150,104,0.1)" }}
            >
              <CheckCircle className="w-8 h-8" style={{ color: "#0d9668" }} />
            </div>
            <h2 className="text-2xl font-black mb-3" style={{ color: "var(--color-text-primary)" }}>
              Mesajiniz Iletildi!
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--color-text-secondary)" }}>
              En kisa surede size geri donus yapacagiz.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: "#0d9668" }}
            >
              Ana Sayfaya Don
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#0d9668" }}>
            Iletisim
          </p>
          <h1 className="text-3xl lg:text-4xl font-black mb-4" style={{ color: "var(--color-text-primary)" }}>
            Bize Ulasin
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Sorulariniz, onerileriniz veya isbirligi talepleriniz icin bizimle iletisime gecin.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact info cards */}
          <div className="space-y-5">
            {[
              {
                icon: Mail,
                title: "E-posta",
                value: "destek@hastane-lms.com",
                desc: "Is gunleri 09:00 - 18:00 arasi yanit",
              },
              {
                icon: Phone,
                title: "Telefon",
                value: "+90 850 000 0000",
                desc: "Pazartesi - Cuma, 09:00 - 18:00",
              },
              {
                icon: MapPin,
                title: "Adres",
                value: "Ankara, Turkiye",
                desc: "Cankaya, Ankara 06690",
              },
            ].map(({ icon: Icon, title, value, desc }, i) => (
              <motion.div
                key={title}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={i}
                className="rounded-2xl border p-6"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "rgba(13,150,104,0.08)" }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "#0d9668" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-0.5" style={{ color: "var(--color-text-primary)" }}>
                      {title}
                    </p>
                    <p className="text-sm font-medium" style={{ color: "#0d9668" }}>
                      {value}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      {desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Contact form */}
          <div className="lg:col-span-2">
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              onSubmit={handleSubmit}
              className="rounded-2xl border p-8"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="grid sm:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                    Ad Soyad <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Adiniz Soyadiniz"
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                    E-posta <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="ornek@hastane.com"
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-text-primary)",
                    }}
                  />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                  Konu <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="Mesajinizin konusu"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                  Mesaj <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  name="message"
                  rows={5}
                  required
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Mesajinizi yazin..."
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668] resize-none"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text-primary)",
                  }}
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
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 cursor-pointer"
                style={{
                  backgroundColor: "#0d9668",
                  boxShadow: "0 8px 24px rgba(13,150,104,0.25)",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gonderiliyor...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Mesaj Gonder
                  </>
                )}
              </button>
            </motion.form>
          </div>
        </div>
      </div>
    </div>
  );
}
