import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { organizationJsonLd } from '@/lib/organization-jsonld';
import { Header } from '@/components/landing-3d/header';
import { Footer } from '@/components/landing-3d/footer';
import { FounderCard } from '@/components/landing-3d/founder-card';
import '@/app/landing-3d/landing-3d.css';
import '@/app/landing-3d/landing-3d-about.css';

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — Training & Exam Platform for Hospitals` },
  description:
    'KlinoVax is a cloud-based staff training, exam and compliance platform for hospitals and clinics: assignment and reminders, locked video tracking, exams, QR-verified certificates and audit-ready reports.',
  alternates: { canonical: '/en', languages: { tr: '/', en: '/en' } },
  openGraph: {
    title: `${BRAND.name} — Training & Exam Platform for Hospitals`,
    description:
      'Staff training, exam and compliance platform for hospitals and clinics. Founded in 2026 in Konya, Türkiye.',
    type: 'website',
    locale: 'en_US',
  },
};

const FEATURES = [
  {
    title: 'Assignment & reminders',
    text: 'Assign trainings by department, sub-unit or individual. Reminders go out before the deadline (3 days by default), on the due date and when a training is overdue.',
  },
  {
    title: 'Video tracking',
    text: 'Fast-forward is locked, and reported watch time is validated on the server against real elapsed time. Staff resume exactly where they left off.',
  },
  {
    title: 'Exams & retries',
    text: 'Pre- and post-exams with a time limit, shuffled questions and random question pools. The pass mark defaults to 70 and attempts to 3; extra attempts can be requested and approved.',
  },
  {
    title: 'AI question drafts & transcripts',
    text: 'Draft exam questions from your training content with AI and get automatic video transcripts. Administrators review and approve every question.',
  },
  {
    title: 'Certificates with QR verification',
    text: 'Issued automatically when staff pass the exam. Each PDF carries your logo and a QR code that opens a public verification page, and expiry reminders are sent.',
  },
  {
    title: 'Audit-ready reports',
    text: 'Seven report types (Overview, Department, Staff, Training, Failure, Score and Duration) with PDF and Excel export, backed by a tamper-evident, hash-chained audit log.',
  },
  {
    title: 'Staff mobile app',
    text: 'An iOS and Android app for staff: trainings, exams, certificate sharing, calendar, notifications, feedback, a daily mini-quiz with streaks and badges, and Face ID.',
  },
  {
    title: 'Multi-hospital groups',
    text: 'A group dashboard, consolidated reports and shared staff across branches. KlinoVax sets up groups for you.',
  },
];

const STEPS = [
  {
    title: 'Set up your organization',
    text: 'Add departments and staff, or import them from Excel with a template, a preview and the option to undo. Apply your logo and brand colors.',
  },
  {
    title: 'Upload the content',
    text: 'Add video, PDF or audio in the training wizard. Get an automatic video transcript and AI-drafted questions; you approve the final version.',
  },
  {
    title: 'Assign and remind',
    text: 'Assign by department, sub-unit or individual. Reminders reach staff in the app, by email and as push notifications.',
  },
  {
    title: 'Track and report',
    text: 'Follow progress, including live exam monitoring in the web panel. Certificates are issued automatically, and reports export as PDF or Excel, including attendance sheets and announcement forms.',
  },
];

const SECURITY = [
  { label: 'Hosting', value: 'Frankfurt, EU' },
  {
    label: 'Encryption',
    value:
      'TLS in transit. Files are encrypted at rest with AES-256; national ID numbers and secret keys use AES-256-GCM.',
  },
  { label: 'Backups', value: 'Daily, encrypted and verified.' },
  {
    label: 'Access control',
    value:
      'Two-factor authentication (TOTP and SMS), trusted devices, an IP allowlist, session timeouts set per organization, and a single-tab lock during exams.',
  },
  {
    label: 'Tenant isolation',
    value:
      'Row-level security plus an organization filter on every query keep each hospital’s data fully separate.',
  },
  {
    label: 'Audit log',
    value: 'Hash-chained with SHA-256; tamper-evident and verifiable.',
  },
  {
    label: 'KVKK (Turkey’s Personal Data Protection Law)',
    value:
      'Supports KVKK processes with data-subject request management, privacy-notice consent, data deletion and organization-specific retention periods.',
  },
  {
    label: 'On request',
    value: 'Single sign-on (SAML and OIDC) and on-premise deployment are available on request.',
  },
];

const FAQ = [
  {
    q: 'How long is the free trial?',
    a: 'The free trial lasts 30 days. Request a demo and we will help you get started.',
  },
  {
    q: 'Who uses the mobile app?',
    a: 'The iOS and Android app is built for staff: trainings, exams, certificates, calendar, notifications and feedback. Administrators work in the web panel, which also includes live exam monitoring.',
  },
  {
    q: 'How are trainings assigned, and are they reassigned automatically?',
    a: 'You assign by department, sub-unit or individual. For staff who failed or did not attend, administrators can start a second-round reassignment. For trainings with a renewal period, the assignment reopens automatically when the certificate expires (if the organization has an active training period) and the staff member is notified.',
  },
  {
    q: 'Can staff skip through a training video?',
    a: 'No. Fast-forward is locked, watch time is validated on the server, and progress never moves backward. The video pauses when the tab is hidden, and staff resume where they left off.',
  },
  {
    q: 'What are the default exam rules?',
    a: 'The pass mark defaults to 70 and the number of attempts to 3, within a time limit. Staff can request extra attempts, and administrators approve them.',
  },
  {
    q: 'Where is our data hosted?',
    a: 'Data is hosted in Frankfurt, in the European Union. Every organization is isolated from the others, files and sensitive fields are encrypted, and encrypted backups are taken and verified daily.',
  },
  {
    q: 'Does KlinoVax help with compliance under Turkey’s data protection law (KVKK)?',
    a: 'KlinoVax supports KVKK, Turkey’s Personal Data Protection Law, with data-subject request management, privacy-notice consent, data deletion and retention periods that each organization sets for itself.',
  },
  {
    q: 'Do you offer single sign-on or on-premise deployment?',
    a: 'Both are available on request. Single sign-on works over SAML and OIDC. Contact us to discuss your requirements.',
  },
];

const FACTS = [
  { label: 'Founded', value: `${BRAND.legal.foundedYear} · Konya, Türkiye` },
  { label: 'Platforms', value: 'Web · iOS · Android' },
  { label: 'In production', value: 'Özel Devakent Hastanesi' },
];

const DEMO_MAILTO = `mailto:${BRAND.contact.email}?subject=${encodeURIComponent(
  `Request a demo — ${BRAND.name}`,
)}`;

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
            {BRAND.name} is a cloud-based training, exam and compliance platform for hospitals and
            clinics. Administrators upload a training once; the platform takes care of assignment,
            reminders, video tracking, exams, certificates and audit-ready reports. Staff complete
            their training on the web or in the iOS and Android app.
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

        <section
          className="l3d-about-block l3d-en-section"
          id="how-it-works"
          aria-labelledby="how-it-works-title"
        >
          <span className="l3d-about-num">How it works</span>
          <h2 id="how-it-works-title">From upload to audit in four steps</h2>
          <ol className="l3d-en-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="l3d-about-feature">
                <span className="l3d-about-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="l3d-about-block l3d-en-section"
          id="security"
          aria-labelledby="security-title"
        >
          <span className="l3d-about-num">Security</span>
          <h2 id="security-title">Built for hospital data</h2>
          <p>
            Training records identify your staff, so we treat them accordingly. This is what
            protects them.
          </p>
          <dl className="l3d-en-spec">
            {SECURITY.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="l3d-faq" id="faq" aria-labelledby="faq-title">
          <div className="l3d-faq-head">
            <span className="l3d-about-num">FAQ</span>
            <h2 id="faq-title">Frequently asked questions</h2>
          </div>
          <ul className="l3d-faq-list">
            {FAQ.map((f) => (
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
              <p>
                Start with a 30-day free trial. Tell us about your hospital and we will show you how
                the platform fits your training process.
              </p>
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
              <a href={DEMO_MAILTO} className="l3d-about-cta">
                Request a demo →
              </a>
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
