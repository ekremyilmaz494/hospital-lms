import { ClipboardList, Link2 } from 'lucide-react'
import { CertificateVerifyIllustration, FormsStackIllustration } from '../illustrations'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'

/** Denetimde kanıt: iki görselli kart (sertifika, formlar) + iki satır (rapor, işlem geçmişi). */
export function Evidence() {
  const c = HOME_TR.evidence
  const [cert, forms, report, trail] = c.items
  return (
    <section id="denetim" className="s-section" aria-labelledby="kanit-title">
      <div className="s-container">
        <SectionHead id="kanit-title" title={c.title} lead={c.lead} />
        <div className="s-evidence-grid">
          {[
            { item: cert, Art: CertificateVerifyIllustration },
            { item: forms, Art: FormsStackIllustration },
          ].map(({ item, Art }) => (
            <article key={item.title} className="s-card s-evidence-card">
              <div className="s-evidence-art">
                <Art />
              </div>
              <h3 className="s-h3">{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
        <ul className="s-points s-points-2">
          {[
            { item: report, Icon: ClipboardList },
            { item: trail, Icon: Link2 },
          ].map(({ item, Icon }) => (
            <li key={item.title}>
              <span className="s-point-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="s-h3">{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
