import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Archive,
  Check,
  Cloud,
  FastForward,
  KeyRound,
  Link2,
  Lock,
  Server,
  ServerCog,
  Timer,
} from 'lucide-react'
import { pageMetadata } from '@/lib/site-metadata'
import { BRAND } from '@/lib/brand'
import { PageHead } from '@/components/site/page-head'
import { SectionHead } from '@/components/site/home/section-head'
import { TenantIsolationIllustration, VideoLockIllustration } from '@/components/site/illustrations'
import { SECURITY_TR } from '@/components/site/content/security.tr'
import './guvenlik.css'

export const metadata: Metadata = pageMetadata({
  title: 'Güvenlik ve Veri Koruma',
  description:
    'KlinoVax veriyi nasıl korur: kurumlar arası izolasyon, rol bazlı yetki, şifreleme, zincirleme işlem kaydı, KVKK süreçleri ve barındırma seçenekleri.',
  path: '/guvenlik',
})

const ENCRYPTION_ICONS = [Lock, KeyRound, Archive, Link2] as const
const INTEGRITY_ICONS = [Timer, FastForward, ServerCog] as const
const HOSTING_ICONS = [Cloud, Server] as const

/** Güvenlik: bilgi işlem ve KVKK sorumluları için. Her iddia kodda doğrulanmıştır (security.tr.ts). */
export default function SecurityPage() {
  const c = SECURITY_TR
  return (
    <>
      <PageHead breadcrumbPath="/guvenlik" overline={c.head.overline} title={c.head.title} lead={c.head.lead} />

      {/* Kurumlar arası izolasyon */}
      <section className="s-section g-section" aria-labelledby={c.isolation.id}>
        <div className="s-container s-split">
          <div>
            <SectionHead id={c.isolation.id} title={c.isolation.title} lead={c.isolation.lead} />
            <ul className="s-checks">
              {c.isolation.points.map((point) => (
                <li key={point}>
                  <Check size={18} strokeWidth={2} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="s-split-art">
            <TenantIsolationIllustration />
          </div>
        </div>
      </section>

      {/* Kimlik doğrulama ve oturum */}
      <section className="s-section s-section-alt g-section" aria-labelledby={c.auth.id}>
        <div className="s-container">
          <SectionHead id={c.auth.id} title={c.auth.title} lead={c.auth.lead} />
          <ul className="s-rows g-rows-3">
            {c.auth.items.map((item) => (
              <li key={item.title}>
                <h3 className="s-h3">{item.title}</h3>
                <p>{item.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rol bazlı yetki */}
      <section className="s-section g-section" aria-labelledby={c.roles.id}>
        <div className="s-container">
          <SectionHead id={c.roles.id} title={c.roles.title} lead={c.roles.lead} />
          <ul className="s-rows s-rows-ruled g-rows-3">
            {c.roles.items.map((item) => (
              <li key={item.title}>
                <h3 className="s-h3">{item.title}</h3>
                <p>{item.desc}</p>
              </li>
            ))}
          </ul>
          <p className="g-note">{c.roles.note}</p>
        </div>
      </section>

      {/* Şifreleme */}
      <section className="s-section s-section-alt g-section" aria-labelledby={c.encryption.id}>
        <div className="s-container">
          <SectionHead id={c.encryption.id} title={c.encryption.title} lead={c.encryption.lead} />
          <ul className="s-points s-points-2">
            {c.encryption.points.map((point, i) => {
              const Icon = ENCRYPTION_ICONS[i]
              return (
                <li key={point.title}>
                  <span className="s-point-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="s-h3">{point.title}</h3>
                    <p>{point.desc}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Denetim izi: sayfadaki tek koyu bant */}
      <section className="s-section s-band g-section" aria-labelledby={c.audit.id}>
        <div className="s-container">
          <SectionHead id={c.audit.id} title={c.audit.title} lead={c.audit.lead} />
          <dl className="s-band-list">
            {c.audit.items.map((item) => (
              <div key={item.title}>
                <dt className="s-h3">{item.title}</dt>
                <dd>{item.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Sınav bütünlüğü */}
      <section className="s-section g-section" aria-labelledby={c.integrity.id}>
        <div className="s-container s-split s-split-reverse">
          <div className="s-split-art">
            <VideoLockIllustration />
          </div>
          <div>
            <SectionHead id={c.integrity.id} title={c.integrity.title} lead={c.integrity.lead} />
            <ul className="s-points">
              {c.integrity.points.map((point, i) => {
                const Icon = INTEGRITY_ICONS[i]
                return (
                  <li key={point.title}>
                    <span className="s-point-icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <div>
                      <h3 className="s-h3">{point.title}</h3>
                      <p>{point.desc}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* KVKK süreçleri */}
      <section className="s-section s-section-alt g-section" aria-labelledby={c.kvkk.id}>
        <div className="s-container">
          <SectionHead id={c.kvkk.id} title={c.kvkk.title} lead={c.kvkk.lead} />
          <ul className="s-rows g-rows-3">
            {c.kvkk.points.map((item) => (
              <li key={item.title}>
                <h3 className="s-h3">{item.title}</h3>
                <p>{item.desc}</p>
              </li>
            ))}
          </ul>
          <ul className="g-links" aria-label="İlgili politikalar">
            {c.kvkk.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Barındırma */}
      <section className="s-section g-section" aria-labelledby={c.hosting.id}>
        <div className="s-container">
          <SectionHead id={c.hosting.id} title={c.hosting.title} lead={c.hosting.lead} />
          <ul className="s-points s-points-2">
            {c.hosting.options.map((option, i) => {
              const Icon = HOSTING_ICONS[i]
              return (
                <li key={option.title}>
                  <span className="s-point-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="s-h3">{option.title}</h3>
                    <p>{option.desc}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Güvenlik açığı bildirimi */}
      <section className="s-section s-section-alt g-section" aria-labelledby={c.disclosure.id}>
        <div className="s-container">
          <SectionHead id={c.disclosure.id} title={c.disclosure.title} lead={c.disclosure.lead} />
          <p className="g-mail">
            <span className="g-mail-label">{c.disclosure.emailLabel}</span>
            <a href={`mailto:${BRAND.contact.email}`}>{BRAND.contact.email}</a>
          </p>
          <p className="g-note">{c.disclosure.note}</p>
        </div>
      </section>

      {/* Kapanış */}
      <section className="s-section s-closing g-section" aria-labelledby="guvenlik-kapanis">
        <div className="s-container">
          <div className="s-closing-panel">
            <h2 id="guvenlik-kapanis" className="s-h2">
              {c.closing.title}
            </h2>
            <p className="s-lead">{c.closing.lead}</p>
            <div className="s-cta-row">
              <Link href="/demo" className="s-btn s-btn-primary">
                {c.closing.primaryCta}
              </Link>
              <Link href="/iletisim" className="s-btn s-btn-ghost">
                {c.closing.secondaryCta}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
