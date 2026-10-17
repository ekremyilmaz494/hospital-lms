import { ReminderTimelineIllustration } from '../illustrations'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'
import { delay } from '../illustrations/_primitives'

/** Otomatik takip: kartsız zaman çizelgesi; dört madde çizelgedeki dört düğümle aynı sırada. */
export function Automation() {
  const c = HOME_TR.automation
  return (
    <section className="s-section s-section-alt" aria-labelledby="takip-title">
      <div className="s-container">
        <SectionHead id="takip-title" title={c.title} lead={c.lead} />
        <div className="s-timeline-art">
          <ReminderTimelineIllustration />
        </div>
        <ol className="s-rows s-rows-4 s-rows-ruled" data-reveal="">
          {c.items.map((item, i) => (
            <li key={item.title} className="s-fade" style={delay(i * 90)}>
              <h3 className="s-h3">{item.title}</h3>
              <p>{item.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
