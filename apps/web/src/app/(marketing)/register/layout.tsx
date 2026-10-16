import type { Metadata } from 'next'

// İstemci sayfası metadata export edemez; noindex buradan gelir (sitemap'te de yok).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function NoindexLayout({ children }: { children: React.ReactNode }) {
  return children
}
