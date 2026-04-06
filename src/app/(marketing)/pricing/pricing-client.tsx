"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight, Zap, Building2, Crown } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

type Plan = {
  name: string;
  icon: React.ElementType;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Baslangic",
    icon: Zap,
    price: "2.999",
    period: "/ay",
    desc: "Kucuk ve orta olcekli saglik kuruluslari icin ideal baslangic paketi.",
    features: [
      "100 personele kadar",
      "10 GB depolama",
      "Video tabanli egitimler",
      "Temel sinav sistemi",
      "Otomatik sertifika",
      "E-posta bildirimleri",
      "Temel raporlama",
      "E-posta destegi",
    ],
    cta: "Ucretsiz Deneyin",
    href: "/demo",
  },
  {
    name: "Profesyonel",
    icon: Building2,
    price: "5.999",
    period: "/ay",
    desc: "Buyuyen hastaneler icin gelismis ozellikler ve oncelikli destek.",
    features: [
      "500 personele kadar",
      "50 GB depolama",
      "Tum Baslangic ozellikleri",
      "Gelismis soru bankasi",
      "Akreditasyon takibi",
      "HIS entegrasyonu",
      "Gelismis raporlama & analiz",
      "Oncelikli destek",
      "API erisimi",
      "Ozel marka (White-label)",
    ],
    cta: "Ucretsiz Deneyin",
    href: "/demo",
    highlighted: true,
  },
  {
    name: "Kurumsal",
    icon: Crown,
    price: "Ozel Fiyat",
    period: "",
    desc: "Buyuk hastane zincirleri ve saglik gruplarfi icin tamamen ozellestirilebilir cozum.",
    features: [
      "Sinirsiz personel",
      "Sinirsiz depolama",
      "Tum Profesyonel ozellikleri",
      "AI Icerik Studyosu",
      "Coklu hastane yonetimi",
      "Ozel entegrasyonlar",
      "SLA garantisi",
      "7/24 telefon destegi",
      "Ozel hesap yoneticisi",
      "Yerinde egitim",
    ],
    cta: "Demo Talep Edin",
    href: "/demo",
  },
];

const COMPARISON_FEATURES = [
  { feature: "Personel Siniri", starter: "100", pro: "500", enterprise: "Sinirsiz" },
  { feature: "Depolama", starter: "10 GB", pro: "50 GB", enterprise: "Sinirsiz" },
  { feature: "Video Egitimler", starter: true, pro: true, enterprise: true },
  { feature: "Sinav Sistemi", starter: "Temel", pro: "Gelismis", enterprise: "Gelismis" },
  { feature: "Soru Bankasi", starter: false, pro: true, enterprise: true },
  { feature: "Otomatik Sertifika", starter: true, pro: true, enterprise: true },
  { feature: "QR Dogrulama", starter: true, pro: true, enterprise: true },
  { feature: "Akreditasyon Takibi", starter: false, pro: true, enterprise: true },
  { feature: "HIS Entegrasyonu", starter: false, pro: true, enterprise: true },
  { feature: "AI Icerik Studyosu", starter: false, pro: false, enterprise: true },
  { feature: "Raporlama", starter: "Temel", pro: "Gelismis", enterprise: "Gelismis + Ozel" },
  { feature: "API Erisimi", starter: false, pro: true, enterprise: true },
  { feature: "White-label", starter: false, pro: true, enterprise: true },
  { feature: "Coklu Hastane", starter: false, pro: false, enterprise: true },
  { feature: "Destek", starter: "E-posta", pro: "Oncelikli", enterprise: "7/24 + Ozel YN" },
];

function renderCell(value: boolean | string) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="w-5 h-5 mx-auto" style={{ color: "#0d9668" }} />
    ) : (
      <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>--</span>
    );
  }
  return <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{value}</span>;
}

export function PricingClient() {
  return (
    <div className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#0d9668" }}>
            Fiyatlandirma
          </p>
          <h1 className="text-3xl lg:text-4xl font-black mb-4" style={{ color: "var(--color-text-primary)" }}>
            Hastanenize Uygun Plan Secin
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Tum planlar 14 gunluk ucretsiz deneme icermektedir. Kredi karti gerekmez.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="rounded-2xl border p-8 flex flex-col relative"
                style={{
                  backgroundColor: plan.highlighted ? "#0f172a" : "var(--color-surface)",
                  borderColor: plan.highlighted ? "rgba(13,150,104,0.3)" : "var(--color-border)",
                  boxShadow: plan.highlighted ? "0 20px 60px rgba(13,150,104,0.12)" : undefined,
                }}
              >
                {plan.highlighted && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full"
                    style={{ backgroundColor: "#f59e0b", color: "#0f172a" }}
                  >
                    En Populer
                  </span>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: plan.highlighted ? "rgba(13,150,104,0.15)" : "rgba(13,150,104,0.08)",
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "#0d9668" }} />
                  </div>
                  <h3
                    className="font-bold text-lg"
                    style={{ color: plan.highlighted ? "white" : "var(--color-text-primary)" }}
                  >
                    {plan.name}
                  </h3>
                </div>

                <div className="mb-4">
                  <span
                    className="text-4xl font-black"
                    style={{ color: plan.highlighted ? "white" : "var(--color-text-primary)" }}
                  >
                    {plan.price.includes("Ozel") ? "" : "\u20BA"}
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span
                      className="text-sm"
                      style={{ color: plan.highlighted ? "#94a3b8" : "var(--color-text-muted)" }}
                    >
                      {plan.period}
                    </span>
                  )}
                </div>

                <p
                  className="text-sm leading-relaxed mb-6"
                  style={{ color: plan.highlighted ? "#94a3b8" : "var(--color-text-secondary)" }}
                >
                  {plan.desc}
                </p>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check
                        className="w-4 h-4 mt-0.5 flex-shrink-0"
                        style={{ color: "#0d9668" }}
                      />
                      <span
                        className="text-sm"
                        style={{ color: plan.highlighted ? "#cbd5e1" : "var(--color-text-secondary)" }}
                      >
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className="inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-transform hover:scale-105"
                  style={
                    plan.highlighted
                      ? {
                          backgroundColor: "#0d9668",
                          color: "white",
                          boxShadow: "0 8px 24px rgba(13,150,104,0.3)",
                        }
                      : {
                          backgroundColor: "transparent",
                          color: "var(--color-text-primary)",
                          border: "1px solid var(--color-border)",
                        }
                  }
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-2xl font-black text-center mb-8" style={{ color: "var(--color-text-primary)" }}>
            Ozellik Karsilastirmasi
          </h2>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface)" }}>
                    <th className="px-6 py-4 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      Ozellik
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-center" style={{ color: "var(--color-text-primary)" }}>
                      Baslangic
                    </th>
                    <th
                      className="px-6 py-4 text-sm font-semibold text-center"
                      style={{ color: "#0d9668" }}
                    >
                      Profesyonel
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-center" style={{ color: "var(--color-text-primary)" }}>
                      Kurumsal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map(({ feature, starter, pro, enterprise }, i) => (
                    <tr
                      key={feature}
                      className="border-t"
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: i % 2 === 0 ? "transparent" : "var(--color-surface)",
                      }}
                    >
                      <td className="px-6 py-3.5 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                        {feature}
                      </td>
                      <td className="px-6 py-3.5 text-center">{renderCell(starter)}</td>
                      <td className="px-6 py-3.5 text-center">{renderCell(pro)}</td>
                      <td className="px-6 py-3.5 text-center">{renderCell(enterprise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-base mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Hangi plan size uygun, emin degilseniz demo talep edin.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105"
            style={{
              backgroundColor: "#0d9668",
              boxShadow: "0 8px 24px rgba(13,150,104,0.3)",
            }}
          >
            Ucretsiz Deneyin <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
