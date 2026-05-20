import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Türkçe-duyarlı arama yardımcısı.
 *
 * **Sorun:** Postgres `lower('İ')` Unicode tam case-folding ile `'i̇'` (i +
 * U+0307 birleşik nokta) üretir. Bu yüzden Prisma'nın `contains` +
 * `mode: 'insensitive'` (ILIKE) sorgusu Türkçe büyük harfleri katlayamaz —
 * `'İBRAHİM'` ile `'ibrahim'` eşleşmez. (DB collation: `en_US.UTF-8`)
 *
 * **Çözüm:** `translate()` ile Türkçe harfleri ASCII'ye sabitleyip (aksan +
 * harf duyarsız) karşılaştırıyoruz. Route'lar dönen id listesini
 * `where.id = { in: ... }` ile kullanır; sayfalama/select/count yapısı
 * bozulmadan kalır.
 *
 * @example
 *   if (search) {
 *     where.id = { in: await turkishSearchIds('users', ['first_name', 'last_name'], search, orgId) }
 *   }
 */

// Türkçe büyük + küçük harfler → ASCII karşılıkları (Postgres translate() için).
// İ I ı → i · Ş ş → s · Ç ç → c · Ğ ğ → g · Ü ü → u · Ö ö → o
const TR_FROM = 'İIıŞşÇçĞğÜüÖö'
const TR_TO = 'iiissccgguuoo'

/** SQL identifier doğrula + tırnakla — yalnızca SABİT literal isimler için. */
function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`turkishSearchIds: geçersiz SQL identifier "${name}"`)
  }
  return `"${name}"`
}

/**
 * Verilen tabloda, belirtilen kolonlarda Türkçe-duyarlı arama yapar ve
 * eşleşen kayıtların `id` değerlerini döndürür.
 *
 * @param table   Tablo adı — SABİT literal ver (asla kullanıcı girdisi)
 * @param columns Aranacak kolon adları — SABİT literal'ler
 * @param search  Kullanıcının arama metni
 * @param orgId   Verilirse `organization_id` ile sınırlandırır (multi-tenant)
 */
export async function turkishSearchIds(
  table: string,
  columns: string[],
  search: string,
  orgId?: string | null,
): Promise<string[]> {
  const trimmed = search.trim()
  if (!trimmed || columns.length === 0) return []

  // LIKE joker karakterleri (% _ \) bind param içinde literal kalsın diye kaçır.
  const likeArg = trimmed.replace(/[\\%_]/g, '\\$&')

  // coalesce("c1"::text,'') || ' ' || coalesce("c2"::text,'') ...
  const concat = Prisma.raw(
    columns.map((c) => `coalesce(${quoteIdent(c)}::text, '')`).join(` || ' ' || `),
  )
  const tableRaw = Prisma.raw(quoteIdent(table))
  const orgFilter =
    orgId != null ? Prisma.sql`organization_id = ${orgId}::uuid AND ` : Prisma.empty

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM ${tableRaw}
    WHERE ${orgFilter}lower(translate(${concat}, ${TR_FROM}, ${TR_TO}))
          LIKE '%' || lower(translate(${likeArg}, ${TR_FROM}, ${TR_TO})) || '%'
  `)

  return rows.map((r) => r.id)
}
