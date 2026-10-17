'use client'

import { useEffect } from 'react'

/** Adım, ekranın ortasındaki şeride girince etkin sayılır. */
const ACTIVE_BAND = '-45% 0px -45% 0px'

/**
 * "Nasıl çalışır" rayında etkin adımı işaretler (`data-active`). Yalnız görsel
 * vurgu: içerik ve sıra JS olmadan da tam okunur. Ray ekran okuyucudan gizli.
 */
export function FlowProgress() {
  useEffect(() => {
    const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-flow-step]'))
    const rail = Array.from(document.querySelectorAll<HTMLElement>('.s-flow-rail [data-step]'))
    if (!steps.length || !('IntersectionObserver' in window)) return

    const setActive = (index: string) => {
      for (const item of rail) item.toggleAttribute('data-active', item.dataset.step === index)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.flowStep ?? '0')
        }
      },
      { rootMargin: ACTIVE_BAND },
    )
    steps.forEach((step) => observer.observe(step))
    setActive('0')
    return () => observer.disconnect()
  }, [])

  return null
}
