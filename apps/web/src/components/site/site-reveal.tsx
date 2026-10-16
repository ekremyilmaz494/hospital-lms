'use client'

import { useEffect } from 'react'

/** Görünürlük eşiği: öğenin %20'si ekrana girince çizim başlar. */
const REVEAL_THRESHOLD = 0.2

/**
 * `[data-reveal]` öğelerine görünür olduklarında `data-in` verir; `site.css`
 * buna göre `s-draw` / `s-pop` / `s-fade` geçişlerini oynatır.
 *
 * İçerik varsayılan GÖRÜNÜR: gizleme yalnız bu bileşen `<html>`'e `s-reveal-on`
 * ekledikten sonra başlar. JS yoksa, IntersectionObserver yoksa veya kullanıcı
 * hareketi azaltmayı seçtiyse hiçbir şey gizlenmez. Sayfa başına bir kez render edilir.
 */
export function SiteReveal() {
  useEffect(() => {
    const root = document.documentElement
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const reveal = (el: Element) => el.setAttribute('data-in', '')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          reveal(entry.target)
          observer.unobserve(entry.target)
        }
      },
      { threshold: REVEAL_THRESHOLD },
    )

    const targets = Array.from(document.querySelectorAll('[data-reveal]:not([data-in])'))
    // İlk ekrandakileri gizlemeden önce işaretle: ilk boyamada yanıp sönme olmasın.
    for (const el of targets) {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) reveal(el)
      else observer.observe(el)
    }
    root.classList.add('s-reveal-on')

    // Yazdırırken (ve PDF'e kaydederken) görülmemiş bölümler boş çıkmasın.
    const revealAll = () => document.querySelectorAll('[data-reveal]:not([data-in])').forEach(reveal)
    window.addEventListener('beforeprint', revealAll)

    return () => {
      observer.disconnect()
      window.removeEventListener('beforeprint', revealAll)
      root.classList.remove('s-reveal-on')
    }
  }, [])

  return null
}
