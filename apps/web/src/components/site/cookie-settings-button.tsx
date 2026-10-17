'use client'

import { openConsentSettings } from '@/lib/cookie-consent'

/** Alt bilgide "Çerez tercihleri": verilmiş onayı sonradan değiştirmeyi sağlar. */
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" className="s-footer-linkbtn" onClick={openConsentSettings}>
      {label}
    </button>
  )
}
