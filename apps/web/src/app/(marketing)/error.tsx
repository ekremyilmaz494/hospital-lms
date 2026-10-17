'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { reportBoundaryError } from '@/lib/report-boundary-error'

/**
 * Pazarlama sayfalarının hata sınırı. Site kabuğu (üst bar + alt bilgi) layout'tan gelir;
 * burada yalnız `<main>` içeriği değişir.
 */
export default function MarketingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  /** Next 16.2+: segmenti yeniden çekip render eder (`reset` yeniden çekmez; sunucu hatası olduğu gibi kalır). */
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Sentry (bulut) + /api/telemetry/client-error (air-gap on-prem → docker logs). Bkz.
    // report-boundary-error.ts (alanlar kısaltılır → route'un 4KB kapısına takılmaz).
    reportBoundaryError(error)
  }, [error])

  return (
    <section className="s-section" aria-labelledby="hata-title">
      <div className="s-container">
        <div className="s-head s-head-center" role="alert">
          <h1 id="hata-title" className="s-h2">
            Bir sorun oluştu
          </h1>
          <p className="s-lead">Sayfa yüklenirken beklenmeyen bir hata meydana geldi. Lütfen tekrar deneyin.</p>
          {error.digest && <p className="s-page-meta">{`Hata kodu: ${error.digest}`}</p>}
        </div>
        <div className="s-cta-row">
          <button type="button" onClick={() => unstable_retry()} className="s-btn s-btn-primary">
            Tekrar dene
          </button>
          <Link href="/" className="s-btn s-btn-ghost">
            Ana sayfa
          </Link>
        </div>
      </div>
    </section>
  )
}
