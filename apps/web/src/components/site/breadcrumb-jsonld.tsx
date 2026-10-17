import { breadcrumbJsonLd } from '@/lib/organization-jsonld'

/** İç sayfa BreadcrumbList JSON-LD'si (Ana sayfa → sayfa). Statik veri, kullanıcı girdisi yok. */
export function BreadcrumbJsonLd({ name, path }: { name: string; path: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd([{ name, path }]) }}
    />
  )
}
