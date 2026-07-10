import { XMLParser } from 'fast-xml-parser'
import type { ScormVersion } from './timespan'

/**
 * Parsed `imsmanifest.xml` özeti — ingest'in Training satırına yazacağı alanlar.
 */
export interface ParsedManifest {
  /** SCORM sürümü — player'ın 1.2 (window.API) vs 2004 (window.API_1484_11) seçimi. */
  version: ScormVersion
  /** Başlatılacak dosya, manifest DİZİNİNE göreli (ör. `index.html`, `content/start.html`). */
  entryHref: string
  /** 0-100 geçme eşiği (varsa). 1.2 `adlcp:masteryscore`; 2004 `minNormalizedMeasure`×100. */
  masteryScore: number | null
}

export class ScormManifestError extends Error {}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // adlcp:, imsss:, xml: gibi namespace önekleri kaldırılır → alan/attribute erişimi
  // authoring aracından bağımsız olur (adlcp:masteryscore → masteryscore).
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
})

/** fast-xml-parser tek çocuğu obje, çok çocuğu dizi döner — daima diziye normalize et. */
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

/** Bir düğümden metin içeriğini çıkar (fast-xml-parser `#text` veya düz string). */
function textOf(node: unknown): string {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)['#text'] ?? '')
  }
  return ''
}

/** `<item>` ağacında identifierref taşıyan İLK öğeyi derinlik-öncelikli bul (başlatılabilir SCO). */
function findFirstLaunchableItem(
  items: Record<string, unknown>[],
): Record<string, unknown> | null {
  for (const item of items) {
    if (item['@_identifierref']) return item
    const children = toArray(item['item'] as Record<string, unknown> | Record<string, unknown>[])
    const nested = findFirstLaunchableItem(children)
    if (nested) return nested
  }
  return null
}

/** Sürümü şema metninden, olmazsa namespace'ten tespit et (belirsizse 1.2). */
function detectVersion(manifest: Record<string, unknown>): ScormVersion {
  const metadata = manifest['metadata'] as Record<string, unknown> | undefined
  const schemaversion = textOf(metadata?.['schemaversion']).toLowerCase()
  if (schemaversion) {
    if (schemaversion.includes('1.2')) return '1.2'
    if (schemaversion.includes('2004') || schemaversion.includes('cam 1.3') || schemaversion.includes('1.3')) {
      return '2004'
    }
  }
  // Namespace ipucu: adlcp_v1p3 / imsss → 2004.
  const raw = JSON.stringify(manifest).toLowerCase()
  if (raw.includes('adlcp_v1p3') || raw.includes('imsss')) return '2004'
  return '1.2'
}

/** Göreli yol parçalarını `/` ile birleştir, `./` ve boşları temizle. */
function joinBase(...parts: (string | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p && p !== '.')
    .join('/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\.?\//, '')
}

/**
 * `imsmanifest.xml` içeriğini (string) parse eder; sürüm + başlatma dosyası + geçme
 * eşiğini döner. Geçersiz/eksik yapıda `ScormManifestError` fırlatır.
 */
export function parseScormManifest(xml: string): ParsedManifest {
  let doc: Record<string, unknown>
  try {
    doc = parser.parse(xml) as Record<string, unknown>
  } catch {
    throw new ScormManifestError('imsmanifest.xml ayrıştırılamadı')
  }

  const manifest = doc['manifest'] as Record<string, unknown> | undefined
  if (!manifest) throw new ScormManifestError('Geçersiz manifest: <manifest> kök öğesi yok')

  const version = detectVersion(manifest)

  // organizations.default → o organization; yoksa ilk organization.
  const organizations = manifest['organizations'] as Record<string, unknown> | undefined
  const orgList = toArray(organizations?.['organization'] as Record<string, unknown> | Record<string, unknown>[])
  if (orgList.length === 0) {
    throw new ScormManifestError('Geçersiz manifest: <organization> yok')
  }
  const defaultOrgId = organizations?.['@_default']
  const org =
    orgList.find((o) => o['@_identifier'] === defaultOrgId) ?? orgList[0]

  const items = toArray(org['item'] as Record<string, unknown> | Record<string, unknown>[])
  const launchItem = findFirstLaunchableItem(items)
  if (!launchItem) {
    throw new ScormManifestError('Başlatılabilir SCO (identifierref) bulunamadı')
  }
  const resourceId = launchItem['@_identifierref']

  // resources → eşleşen resource → href.
  const resources = manifest['resources'] as Record<string, unknown> | undefined
  const resList = toArray(resources?.['resource'] as Record<string, unknown> | Record<string, unknown>[])
  const resource = resList.find((r) => r['@_identifier'] === resourceId)
  if (!resource) {
    throw new ScormManifestError('SCO kaynağı (resource) bulunamadı')
  }
  const href = textOf(resource['@_href']) || String(resource['@_href'] ?? '')
  if (!href) {
    throw new ScormManifestError('SCO kaynağının href değeri yok')
  }

  // xml:base zincirini birleştir (manifest → resources → resource → href).
  const entryHref = joinBase(
    manifest['@_base'] as string | undefined,
    resources?.['@_base'] as string | undefined,
    resource['@_base'] as string | undefined,
    href,
  )

  // Geçme eşiği: 1.2 adlcp:masteryscore (0-100) | 2004 minNormalizedMeasure (0-1).
  let masteryScore: number | null = null
  const rawMastery = textOf(launchItem['masteryscore'])
  if (rawMastery) {
    const n = parseFloat(rawMastery)
    if (!Number.isNaN(n)) masteryScore = Math.round(n)
  }
  if (masteryScore === null) {
    // 2004: <imsss:sequencing><imsss:objectives><...minNormalizedMeasure>0.8</...>
    const measure = findMinNormalizedMeasure(launchItem)
    if (measure !== null) masteryScore = Math.round(measure * 100)
  }
  if (masteryScore !== null) {
    masteryScore = Math.max(0, Math.min(100, masteryScore))
  }

  return { version, entryHref, masteryScore }
}

/** 2004 sequencing ağacında minNormalizedMeasure (0-1) değerini derinlemesine ara. */
function findMinNormalizedMeasure(node: unknown): number | null {
  if (!node || typeof node !== 'object') return null
  const obj = node as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'minNormalizedMeasure') {
      const n = parseFloat(textOf(value))
      if (!Number.isNaN(n)) return n
    }
    if (value && typeof value === 'object') {
      const nested = findMinNormalizedMeasure(value)
      if (nested !== null) return nested
    }
  }
  return null
}
