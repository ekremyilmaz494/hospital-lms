import type { ReactNode } from 'react'
import { PageHead } from './page-head'

export interface LegalSection {
  /** Çapa kimliği (ASCII, kebab-case). Bölümün `<h2 id>`'siyle aynı olmalı. */
  id: string
  label: string
}

/**
 * Hukuki metin düzeni: başlık + yapışkan içindekiler + `.s-prose` gövde.
 * Gövde Server Component'tir; bölümler `<h2 id={section.id}>` ile başlar.
 */
export function LegalPage({
  title,
  lead,
  updated,
  sections,
  breadcrumbPath,
  children,
}: {
  title: string
  lead?: ReactNode
  /** Görünen tarih metni, örn. "8 Temmuz 2026". */
  updated?: string
  sections?: readonly LegalSection[]
  /** Kanonik yol (BreadcrumbList JSON-LD için). */
  breadcrumbPath?: string
  children: ReactNode
}) {
  return (
    <>
      <PageHead
        title={title}
        lead={lead}
        meta={updated ? `Son güncelleme: ${updated}` : undefined}
        breadcrumbPath={breadcrumbPath}
      />
      <div className="s-container s-page-body">
        {sections && sections.length > 0 ? (
          <div className="s-legal">
            <nav className="s-toc" aria-label="İçindekiler">
              <p className="s-toc-title">İçindekiler</p>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <article className="s-prose">{children}</article>
          </div>
        ) : (
          <article className="s-prose">{children}</article>
        )}
      </div>
    </>
  )
}
