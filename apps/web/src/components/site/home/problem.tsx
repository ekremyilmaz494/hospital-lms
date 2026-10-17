import { ScatterToOrderIllustration } from '../illustrations'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'
import { delay } from '../illustrations/_primitives'

/** Bugünkü yöntemin maliyeti: senaryo, sayı yok. */
export function Problem() {
  const c = HOME_TR.problem
  return (
    <section className="s-section" aria-labelledby="sorun-title">
      <div className="s-container">
        <div className="s-split">
          <SectionHead id="sorun-title" title={c.title} lead={c.lead} />
          <div className="s-split-art">
            <ScatterToOrderIllustration />
          </div>
        </div>
        <ul className="s-rows s-rows-4" data-reveal="">
          {c.items.map((item, i) => (
            <li key={item.title} className="s-fade" style={delay(i * 80)}>
              <h3 className="s-h3">{item.title}</h3>
              <p>{item.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
