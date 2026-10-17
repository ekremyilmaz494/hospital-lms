import Image from 'next/image'
import { HOME_TR } from '../content/home.tr'

/** Referans: olgu cümlesi + logo. Alıntı, puan veya rakam yok. */
export function Reference() {
  const c = HOME_TR.reference
  return (
    <section className="s-section s-reference" aria-labelledby="referans-title">
      <div className="s-container s-reference-inner">
        <p className="s-overline">{c.overline}</p>
        <h2 id="referans-title" className="s-h2">
          {c.title}
        </h2>
        <p className="s-lead">{c.body}</p>
        <Image src="/logos/devakent.png" alt={c.logoAlt} width={256} height={71} className="s-reference-logo" />
      </div>
    </section>
  )
}
