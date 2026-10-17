import { Check } from 'lucide-react'
import { MobileSyncIllustration } from '../illustrations'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'
import { StoreBadges } from '../store-badges'

/** Mobil uygulama: çevrimdışı cevap kuyruğu, bildirim, sertifika indirme + mağaza rozetleri. */
export function Mobile() {
  const c = HOME_TR.mobile
  return (
    <section className="s-section" aria-labelledby="mobil-title">
      <div className="s-container s-split">
        <div>
          <SectionHead id="mobil-title" title={c.title} lead={c.lead} />
          <ul className="s-checks">
            {c.points.map((point) => (
              <li key={point}>
                <Check size={18} strokeWidth={2} aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <StoreBadges className="s-mt-lg" />
        </div>
        <div className="s-split-art">
          <MobileSyncIllustration />
        </div>
      </div>
    </section>
  )
}
