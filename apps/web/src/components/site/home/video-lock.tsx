import { FastForward, History, ServerCog } from 'lucide-react'
import { VideoLockIllustration } from '../illustrations'
import { HOME_TR } from '../content/home.tr'
import { SectionHead } from './section-head'

const ICONS = [FastForward, ServerCog, History] as const

/** İzlemeden geçilmez: ileri sarma kilidi, sunucu doğrulaması, kaldığı yerden devam. */
export function VideoLock() {
  const c = HOME_TR.videoLock
  return (
    <section className="s-section s-section-alt" aria-labelledby="video-title">
      <div className="s-container s-split s-split-reverse">
        <div className="s-split-art">
          <VideoLockIllustration />
        </div>
        <div>
          <SectionHead id="video-title" title={c.title} lead={c.lead} />
          <ul className="s-points">
            {c.points.map((point, i) => {
              const Icon = ICONS[i]
              return (
                <li key={point.title}>
                  <span className="s-point-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="s-h3">{point.title}</h3>
                    <p>{point.desc}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
