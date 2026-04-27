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
const CACHE_KEY = 'org-branding:v1'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 dakika

function applyBrandingVars(b: LayoutBranding) {
  const root = document.documentElement
  if (b.brandColor) root.style.setProperty('--brand-primary', b.brandColor)
  if (b.secondaryColor) root.style.setProperty('--brand-secondary', b.secondaryColor)
}

function readCache(): LayoutBranding | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; data: LayoutBranding }
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
    return parsed.data
  } catch { return null }
}

export function useLayoutBranding() {
  const [branding, setBranding] = useState<LayoutBranding | null>(() => readCache())

  useEffect(() => {
    // Cache hit → CSS değişkenlerini hemen uygula, fetch atlanır.
    // Sayfa geçişleri arasında /api/auth/org-branding çağrısı yapılmaz (5dk TTL).
    if (branding) {
      applyBrandingVars(branding)
      return
    }

    let cancelled = false
    fetch('/api/auth/org-branding')
      .then((res) => res.ok ? res.json() : null)
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
        applyBrandingVars(b)
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: b }))
        } catch {}
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [branding])

  return branding
}
