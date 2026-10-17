'use client'

import { useEffect } from 'react'
import { captureAttribution } from '@/lib/attribution'

/** Oturumun ilk açılışındaki UTM/referrer'ı sessionStorage'a yazar (bkz. lib/attribution). */
export function SiteAttribution() {
  useEffect(() => {
    captureAttribution()
  }, [])
  return null
}
