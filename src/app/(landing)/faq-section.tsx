"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { BRAND } from "@/lib/brand";

const EASE = [0.22, 1, 0.36, 1] as const;

const FAQS = [
  {
    q: "Hangi sağlık kurumları kullanabilir?",
    a: "Hastaneler, aile sağlığı merkezleri, özel klinikler, fizik tedavi ve rehabilitasyon merkezleri, ruh sağlığı merkezleri — sağlık alanında personel eğitimi yöneten her kurum. Multi-tenant mimari sayesinde her kurumun verisi izole alanda saklanır.",
  },
  {
    q: "Personel eğitimleri nasıl atanır?",
    a: "Yönetici panelinden eğitimi seçer, hedef departman/personel listesini belirler ve teslim tarihi ile atarsınız. Atanan personel anlık bildirim ve e-posta alır; ilerleme durumu canlı dashboard üzerinden takip edilir.",
  },
  {
    q: "Sınavlarda kopya nasıl önlenir?",
    a: "Video ileri sarma engellidir; izleme süresi frame seviyesinde kayıt altına alınır. Sınav oturumları timer'lı çalışır, sorular soru bankasından rastgele seçilir, oturum kesintisi durumunda otomatik kapatma uygulanır.",
  },
  {
    q: "Sertifikalar nasıl doğrulanır?",
    a: "Başarılı sınav sonrası otomatik üretilen sertifikada benzersiz QR kod yer alır. Bu QR kod kamerayla okunduğunda sertifika kayıtla anlık eşleşir; sahte sertifika basımı engellenir, denetimde saniyeler içinde doğrulanır.",
  },
  {
    q: "Verilerimiz nerede saklanır, KVKK uyumu nasıl?",
    a: "Veriler AB bölgesindeki güvenlikli sunucularda şifreli olarak saklanır. Tüm tablolarda satır seviyesi güvenlik (RLS) aktiftir; bir kurumun verisine başka kurum erişemez. Tüm kritik işlemler audit log altına alınır, KVKK aydınlatma süreçleri yerleşik gelir.",
  },
  {
    q: "Sisteme geçiş ne kadar sürer?",
    a: "Standart kurulum aynı hafta içinde devreye alınır. Beta dönemine katılan kurumlara mevcut eğitim içeriklerinin platforma taşınması ürün ekibimiz tarafından yapılır.",
  },
] as const;

// Static, build-time JSON-LD — no user input. Safe per Google FAQPage schema spec.
const FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

export function FaqSection() {
  const shouldReduce = useReducedMotion();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section
      id="sss"
      className="relative py-14 sm:py-20 md:py-24 overflow-hidden"
      style={{ backgroundColor: "#ece7d7" }}
      aria-label="Sıkça sorulan sorular"
    >
      {/* JSON-LD payload is static (no user input) — safe for SEO rich snippets */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: FAQ_JSON_LD }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-10 sm:mb-14"
        >
          <p
            className="text-[10px] sm:text-xs font-extrabold tracking-[0.18em] uppercase mb-3"
            style={{ color: "var(--brand-600)" }}
          >
            Sıkça Sorulan Sorular
          </p>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-[1.1]"
            style={{ color: "#1a3a28", letterSpacing: "-0.025em" }}
          >
            Aklınıza takılanlar.
          </h2>
          <p
            className="mt-3 text-sm sm:text-base leading-relaxed mx-auto"
            style={{ color: "#3d5e51", maxWidth: 500 }}
          >
            Cevabını bulamadığınız bir soru varsa{" "}
            <a
              href={`mailto:${BRAND.contact.email}`}
              className="font-extrabold underline underline-offset-4"
              style={{ color: "var(--brand-600)" }}
            >
              doğrudan bize yazın
            </a>
            .
          </p>
        </motion.div>

        {/* Accordion */}
        <ul className="space-y-3 sm:space-y-4">
          {FAQS.map(({ q, a }, i) => {
            const isOpen = openIdx === i;
            const Icon = isOpen ? Minus : Plus;
            return (
              <motion.li
                key={q}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, ease: EASE, delay: i * 0.04 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: isOpen
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(255,255,255,0.55)",
                  border: `1px solid ${
                    isOpen ? "rgba(13,150,104,0.3)" : "rgba(26,58,40,0.08)"
                  }`,
                  boxShadow: isOpen
                    ? "0 16px 40px -20px rgba(13,150,104,0.25)"
                    : "0 2px 8px -4px rgba(26,58,40,0.06)",
                  transition:
                    "background-color 250ms ease, border-color 250ms ease, box-shadow 250ms ease",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left cursor-pointer"
                >
                  <span
                    className="text-base sm:text-lg font-extrabold leading-snug"
                    style={{
                      color: "#1a3a28",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {q}
                  </span>
                  <span
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: isOpen
                        ? "var(--brand-600)"
                        : "rgba(26,58,40,0.06)",
                      color: isOpen ? "#ffffff" : "#1a3a28",
                      transition:
                        "background-color 250ms ease, color 250ms ease",
                    }}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.5} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="panel"
                      id={`faq-panel-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        className="px-5 sm:px-6 pb-5 text-sm sm:text-[15px] leading-relaxed"
                        style={{ color: "#3d5e51" }}
                      >
                        {a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
