'use client'

import { useEffect, useState } from 'react'

/** Authenticated layout'larda organizasyon branding bilgileri */
export interface LayoutBranding {
  orgName: string
  orgCode: string
  orgLogoUrl: string | null
  brandColor: string
  secondaryColor: string
}

/**
 * Authenticated kullanicilar icin organizasyon branding'ini ceker.
 * CSS custom property'leri (--brand-primary, --brand-secondary) dinamik olarak gunceller.
 */
export function useLayoutBranding() {
  const [branding, setBranding] = useState<LayoutBranding | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/org-branding')
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (cancelled || !data || data.error) return

        const b: LayoutBranding = {
          orgName: data.name ?? '',
          orgCode: data.code ?? '',
          orgLogoUrl: data.logoUrl ?? null,
          brandColor: data.brandColor ?? '#0F172A',
          secondaryColor: data.secondaryColor ?? '#3B82F6',
        }
        setBranding(b)

        // CSS custom property'leri guncelle
        const root = document.documentElement
        if (b.brandColor) {
          root.style.setProperty('--brand-primary', b.brandColor)
        }
        if (b.secondaryColor) {
          root.style.setProperty('--brand-secondary', b.secondaryColor)
        }
      })
      .catch(() => {
        // Branding yuklenemezse sessizce devam et — varsayilan renkler kullanilir
      })

    return () => {
      cancelled = true
    }
  }, [])

  return branding
}
