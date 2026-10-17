import type { ReactNode } from 'react'
import { BreadcrumbJsonLd } from './breadcrumb-jsonld'

/**
 * İç sayfa başlığı: isteğe bağlı üst etiket, tek `<h1>`, açıklama ve meta satırı
 * (örn. "Son güncelleme: 8 Temmuz 2026"). Sayfa başına bir kez kullanılır.
 * `breadcrumbPath` verilirse Ana sayfa → sayfa BreadcrumbList JSON-LD'si de basılır.
 */
export function PageHead({
  overline,
  title,
  lead,
  meta,
  breadcrumbPath,
  children,
}: {
  overline?: string
  title: string
  lead?: ReactNode
  meta?: ReactNode
  /** Sayfanın kanonik yolu, örn. `/guvenlik` (yapısal veri için). */
  breadcrumbPath?: string
  children?: ReactNode
}) {
  return (
    <header className="s-page-head">
      {breadcrumbPath && <BreadcrumbJsonLd name={title} path={breadcrumbPath} />}
      <div className="s-container">
        {overline && <p className="s-overline">{overline}</p>}
        <h1 className="s-h1">{title}</h1>
        {lead && <p className="s-lead">{lead}</p>}
        {meta && <p className="s-page-meta">{meta}</p>}
        {children}
      </div>
    </header>
  )
}
