'use client';

/**
 * Yardım & Destek — "Clinical Editorial" redesign.
 * Panel sayfalarıyla aynı dil: cream + ink + gold + serif display + mono caps.
 * Eğitim akışı (4 adım) + kurallar + iletişim.
 */

import { useEffect } from 'react';
import {
  ArrowLeft, BookOpen, Mail, Phone, Video, FileText, Award, Shield,
  GraduationCap, Play, ClipboardCheck, Headphones,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ─── Editorial palette ─── */
const INK = 'var(--ed-ink, #0a1628)';
const INK_SOFT = 'var(--ed-ink-soft, #5b6478)';
const CREAM = 'var(--ed-cream, #faf7f2)';
const RULE = 'var(--ed-rule, #e5e0d5)';
const GOLD = 'var(--ed-gold, #c9a961)';
const OLIVE = 'var(--ed-olive, #1a3a28)';

const trainingSteps: {
  step: string; title: string; desc: string; icon: LucideIcon;
  tone: { ink: string; bg: string; soft: string };
}[] = [
  { step: '01', title: 'Eğitim atanır', desc: 'Admin tarafından sana eğitim atanır ve bildirim gönderilir.', icon: GraduationCap, tone: { ink: '#1f3a7a', bg: '#eef2fb', soft: '#2c55b8' } },
  { step: '02', title: 'Ön sınav',      desc: 'Mevcut bilgi seviyeni ölçen kısa değerlendirme sınavı.',        icon: ClipboardCheck, tone: { ink: '#6a4e11', bg: '#fef6e7', soft: '#b4820b' } },
  { step: '03', title: 'Video eğitim',  desc: 'Video modüllerini sırayla izle — ileri sarma devre dışı.',      icon: Play, tone: { ink: '#0a1628', bg: 'rgba(10, 22, 40, 0.05)', soft: '#0a1628' } },
  { step: '04', title: 'Son sınav',     desc: 'Öğrenme düzeyini ölçen final sınavı ve sertifika.',             icon: Award, tone: { ink: '#0a7a47', bg: '#eaf6ef', soft: '#0a7a47' } },
];

const sections: {
  number: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone: { ink: string; bg: string; soft: string };
  items: { label: string; detail: string }[];
}[] = [
  {
    number: 'I.',
    icon: FileText,
    title: 'Sınav kuralları',
    subtitle: 'Nasıl çalışır, neye dikkat etmeli',
    tone: { ink: '#1f3a7a', bg: '#eef2fb', soft: '#2c55b8' },
    items: [
      { label: 'Tam ekran modunda açılır',        detail: 'Dikkat dağınıklığını önler.' },
      { label: 'Varsayılan başarı notu %70',       detail: 'Eğitim bazında değişebilir.' },
      { label: 'Deneme hakkı sınırlıdır',          detail: 'Admin tarafından belirlenen hak kadar tekrar edilebilir.' },
      { label: 'Cevaplar otomatik kaydedilir',     detail: 'Sayfadan çıksan bile kaldığın yerden devam edebilirsin.' },
    ],
  },
  {
    number: 'II.',
    icon: Award,
    title: 'Sertifikalar',
    subtitle: 'Başarı belgelerin',
    tone: { ink: '#6a4e11', bg: '#fef6e7', soft: '#b4820b' },
    items: [
      { label: 'Otomatik oluşturulur',             detail: 'Başarılı eğitimler için anında sertifika üretilir.' },
      { label: 'PDF olarak indirilebilir',         detail: 'Resmi belge formatında çıktı alabilirsin.' },
      { label: 'Benzersiz doğrulama kodu',         detail: 'Her sertifika kuruma göre doğrulanabilir koda sahiptir.' },
    ],
  },
  {
    number: 'III.',
    icon: Shield,
    title: 'Güvenlik & gizlilik',
    subtitle: 'Verilerin nasıl korunur',
    tone: { ink: '#0d2010', bg: '#e8efe9', soft: '#1a3a28' },
    items: [
      { label: 'Otomatik oturum sonlandırma',      detail: 'Belirli süre işlem yapılmadığında oturum kapanır.' },
      { label: 'Denetim kayıtları',                detail: 'Tüm işlemler güvenlik için kaydedilir.' },
      { label: 'Kurum izolasyonu',                 detail: 'Her kurum sadece kendi verilerini görebilir.' },
    ],
  },
];

const contacts: {
  icon: LucideIcon; label: string; value: string; href?: string;
  tone: { ink: string; bg: string; soft: string };
}[] = [
  { icon: Mail,       label: 'E-posta',       value: 'destek@hastanelms.com',     href: 'mailto:destek@hastanelms.com', tone: { ink: '#1f3a7a', bg: '#eef2fb', soft: '#2c55b8' } },
  { icon: Phone,      label: 'Telefon',       value: '0850 123 45 67',             href: 'tel:+908501234567',           tone: { ink: '#0a7a47', bg: '#eaf6ef', soft: '#0a7a47' } },
  { icon: Headphones, label: 'Canlı destek',  value: 'Hafta içi 09:00 - 18:00',                                          tone: { ink: '#6a4e11', bg: '#fef6e7', soft: '#b4820b' } },
];

export default function HelpPage() {
  /* Cream theme cascade (main layout varsa) */
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const el = main as HTMLElement;
    const prevBg = el.style.backgroundColor;
    const prevVar = el.style.getPropertyValue('--color-bg-rgb');
    el.style.backgroundColor = CREAM;
    el.style.setProperty('--color-bg-rgb', '250, 247, 242');
    return () => {
      el.style.backgroundColor = prevBg;
      if (prevVar) el.style.setProperty('--color-bg-rgb', prevVar);
      else el.style.removeProperty('--color-bg-rgb');
    };
  }, []);

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundColor: CREAM,
        color: INK,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(10, 22, 40, 0.035) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="relative px-6 sm:px-10 lg:px-16 pt-6 pb-16 max-w-6xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] mb-6"
          style={{
            color: INK,
            border: `1px solid ${RULE}`,
            borderRadius: '2px',
            backgroundColor: 'transparent',
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            transition: 'background-color 160ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(10, 22, 40, 0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <ArrowLeft className="h-3 w-3" style={{ color: GOLD }} />
          Geri Dön
        </button>

        {/* ───── Masthead ───── */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-5"
          style={{ borderBottom: `3px solid ${INK}` }}
        >
          <div className="flex items-end gap-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              № 00 · Yardım
            </p>
            <h1
              className="text-[36px] sm:text-[48px] leading-[0.95] font-semibold tracking-[-0.025em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              destek rehberi<span style={{ color: GOLD }}>.</span>
            </h1>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{ border: `1px solid ${RULE}`, borderRadius: '2px' }}
          >
            <BookOpen className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              Devakent Hastanesi · Platform
            </span>
          </div>
        </header>

        <p
          className="mt-3 text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          Platformu verimli kullanman için ihtiyacın olan tüm bilgiler
        </p>

        {/* ───── Training Flow ───── */}
        <section className="mt-10">
          <header
            className="grid items-end gap-4 pb-3"
            style={{ gridTemplateColumns: '40px 1fr max-content', borderBottom: `2px solid ${GOLD}` }}
          >
            <span
              className="text-[11px] font-semibold tracking-[0.2em]"
              style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              §
            </span>
            <div>
              <h2
                className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                Eğitim akışı
              </h2>
              <p
                className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Her eğitim 4 aşamadan oluşur
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              <Video className="h-3 w-3" />
              Akış
            </span>
          </header>

          <div
            className="mt-5 grid gap-0"
            style={{
              backgroundColor: '#ffffff',
              border: `1px solid ${RULE}`,
              borderRadius: '4px',
              gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
            }}
          >
            <div className="grid md:grid-cols-4">
              {trainingSteps.map((s, i) => {
                const StepIcon = s.icon;
                const isLast = i === trainingSteps.length - 1;
                return (
                  <div
                    key={s.step}
                    className="relative p-5"
                    style={{
                      borderRight: !isLast ? `1px solid ${RULE}` : 'none',
                      borderTop: `3px solid ${s.tone.soft}`,
                    }}
                  >
                    {/* Step number + icon */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 32, height: 32,
                          backgroundColor: s.tone.soft,
                          color: CREAM,
                          borderRadius: '2px',
                          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                          fontSize: '12px',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                        }}
                      >
                        {s.step}
                      </span>
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 26, height: 26,
                          backgroundColor: s.tone.bg,
                          borderRadius: '2px',
                        }}
                      >
                        <StepIcon className="h-3.5 w-3.5" style={{ color: s.tone.soft }} />
                      </span>
                    </div>
                    <h3
                      className="text-[15px] font-semibold tracking-[-0.01em]"
                      style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                    >
                      {s.title}
                    </h3>
                    <p className="mt-1 text-[12px] leading-snug" style={{ color: INK_SOFT }}>
                      {s.desc}
                    </p>
                    {/* Arrow connector on large screens */}
                    {!isLast && (
                      <span
                        aria-hidden
                        className="hidden md:flex absolute top-[24px] -right-[10px] h-5 w-5 items-center justify-center"
                        style={{
                          backgroundColor: CREAM,
                          border: `2px solid ${GOLD}`,
                          borderRadius: '50%',
                          color: GOLD,
                          fontSize: '11px',
                          fontWeight: 700,
                          zIndex: 1,
                        }}
                      >
                        →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───── Info Sections ───── */}
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <section key={section.title}>
                <header
                  className="grid items-end gap-4 pb-3"
                  style={{
                    gridTemplateColumns: '40px 1fr',
                    borderBottom: `2px solid ${section.tone.soft}`,
                  }}
                >
                  <span
                    className="text-[13px] font-semibold tracking-[0.2em]"
                    style={{ color: section.tone.soft, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    {section.number}
                  </span>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 28, height: 28,
                          backgroundColor: section.tone.bg,
                          borderRadius: '2px',
                        }}
                      >
                        <SectionIcon className="h-4 w-4" style={{ color: section.tone.soft }} />
                      </span>
                      <h2
                        className="text-[20px] leading-tight font-semibold tracking-[-0.02em]"
                        style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                      >
                        {section.title}
                      </h2>
                    </div>
                    <p
                      className="mt-1 text-[10px] uppercase tracking-[0.16em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      {section.subtitle}
                    </p>
                  </div>
                </header>

                <ul
                  className="mt-5"
                  style={{
                    backgroundColor: '#ffffff',
                    borderTop: `1px solid ${RULE}`,
                    borderRight: `1px solid ${RULE}`,
                    borderBottom: `1px solid ${RULE}`,
                    borderLeft: `4px solid ${section.tone.soft}`,
                    borderRadius: '4px',
                  }}
                >
                  {section.items.map((item, j, arr) => (
                    <li
                      key={j}
                      className="grid items-start gap-3 px-4 py-3.5"
                      style={{
                        gridTemplateColumns: '28px 1fr',
                        borderBottom: j === arr.length - 1 ? 'none' : `1px solid ${RULE}`,
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center text-[10px] font-semibold tabular-nums mt-0.5"
                        style={{
                          width: 24, height: 24,
                          color: section.tone.ink,
                          backgroundColor: section.tone.bg,
                          borderRadius: '2px',
                          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {(j + 1).toString().padStart(2, '0')}
                      </span>
                      <div>
                        <p
                          className="text-[13px] font-semibold tracking-[-0.01em]"
                          style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                        >
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: INK_SOFT }}>
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* ───── Contact ───── */}
        <section className="mt-12">
          <header
            className="grid items-end gap-4 pb-3"
            style={{ gridTemplateColumns: '40px 1fr', borderBottom: `2px solid ${INK}` }}
          >
            <span
              className="text-[11px] font-semibold tracking-[0.2em]"
              style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              IV.
            </span>
            <div>
              <h2
                className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                İletişim & destek
              </h2>
              <p
                className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Teknik destek veya sorular için bize ulaş
              </p>
            </div>
          </header>

          <div
            className="mt-5 grid sm:grid-cols-3"
            style={{
              backgroundColor: '#ffffff',
              border: `1px solid ${RULE}`,
              borderRadius: '4px',
            }}
          >
            {contacts.map((contact, i, arr) => {
              const ContactIcon = contact.icon;
              const isLast = i === arr.length - 1;
              const inner = (
                <>
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 40, height: 40,
                      backgroundColor: contact.tone.bg,
                      borderRadius: '2px',
                    }}
                  >
                    <ContactIcon className="h-[18px] w-[18px]" style={{ color: contact.tone.soft }} />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: contact.tone.soft, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      {contact.label}
                    </p>
                    <p
                      className="mt-1 text-[14px] font-semibold tracking-[-0.01em] truncate"
                      style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                    >
                      {contact.value}
                    </p>
                  </div>
                </>
              );
              const className = "flex items-center gap-3 px-5 py-5 relative transition-colors";
              const style: React.CSSProperties = {
                borderRight: !isLast ? `1px solid ${RULE}` : 'none',
                borderTop: `3px solid ${contact.tone.soft}`,
              };
              return contact.href ? (
                <a
                  key={contact.label}
                  href={contact.href}
                  className={className}
                  style={style}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = contact.tone.bg; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {inner}
                </a>
              ) : (
                <div key={contact.label} className={className} style={style}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
