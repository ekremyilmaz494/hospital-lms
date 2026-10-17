import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ClipboardList, Link2 } from 'lucide-react'
import { pageMetadata, HOME_LANGUAGES } from '@/lib/site-metadata'
import { BRAND } from '@/lib/brand'
import { homeJsonLd } from '@/lib/organization-jsonld'
import { SiteShell } from '@/components/site/site-shell'
import { FounderCard } from '@/components/site/founder-card'
import { SectionHead } from '@/components/site/home/section-head'
import {
  CertificateVerifyIllustration,
  FormsStackIllustration,
  HeroPulseIllustration,
  TenantIsolationIllustration,
} from '@/components/site/illustrations'

export const metadata: Metadata = pageMetadata({
  title: 'KlinoVax | Staff Training and Exam Platform for Hospitals',
  description:
    'Staff training and compliance platform for hospitals: assignment, locked video, pre and post exams, QR-verified certificates and audit reports.',
  path: '/en',
  locale: 'en',
  absoluteTitle: true,
  languages: HOME_LANGUAGES,
})

/**
 * English copy. Same claims policy as the Turkish home page (home.tr.ts): every sentence
 * maps to a capability in this codebase. No compliance badges, no figures, no prices.
 */
const STEPS = [
  {
    title: 'Assign',
    desc: 'Assign a training to a department, a job title or a person. With a department rule in place, new staff are assigned automatically.',
  },
  {
    title: 'Learn',
    desc: 'Staff complete the video, document or audio on the web or in the mobile app, and resume where they left off.',
  },
  {
    title: 'Measure',
    desc: 'A pre-exam and a post-exam bracket every training. Questions can be shuffled, the timer runs on the server, and you set the pass mark and the number of attempts.',
  },
  {
    title: 'Prove',
    desc: 'Staff who pass receive their certificate automatically. Attendance, signatures and results are compiled into the forms auditors ask for.',
  },
] as const

const VIDEO_POINTS = [
  'Fast-forwarding is disabled. Staff can rewind and rewatch, but they cannot skip ahead.',
  'Watch time is verified on the server; the post-exam opens only after nearly all of the video has actually been watched.',
] as const

const EVIDENCE = {
  cards: [
    {
      title: 'Certificates verified by QR code',
      desc: 'Every certificate carries a verification code. A public page shows whether it is valid, expired or revoked.',
      Art: CertificateVerifyIllustration,
    },
    {
      title: 'Audit forms in one click',
      desc: 'The Training Announcement Form, the Attendance and Signature Form and the Training Record Form are generated as PDF.',
      Art: FormsStackIllustration,
    },
  ],
  points: [
    {
      title: 'Compliance report',
      desc: 'See who is missing a mandatory training, department by department, and send reminders to those who are behind.',
      Icon: ClipboardList,
    },
    {
      title: 'Traceable activity log',
      desc: 'Critical actions are kept in a chained log. If a record is altered later, the integrity check makes the change detectable.',
      Icon: Link2,
    },
  ],
} as const

const SECURITY = [
  {
    title: 'Isolation between institutions',
    desc: "Queries made by hospital users are scoped to their own institution, and row-level security policies are also defined in the database.",
  },
  {
    title: 'Sensitive fields encrypted',
    desc: 'National ID numbers are encrypted at the application layer, and backups are encrypted.',
  },
  {
    title: 'Hosting and deployment options',
    desc: 'The cloud edition runs in the EU (Frankfurt) region. Institutions that want to keep their data on their own servers can choose an on-premises installation.',
  },
  {
    title: 'Data protection requests',
    desc: 'Staff submit access, correction and deletion requests under KVKK (the Turkish data protection law) within the platform, and administrators respond to them there.',
  },
  {
    title: 'Hospital groups',
    desc: 'Each hospital in a group runs separately, while group managers see a consolidated report in one panel.',
  },
] as const

export default function EnglishPage() {
  const { legal, contact, founder } = BRAND

  return (
    <SiteShell locale="en">
      {/* Static company record (no user input): machine-readable for company verification */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd('en') }} />

      <section className="s-hero" aria-labelledby="hero-title">
        <div className="s-container s-hero-grid">
          <div className="s-hero-copy">
            <p className="s-overline">Training and exam platform for hospitals</p>
            <h1 id="hero-title" className="s-h1">
              Assign, measure and prove hospital training.
            </h1>
            <p className="s-hero-lead">
              Mandatory training, exams, certificates and audit records on one platform, without sign-in sheets or
              spreadsheets.
            </p>
            <div className="s-cta-row">
              <Link href="/demo" className="s-btn s-btn-primary">
                Request a demo
              </Link>
              <Link href="#product" className="s-btn s-btn-ghost">
                How it works
              </Link>
            </div>
            <p className="s-hero-proof">
              <span className="s-dot" aria-hidden="true" />
              In use at Özel Devakent Hastanesi · Web, iOS and Android
            </p>
          </div>
          <div className="s-hero-art">
            <HeroPulseIllustration />
          </div>
        </div>
      </section>

      <section id="product" className="s-section" aria-labelledby="product-title">
        <div className="s-container">
          <SectionHead
            id="product-title"
            title="From training to evidence in four steps"
            lead="You prepare the training. Assignment, tracking, exams and documentation follow in the same flow."
          />
          <ul className="s-rows s-rows-4 s-rows-ruled">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3 className="s-h3">{step.title}</h3>
                <p>{step.desc}</p>
              </li>
            ))}
          </ul>
          <ul className="s-checks s-mt-lg">
            {VIDEO_POINTS.map((point) => (
              <li key={point}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="proof" className="s-section s-section-alt" aria-labelledby="proof-title">
        <div className="s-container">
          <SectionHead
            id="proof-title"
            title="When the audit comes, the evidence is ready."
            lead="Training records are not a separate job. Every completed training produces its own documentation."
          />
          <div className="s-evidence-grid">
            {EVIDENCE.cards.map(({ title, desc, Art }) => (
              <article key={title} className="s-card s-evidence-card">
                <div className="s-evidence-art">
                  <Art />
                </div>
                <h3 className="s-h3">{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
          <ul className="s-points s-points-2">
            {EVIDENCE.points.map(({ title, desc, Icon }) => (
              <li key={title}>
                <span className="s-point-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="s-h3">{title}</h3>
                  <p>{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="security" className="s-section s-band" aria-labelledby="security-title">
        <div className="s-container">
          <div className="s-split">
            <SectionHead
              id="security-title"
              title="Your data belongs to your institution."
              lead="Each hospital's data is kept apart from every other hospital and is visible only to authorised people."
            />
            <div className="s-split-art">
              <TenantIsolationIllustration />
            </div>
          </div>
          <dl className="s-band-list">
            {SECURITY.map((item) => (
              <div key={item.title}>
                <dt className="s-h3">{item.title}</dt>
                <dd>{item.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="s-section s-reference" aria-labelledby="reference-title">
        <div className="s-container s-reference-inner">
          <p className="s-overline">Reference</p>
          <h2 id="reference-title" className="s-h2">
            In use in the field.
          </h2>
          <p className="s-lead">
            {`Özel Devakent Hastanesi runs its staff training process on ${BRAND.name}, from training delivery to audit documentation.`}
          </p>
          <Image src="/logos/devakent.png" alt="Özel Devakent Hastanesi" width={256} height={71} className="s-reference-logo" />
        </div>
      </section>

      <section id="about" className="s-section s-section-alt" aria-labelledby="about-title">
        <div className="s-container">
          <div className="s-split s-about-intro">
            <div className="s-prose">
              <h2 id="about-title">Who we are</h2>
              <p>
                {`${BRAND.name} is a staff training and exam platform built for hospitals and healthcare institutions. It was founded in ${legal.foundedYear} in ${contact.city}, by ${founder.name}.`}
              </p>
              <p>
                Mandatory training in hospitals happens regularly, but the records tend to stay scattered across paper
                sign-in sheets, spreadsheets and phone reminders. Gathering them before an audit often takes longer than
                the training itself. We built {BRAND.name} so that the record is created the moment a training is
                completed, and the documents an auditor asks for are already in place.
              </p>
              <p>Staff complete their training on the web or in the iOS and Android apps.</p>
            </div>
            <FounderCard locale="en" />
          </div>
          <dl className="s-facts">
            <div>
              <dt>Registered business</dt>
              <dd>{legal.businessName}</dd>
            </div>
            <div>
              <dt>Founded</dt>
              <dd>{legal.foundedYear}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{contact.city}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="contact" className="s-section s-closing" aria-labelledby="contact-title">
        <div className="s-container">
          <div className="s-closing-panel">
            <h2 id="contact-title" className="s-h2">
              Let&apos;s look at your training process together.
            </h2>
            <p className="s-lead">
              {`We can walk you through assignment, exams, certificates and reports in a demo environment. Write to us at ${contact.email} or request a demo.`}
            </p>
            <div className="s-cta-row">
              <a href={`mailto:${contact.email}`} className="s-btn s-btn-primary">
                Email us
              </a>
              <Link href="/demo" className="s-btn s-btn-ghost">
                Request a demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
