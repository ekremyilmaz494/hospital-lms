import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { organizationJsonLd } from '@/lib/organization-jsonld';
import { Header } from '@/components/landing-3d/header';
import { Footer } from '@/components/landing-3d/footer';
import { FounderCard } from '@/components/landing-3d/founder-card';
import '@/app/landing-3d/landing-3d.css';

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — Training & Exam Platform for Hospitals` },
  description:
    'KlinoVax is a cloud-based staff training and compliance platform for hospitals, clinics and pharmacies: assignment, video tracking, exams, certificates and audit-ready reports.',
  alternates: { canonical: '/en', languages: { tr: '/', en: '/en' } },
  openGraph: {
    title: `${BRAND.name} — Training & Exam Platform for Hospitals`,
    description: 'Staff training and compliance platform for hospitals. Founded in 2026 in Konya, Türkiye.',
    type: 'website',
    locale: 'en_US',
  },
};

const FEATURES = [
  { title: 'Assignment', text: 'Assign trainings by department, role or person — deadlines and reminders included.' },
  { title: 'Video tracking', text: 'No fast-forward, real watch time. Staff resume exactly where they left off.' },
  { title: 'Exams & certificates', text: 'Pre- and post-exams, retries, and verifiable certificates issued automatically.' },
  { title: 'Audit-ready reports', text: 'Completion rates, certificate validity and compliance reports in one click.' },
];

const FACTS = [
  { label: 'Founded', value: `${BRAND.legal.foundedYear} · Konya, Türkiye` },
  { label: 'Platforms', value: 'Web · iOS · Android' },
  { label: 'In production', value: 'Özel Devakent Hastanesi' },
];

export default function EnglishPage() {
  return (
    // Root layout `lang="tr"` sabit — İngilizce içerik scoped `lang` ile işaretlenir.
    <div className="l3d-page" lang="en" style={{ minHeight: '100vh' }}>
      {/* Statik künye (kullanıcı girdisi yok) — şirket doğrulaması için makine-okunur */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJsonLd('en') }}
      />
      <Header locale="en" alternateHref="/" />
      {/* paddingTop INLINE — bkz. contact-client.tsx (fixed header çakışması) */}
      <main className="l3d-about" style={{ paddingTop: 'clamp(116px, 9vw, 140px)' }}>
        <section className="l3d-about-hero" id="product">
          <span className="l3d-eyebrow">TRAINING &amp; COMPLIANCE FOR HOSPITALS</span>
          <h1 className="l3d-about-title">
            Upload the training.
            <br />
            The rest is automatic.
          </h1>
          <p className="l3d-about-lead">
            {BRAND.name} is a cloud-based training and exam platform for hospitals, clinics and
            pharmacies. Administrators upload a training once; the system handles assignment, video
            tracking, exams, certificates and audit-ready compliance reports automatically. Staff
            complete their training on web or mobile (iOS and Android).
          </p>
          <dl className="l3d-about-facts">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="l3d-about-features" id="proof" aria-label="Features">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="l3d-about-feature">
              <span className="l3d-about-num">{String(i + 1).padStart(2, '0')}</span>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </article>
          ))}
        </section>

        <div className="l3d-about-grid" id="about">
          <div className="l3d-about-col">
            <section className="l3d-about-block" aria-labelledby="about-title">
              <span className="l3d-about-num">About</span>
              <h2 id="about-title">Who we are</h2>
              <p>
                {BRAND.name} was founded in {BRAND.legal.foundedYear} in Konya, Türkiye by{' '}
                {BRAND.founder.name}. {BRAND.name} is in production use at Özel Devakent Hastanesi.
              </p>
            </section>

            <section className="l3d-about-block" id="contact" aria-labelledby="contact-title">
              <span className="l3d-about-num">Contact</span>
              <h2 id="contact-title">Get in touch</h2>
              <ul className="l3d-about-contact">
                <li>
                  <span>Email</span>
                  <a href={`mailto:${BRAND.contact.email}`}>{BRAND.contact.email}</a>
                </li>
                <li>
                  <span>Location</span>
                  {BRAND.contact.city}
                </li>
                <li>
                  <span>Founder</span>
                  {BRAND.founder.name}
                </li>
              </ul>
            </section>
          </div>

          <aside className="l3d-about-aside" aria-label="Founder">
            <span className="l3d-eyebrow">FOUNDER</span>
            <FounderCard locale="en" />
          </aside>
        </div>
      </main>
      <Footer locale="en" />
    </div>
  );
}
