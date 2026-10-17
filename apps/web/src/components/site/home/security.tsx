import { TenantIsolationIllustration } from '../illustrations'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'

/** Güvenlik: sayfadaki tek koyu bant. İddialar yalnız kodda doğrulanmış olanlar. */
export function Security() {
  const c = HOME_TR.security
  return (
    <section id="guvenlik" className="s-section s-band" aria-labelledby="guvenlik-title">
      <div className="s-container">
        <div className="s-split">
          <SectionHead id="guvenlik-title" title={c.title} lead={c.lead} />
          <div className="s-split-art">
            <TenantIsolationIllustration />
          </div>
        </div>
        <dl className="s-band-list">
          {c.items.map((item) => (
            <div key={item.title}>
              <dt className="s-h3">{item.title}</dt>
              <dd>{item.desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
