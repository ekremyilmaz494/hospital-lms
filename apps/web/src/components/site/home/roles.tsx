import { Check } from 'lucide-react'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'

/** Kim için ne değişir: rol başına "bugün / KlinoVax ile" satırı. Kartsız liste. */
export function Roles() {
  const c = HOME_TR.roles
  return (
    <section className="s-section" aria-labelledby="roller-title">
      <div className="s-container">
        <SectionHead id="roller-title" title={c.title} lead={c.lead} />
        <div className="s-roles" role="table" aria-label={c.title}>
          <div className="s-roles-head" role="row">
            <span role="columnheader">Ekip</span>
            <span role="columnheader">Bugün</span>
            <span role="columnheader">KlinoVax ile</span>
          </div>
          {c.items.map((row) => (
            <div key={row.who} className="s-roles-row" role="row">
              <span role="rowheader" className="s-roles-who">
                {row.who}
              </span>
              <span role="cell" className="s-roles-before">
                {row.before}
              </span>
              <span role="cell" className="s-roles-after">
                <Check size={18} strokeWidth={2} aria-hidden="true" />
                {row.after}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
