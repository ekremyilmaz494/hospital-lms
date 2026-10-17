import type { ReactNode } from 'react'

/**
 * Bölüm başlığı: başlık + açıklama. `id` başlığa verilir; bölüm `aria-labelledby`
 * ile buna bağlanır. Eyebrow yalnız gerektiğinde (sayfada en çok 3 bölümde 1).
 */
export function SectionHead({
  id,
  title,
  lead,
  overline,
  align = 'start',
  children,
}: {
  id: string
  title: string
  lead?: string
  overline?: string
  align?: 'start' | 'center'
  children?: ReactNode
}) {
  return (
    <div className={align === 'center' ? 's-head s-head-center' : 's-head'}>
      {overline && <p className="s-overline">{overline}</p>}
      <h2 id={id} className="s-h2">
        {title}
      </h2>
      {lead && <p className="s-lead">{lead}</p>}
      {children}
    </div>
  )
}
