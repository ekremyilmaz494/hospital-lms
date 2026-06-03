'use client';

import { useEffect } from 'react';
import { useMobile } from '@/hooks/use-mobile';

/**
 * Mobil-only (≤768px) zarif scroll-reveal motoru.
 *
 * `.l3d-reveal` öğeleri viewport'a girince `.is-in` sınıfı eklenir; gizli başlangıç
 * durumu CSS'te `html.l3d-anim-ready .l3d-reveal` ile gated (bkz. landing-3d.css ≤768).
 * Gate sınıfı paint'ten önce page.tsx inline script'i tarafından eklenir → FOUC yok.
 *
 * Desktop'ta `useMobile` false → hiçbir şey yapmaz; gate sınıfı da yoktur → 3D akış
 * ve içerik aynen görünür kalır. IntersectionObserver yoksa veya reduced-motion'da
 * gate hiç eklenmez/içerik görünür kalır (fail-safe: asla "görünmez takılı" kalmaz).
 *
 * Viewport'ta zaten olan öğeler (hero) mount'ta hemen reveal olur → hero giriş animasyonu.
 */
export function MobileReveal() {
  const isMobile = useMobile(768);

  useEffect(() => {
    if (!isMobile) return;
    const root = document.documentElement;
    // Gate yoksa (reduced-motion → inline script eklemedi) hiç gizlenmemiştir; çık.
    if (!root.classList.contains('l3d-anim-ready')) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>('.l3d-reveal'));
    if (els.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isMobile]);

  return null;
}
