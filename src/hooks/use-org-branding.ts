'use client'

import { useEffect, useState } from 'react'

/** Organizasyon branding verisi (public API'den doner) */
export interface OrgBranding {
  name: string
  logoUrl: string | null
  brandColor: string
  secondaryColor: string
  loginBannerUrl: string | null
}

/**
 * Public API'den organizasyon branding bilgilerini ceker.
 * CSS custom property'leri (:root) dinamik olarak gunceller.
 *
 * @param slug - Organizasyon kodu (code). null/undefined ise istek yapilmaz.
 */
export function useOrgBranding(slug: string | null | undefined) {
  const [branding, setBranding] = useState<OrgBranding | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!slug) return

    let cancelled = false
    setLoading(true)

    fetch(`/api/public/organization/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Branding yuklenemedi')
        return res.json()
      })
      .then((data: OrgBranding) => {
        if (cancelled) return
        setBranding(data)

        // CSS custom property'leri guncelle
        const root = document.documentElement
        if (data.brandColor) {
          root.style.setProperty('--brand-primary', data.brandColor)
        }
        if (data.secondaryColor) {
          root.style.setProperty('--brand-secondary', data.secondaryColor)
        }
      })
      .catch(() => {
        // Branding yuklenemezse sessizce devam et — varsayilan renkler kullanilir
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  return { branding, loading }
}
