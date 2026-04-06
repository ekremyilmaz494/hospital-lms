"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Send,
  CheckCircle,
  Shield,
  Clock,
  Headphones,
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

const STAFF_OPTIONS = [
  "1-50",
  "51-100",
  "101-250",
  "251-500",
  "501-1000",
  "1000+",
];

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hospitalName: string;
  staffCount: string;
  message: string;
};

export function DemoClient() {
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    hospitalName: "",
    staffCount: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
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
        setError(data.error || "Bir hata olustu. Lutfen tekrar deneyin.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Baglanti hatasi. Lutfen internet baglantinizi kontrol edip tekrar deneyin.");
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
              Talebiniz Alindi!
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--color-text-secondary)" }}>
              Demo talebiniz basariyla iletildi. Ekibimiz en kisa surede sizinle iletisime gececektir.
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
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
          {/* Left info */}
          <div className="lg:col-span-2">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            >
              <motion.p
                variants={fadeUp}
                custom={0}
                className="text-xs font-bold tracking-widest uppercase mb-3"
                style={{ color: "#0d9668" }}
              >
                Demo Talep Et
              </motion.p>
              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-3xl lg:text-4xl font-black mb-4"
                style={{ color: "var(--color-text-primary)" }}
              >
                Platformu Deneyin
              </motion.h1>
              <motion.p
                variants={fadeUp}
                custom={2}
                className="text-base leading-relaxed mb-10"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Formu doldurun, ekibimiz size ozel bir demo sunumu ayarlasin.
                14 gunluk ucretsiz deneme erisimi de saglayacagiz.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="space-y-5">
                {[
                  { icon: Clock, title: "30 Dakika Demo", desc: "Size ozel canli demo sunumu" },
                  { icon: Shield, title: "Baglayici Degil", desc: "Herhangi bir taahhut gerektirmez" },
                  { icon: Headphones, title: "Uzman Destek", desc: "Demo sonrasi teknik destek" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "rgba(13,150,104,0.08)" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: "#0d9668" }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>{title}</p>
                      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Right form */}
          <div className="lg:col-span-3">
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
                    Ad <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Adiniz"
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
                    Soyad <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Soyadiniz"
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-text-primary)",
                    }}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5 mb-5">
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
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                    Telefon <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+90 5XX XXX XX XX"
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-text-primary)",
                    }}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                    Hastane Adi <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="hospitalName"
                    required
                    value={form.hospitalName}
                    onChange={handleChange}
                    placeholder="Hastane adiniz"
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
                    Personel Sayisi <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    name="staffCount"
                    required
                    value={form.staffCount}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[#0d9668]"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                      color: form.staffCount ? "var(--color-text-primary)" : "var(--color-text-muted)",
                    }}
                  >
                    <option value="">Seciniz</option>
                    {STAFF_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                  Mesaj (Opsiyonel)
                </label>
                <textarea
                  name="message"
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Ozel gereksinimleriniz veya sorulariniz varsa yazabilirsiniz..."
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
                    Demo Talep Et
                  </>
                )}
              </button>

              <p className="text-xs text-center mt-4" style={{ color: "var(--color-text-muted)" }}>
                Bilgileriniz KVKK kapsaminda korunmaktadir ve ucuncu taraflarla paylasilmaz.
              </p>
            </motion.form>
          </div>
        </div>
      </div>
    </div>
  );
}
