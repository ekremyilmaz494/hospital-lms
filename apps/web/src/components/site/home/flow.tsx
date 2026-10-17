import {
  FlowAssignIllustration,
  FlowExamIllustration,
  FlowLearnIllustration,
  FlowProofIllustration,
} from '../illustrations'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'
import { FlowProgress } from './flow-progress'

const ART = {
  assign: FlowAssignIllustration,
  learn: FlowLearnIllustration,
  exam: FlowExamIllustration,
  proof: FlowProofIllustration,
} as const

/**
 * Nasıl çalışır: 4 adım. Masaüstünde her adımın görseli `position: sticky` ile
 * sabitlenir, metin kayarken görsel yerinde kalır ve sıradaki adım onu iter
 * (JS'siz). Sol raydaki etkin adım işareti `FlowProgress` istemci yaprağından.
 * Mobilde adımlar alt alta, görsel metnin üstünde.
 */
export function Flow() {
  const c = HOME_TR.flow
  return (
    <section id="nasil-calisir" className="s-section s-flow" aria-labelledby="akis-title">
      <div className="s-container">
        <SectionHead id="akis-title" title={c.title} lead={c.lead} />
        <ol className="s-flow-rail" aria-hidden="true">
          {c.steps.map((step, i) => (
            <li key={step.key} data-step={i}>
              <span className="s-flow-num">{String(i + 1).padStart(2, '0')}</span>
              <span>{step.name}</span>
            </li>
          ))}
        </ol>
        <ol className="s-flow-steps">
          {c.steps.map((step, i) => {
            const Art = ART[step.key]
            return (
              <li key={step.key} className="s-flow-step" data-flow-step={i}>
                <div className="s-flow-text">
                  <p className="s-flow-name">
                    <span className="s-flow-num">{String(i + 1).padStart(2, '0')}</span> {step.name}
                  </p>
                  <h3 className="s-h3 s-flow-title">{step.title}</h3>
                  <p className="s-flow-desc">{step.desc}</p>
                </div>
                <div className="s-flow-art">
                  <Art />
                </div>
              </li>
            )
          })}
        </ol>
        <FlowProgress />
      </div>
    </section>
  )
}
