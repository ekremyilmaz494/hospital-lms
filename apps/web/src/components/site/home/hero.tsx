import Link from 'next/link'
import { HeroPulseIllustration } from '../illustrations'
import { HOME_TR } from '../content/home.tr'

/** Ana sayfa hero: kategori, vaat, tek birincil CTA ve imza nabız sahnesi. */
export function Hero() {
  const c = HOME_TR.hero
  return (
    <section className="s-hero" aria-labelledby="hero-title">
      <div className="s-container s-hero-grid">
        <div className="s-hero-copy">
          <p className="s-overline">{c.overline}</p>
          <h1 id="hero-title" className="s-h1">
            {c.title}
          </h1>
          <p className="s-hero-lead">{c.lead}</p>
          <div className="s-cta-row">
            <Link href="/demo" className="s-btn s-btn-primary">
              {c.primaryCta}
            </Link>
            <Link href="#nasil-calisir" className="s-btn s-btn-ghost">
              {c.secondaryCta}
            </Link>
          </div>
          <p className="s-hero-proof">
            <span className="s-dot" aria-hidden="true" />
            {HOME_TR.reference.heroProof}
          </p>
        </div>
        <div className="s-hero-art">
          <HeroPulseIllustration />
        </div>
      </div>
    </section>
  )
}
