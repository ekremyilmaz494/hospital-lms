import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'

/**
 * Kök 404. Kök layout'ta render edilir (pazarlama layout'u buraya sarmaz), bu yüzden
 * site kabuğunu kendisi verir: üst bar + `<main>` + alt bilgi.
 */
export default function NotFound() {
  return (
    <SiteShell>
      <section className="s-section" aria-labelledby="bulunamadi-title">
        <div className="s-container">
          <div className="s-head s-head-center">
            <p className="s-overline">404</p>
            <h1 id="bulunamadi-title" className="s-h1">
              Sayfa bulunamadı
            </h1>
            <p className="s-lead">Aradığınız sayfa kaldırılmış, adresi değişmiş veya hiç var olmamış olabilir.</p>
          </div>
          <div className="s-cta-row">
            <Link href="/" className="s-btn s-btn-primary">
              Ana sayfaya dön
            </Link>
            <Link href="/iletisim" className="s-btn s-btn-ghost">
              İletişim
            </Link>
          </div>
          <div className="s-head s-head-center s-mt-lg">
            <Link href="/auth/login" prefetch={false} className="s-link-quiet">
              Giriş yap
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
