import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import '@/app/landing-3d/landing-3d-bands.css';
import {
  DIFFERENTIATORS,
  FAQ,
  FEATURE_GROUPS,
  FINAL_CTA,
  FLOW,
  HERO,
  MODULES,
  SECTIONS,
  SECURITY,
  SHOWCASE,
  STATS,
  type Module,
} from './content';
import { FeatureStat } from './feature-stat';
import { Footer } from './footer';
import { StoreBadges } from './store-badges';

/** Başlık satırlarını `<br />` ile birleştirir (satır kırılmaları sabit kalır). */
function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={line}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}

/** Bölüm kopyasının içine gömülen editöryel modül listesi (hairline + check ikon). */
function ModuleList({ items }: { items: readonly Module[] }) {
  return (
    <ul className="l3d-modules" role="list">
      {items.map((m) => (
        <li key={m.title} className="l3d-module">
          <svg className="l3d-module-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="l3d-module-text">
            <span className="l3d-module-title">{m.title}</span>
            <span className="l3d-module-desc">{m.desc}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type StepKey = 'egitim' | 'kanit' | 'olcek' | 'erisim';

/**
 * Numaralı adım bölümünün kopya bloğu (01–04): numara düğümü, eyebrow, başlık, lead,
 * mobil illüstrasyon ve modül listesi. Bölüme özgü ek öğeler `children` ile gelir.
 */
function StepCopy({
  section,
  align,
  modules,
  children,
}: {
  section: StepKey;
  align: 'l3d-copy-left' | 'l3d-copy-right';
  modules: readonly Module[];
  children?: ReactNode;
}) {
  const s = SECTIONS[section];
  return (
    <div className={`l3d-copy ${align} l3d-step l3d-reveal`}>
      <span className="l3d-step-num">{s.step}</span>
      <span className="l3d-eyebrow">{s.eyebrow}</span>
      <h2 className="l3d-headline-md">
        <Lines lines={s.headline} />
      </h2>
      <p className="l3d-lead">{s.lead}</p>
      {/* Mobil-only içerik illüstrasyonu (≤768px); masaüstünde display:none */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.art} alt="" aria-hidden="true" className="l3d-section-art" />
      <ModuleList items={modules} />
      {children}
    </div>
  );
}

/**
 * Altı scroll section (<main>) + showcase + showcase SONRASI ayrıntı bantları + footer.
 * Footer <main> DIŞINDA (ScrollTrigger end "bottom bottom" hesabı bozulmasın).
 * <main> içine bölüm EKLENMEZ: telefon timeline'ı 6 × ~100vh varsayar. Tüm metin
 * `content.ts` sabitlerinden gelir.
 */
export function ScrollSections() {
  const { egitim, kanit, olcek, erisim, guven } = SECTIONS;

  return (
    <>
      <main className="l3d-main">
        {/* §1 — HERO */}
        <section id={HERO.id} data-section="hero" className="l3d-section">
          <div className="l3d-copy l3d-copy-hero l3d-reveal">
            <span className="l3d-eyebrow" data-hero-text>
              {HERO.eyebrow}
            </span>
            <h1 className="l3d-headline" data-hero-text>
              <Lines lines={HERO.headline} />
            </h1>
            <p className="l3d-lead" data-hero-text>
              {HERO.lead}
            </p>
            <div className="l3d-cta-row" data-hero-text>
              <Link href={HERO.primaryCta.href} className="l3d-cta">
                {HERO.primaryCta.label}
              </Link>
              <a href={HERO.secondaryCta.href} className="l3d-link">
                {HERO.secondaryCta.label}
              </a>
            </div>
            <div className="l3d-hero-stores" data-hero-text>
              <span className="l3d-hero-stores-label">{HERO.storesLabel}</span>
              <StoreBadges />
            </div>
          </div>
          <div className="l3d-scroll-cue" aria-hidden="true">
            <span>{HERO.scrollCue}</span>
            <span className="l3d-scroll-cue-line" />
          </div>
        </section>

        {/* §2 — CLOSEUP */}
        <section id={egitim.id} data-section={egitim.dataSection} className="l3d-section">
          <StepCopy section="egitim" align="l3d-copy-right" modules={MODULES.egitim} />
        </section>

        {/* §3 — FRONT + STATS */}
        <section id={kanit.id} data-section={kanit.dataSection} className="l3d-section">
          <StepCopy section="kanit" align="l3d-copy-left" modules={MODULES.kanit} />
          <div className="l3d-stats l3d-reveal">
            {STATS.map((s) => (
              <FeatureStat key={s.label} label={s.label} value={s.value} unit={s.unit} />
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={kanit.sideArt.src} alt="" aria-hidden="true" className={kanit.sideArt.className} />
        </section>

        {/* §4 — TOP */}
        <section id={olcek.id} data-section={olcek.dataSection} className="l3d-section">
          <StepCopy section="olcek" align="l3d-copy-left" modules={MODULES.olcek} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={olcek.sideArt.src} alt="" aria-hidden="true" className={olcek.sideArt.className} />
        </section>

        {/* §5 — BACK */}
        <section id={erisim.id} data-section={erisim.dataSection} className="l3d-section">
          <StepCopy section="erisim" align="l3d-copy-left" modules={MODULES.erisim}>
            <StoreBadges className="l3d-store-badges-section" />
          </StepCopy>
          {/* Sağ alan — projeyi diğerlerinden ayıran 3 fark, küçük illüstrasyonlarla */}
          <aside className="l3d-diff l3d-reveal" aria-label={DIFFERENTIATORS.ariaLabel}>
            <span className="l3d-eyebrow">{DIFFERENTIATORS.eyebrow}</span>
            <h3 className="l3d-diff-title">
              <Lines lines={DIFFERENTIATORS.titleLines} />
            </h3>
            <ul className="l3d-diff-list" role="list">
              {DIFFERENTIATORS.items.map((d) => (
                <li key={d.title} className="l3d-diff-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.img} alt="" aria-hidden="true" className="l3d-diff-ico" />
                  <span className="l3d-diff-text">
                    <span className="l3d-diff-h">{d.title}</span>
                    <span className="l3d-diff-d">{d.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        {/* §6 — GÜVEN (Devakent referansı; telefon ekranında logo görünür) */}
        <section id={guven.id} data-section={guven.dataSection} className="l3d-section">
          <div className="l3d-copy l3d-copy-left l3d-copy-guven l3d-reveal">
            <span className="l3d-eyebrow">{guven.eyebrow}</span>
            <h2 className="l3d-headline-md">
              <Lines lines={guven.headline} />
            </h2>
            <p className="l3d-lead">{guven.lead}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={guven.art} alt="" aria-hidden="true" className="l3d-section-art" />
            <div className="l3d-trust-row">
              <span className="l3d-trust-label">{guven.trust.label}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={guven.trust.logo} alt={guven.trust.logoAlt} className="l3d-trust-logo" />
              <span className="l3d-trust-name">{guven.trust.name}</span>
            </div>
          </div>
        </section>
      </main>

      {/* ── <main> SONRASI — canvas showcase'te kaydırılıp çıkar; aşağısı telefonsuzdur ── */}

      {/* Platform showcase — tam genişlik, 3 büyük illüstrasyon kartı.
          `.l3d-showcase` sınıfı DOM'daki İLK eşleşme olmalı (scene-client.tsx). */}
      <section id={SHOWCASE.id} className="l3d-showcase" aria-label={SHOWCASE.ariaLabel}>
        <div className="l3d-showcase-head l3d-reveal">
          <span className="l3d-eyebrow">{SHOWCASE.eyebrow}</span>
          <h2 className="l3d-showcase-title">{SHOWCASE.title}</h2>
        </div>
        <ul className="l3d-showcase-grid l3d-reveal" role="list">
          {SHOWCASE.cards.map((c) => (
            <li key={c.title} className="l3d-showcase-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt="" aria-hidden="true" className="l3d-showcase-img" />
              <span className="l3d-showcase-card-title">{c.title}</span>
              <span className="l3d-showcase-card-desc">{c.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Nasıl çalışır — gerçek bir sıra olduğu için numaralı <ol> */}
      <section
        id={FLOW.id}
        className="l3d-band l3d-band--surface"
        aria-labelledby="nasil-calisir-baslik"
      >
        <div className="l3d-band-head l3d-reveal">
          <span className="l3d-eyebrow">{FLOW.eyebrow}</span>
          <h2 id="nasil-calisir-baslik" className="l3d-showcase-title">
            {FLOW.title}
          </h2>
          <p className="l3d-band-lead">{FLOW.lead}</p>
        </div>
        <ol className="l3d-flow-grid l3d-reveal" role="list">
          {FLOW.steps.map((step, i) => (
            <li key={step.title} className="l3d-flow-step">
              <span className="l3d-flow-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="l3d-flow-title">{step.title}</h3>
              <p className="l3d-flow-desc">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Özellikler — 4 grup, mevcut ModuleList ile */}
      <section id={FEATURE_GROUPS.id} className="l3d-band" aria-labelledby="ozellikler-baslik">
        <div className="l3d-band-head l3d-reveal">
          <span className="l3d-eyebrow">{FEATURE_GROUPS.eyebrow}</span>
          <h2 id="ozellikler-baslik" className="l3d-showcase-title">
            {FEATURE_GROUPS.title}
          </h2>
          <p className="l3d-band-lead">{FEATURE_GROUPS.lead}</p>
        </div>
        <div className="l3d-feature-groups l3d-reveal">
          {FEATURE_GROUPS.groups.map((g) => (
            <div key={g.title} className="l3d-feature-group">
              <h3 className="l3d-feature-group-title">{g.title}</h3>
              <ModuleList items={g.modules} />
            </div>
          ))}
        </div>
      </section>

      {/* Güvenlik — "teknik künye": sayfadaki tek imza öğe. Mono etiketli spesifikasyon satırları. */}
      <section
        id={SECURITY.id}
        className="l3d-band l3d-band--dark"
        aria-labelledby="guvenlik-baslik"
      >
        <div className="l3d-band-inner">
          <div className="l3d-band-head l3d-band-head--left l3d-reveal">
            <span className="l3d-eyebrow">{SECURITY.eyebrow}</span>
            <h2 id="guvenlik-baslik" className="l3d-showcase-title">
              {SECURITY.title}
            </h2>
            <p className="l3d-band-lead">{SECURITY.lead}</p>
          </div>
          <div className="l3d-spec l3d-reveal">
            <div className="l3d-spec-bar">
              <span className="l3d-spec-bar-title">{SECURITY.panelTitle}</span>
            </div>
            <dl className="l3d-spec-list">
              {SECURITY.rows.map((row) => (
                <div key={row.label} className="l3d-spec-row">
                  <dt className="l3d-spec-label">{row.label}</dt>
                  <dd className="l3d-spec-value">
                    {row.items.map((item) => (
                      <span key={item.text} className="l3d-spec-item">
                        {item.text}
                        {item.note ? <span className="l3d-spec-note">{item.note}</span> : null}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="l3d-spec-foot">{SECURITY.footnote}</p>
          </div>
        </div>
      </section>

      {/* Sık sorulan sorular — native <details> akordeon (client JS gerektirmez) */}
      <section id={FAQ.id} className="l3d-faq" aria-label={FAQ.ariaLabel}>
        <div className="l3d-faq-head l3d-reveal">
          <span className="l3d-eyebrow">{FAQ.eyebrow}</span>
          <h2 className="l3d-showcase-title">{FAQ.title}</h2>
        </div>
        <ul className="l3d-faq-list l3d-reveal" role="list">
          {FAQ.items.map((f) => (
            <li key={f.q} className="l3d-faq-item">
              <details className="l3d-faq-details">
                <summary className="l3d-faq-q">
                  <span>{f.q}</span>
                  <span className="l3d-faq-icon" aria-hidden="true" />
                </summary>
                <p className="l3d-faq-a">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Kapanış CTA bandı */}
      <section className="l3d-band l3d-final-cta" aria-labelledby="son-cta-baslik">
        <div className="l3d-final-cta-inner l3d-reveal">
          <h2 id="son-cta-baslik" className="l3d-showcase-title">
            {FINAL_CTA.title}
          </h2>
          <p className="l3d-band-lead">{FINAL_CTA.lead}</p>
          <div className="l3d-final-cta-actions">
            <Link href={FINAL_CTA.primary.href} className="l3d-cta">
              {FINAL_CTA.primary.label}
            </Link>
            <Link href={FINAL_CTA.secondary.href} className="l3d-cta-ghost">
              {FINAL_CTA.secondary.label}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
