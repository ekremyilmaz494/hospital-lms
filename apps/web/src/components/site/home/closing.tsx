import Link from 'next/link'
import { HOME_TR } from '../content/home.tr'
import { pulsePath } from '../illustrations/_primitives'

/** Kapanış çağrısı. Nabız çizgisi sayfanın başındaki imzayı tekrarlar. */
export function Closing() {
  const c = HOME_TR.closing
  return (
    <section className="s-section s-closing" aria-labelledby="kapanis-title">
      <div className="s-container">
        <div className="s-closing-panel" data-reveal="">
          <svg className="s-closing-pulse" viewBox="0 0 960 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d={pulsePath(0, 48, 960, 36, 0.72)} pathLength={1} className="s-draw" />
          </svg>
          <h2 id="kapanis-title" className="s-h2">
            {c.title}
          </h2>
          <p className="s-lead">{c.lead}</p>
          <div className="s-cta-row">
            <Link href="/demo" className="s-btn s-btn-primary">
              {c.primaryCta}
            </Link>
            <Link href="/iletisim" className="s-btn s-btn-ghost">
              {c.secondaryCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
