/**
 * İK/HBYS feed satırlarını `StaffRecord`'a normalize eder.
 *
 * Sıra ÖNEMLİ (zod v4 `z.object()` bilinmeyen anahtarları SİLER):
 *  1. fieldMapping HAM satıra uygulanır (kaynak alan adı → StaffRecord alanı),
 *  2. tip düzeltme (sayı→string, ''→undefined, boolean coercion),
 *  3. defaults boş alanlara doldurulur,
 *  4. zod doğrulaması (TC checksum dahil).
 * Hatalı satır koşuyu durdurmaz — `rowErrors`'a Türkçe mesajla eklenir.
 */
import { z } from 'zod/v4'
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc'
import type { NormalizeResult, NormalizeRowError, StaffRecord } from './types'

// `src/lib/validations.ts` içindeki `tcKimlikField` ile birebir aynı kural
// (o alan modül-özel/export edilmemiş olduğu için burada yeniden kuruldu):
// Mod10/Mod11 checksum (`isValidTcKimlik`), boş değer serbest, normalize edilir.
const tcKimlikField = z
  .string()
  .max(20, 'TC en fazla 20 karakter olabilir') // boşluklu girişler için tolerans
  .optional()
  .transform(val => (val ? normalizeTcKimlik(val) : val))
  .refine(val => !val || isValidTcKimlik(val), {
    message: 'Geçersiz TC Kimlik No (kontrol haneleri uyuşmuyor)',
  })

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const staffRecordSchema = z.object({
  externalId: z.string().trim().min(1).max(100, 'Sicil no en fazla 100 karakter olabilir').optional(),
  firstName: z.string().trim().min(1, 'Ad zorunludur').max(100, 'Ad en fazla 100 karakter olabilir'),
  lastName: z.string().trim().min(1, 'Soyad zorunludur').max(100, 'Soyad en fazla 100 karakter olabilir'),
  email: z.string().trim().toLowerCase().max(254)
    .regex(EMAIL_REGEX, 'Geçersiz e-posta formatı')
    .optional(),
  phone: z.string().trim().max(20, 'Telefon en fazla 20 karakter olabilir').optional(),
  tcKimlik: tcKimlikField,
  departmentName: z.string().trim().min(1).max(200, 'Departman adı en fazla 200 karakter olabilir').optional(),
  departmentId: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(100, 'Unvan en fazla 100 karakter olabilir').optional(),
  hireDate: z.string().trim()
    .refine(v => !Number.isNaN(Date.parse(v)), 'Geçersiz işe giriş tarihi (YYYY-MM-DD bekleniyor)')
    .optional(),
  active: z.boolean().optional(),
})

/** StaffRecord'un string alanları — tip düzeltme + defaults doldurma için. */
const STRING_FIELDS = [
  'externalId', 'firstName', 'lastName', 'email', 'phone', 'tcKimlik',
  'departmentName', 'departmentId', 'title', 'hireDate',
] as const

const STAFF_RECORD_KEYS: ReadonlySet<string> = new Set([...STRING_FIELDS, 'active'])

/** Ham değeri opsiyonel string'e çevirir — '' ve null "yok" sayılır, sayılar string'lenir. */
function toOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') {
    const trimmed = v.trim()
    return trimmed === '' ? undefined : trimmed
  }
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (v instanceof Date) return v.toISOString()
  return undefined
}

// HBYS feed'leri boolean'ı çoğu zaman string/sayı gönderir — bilinen değerler coerce edilir.
const TRUTHY_STRINGS = new Set(['true', '1', 'evet', 'aktif', 'active', 'yes'])
const FALSY_STRINGS = new Set(['false', '0', 'hayir', 'hayır', 'pasif', 'inactive', 'no', 'ayrildi', 'ayrıldı'])

function toOptionalBoolean(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (TRUTHY_STRINGS.has(t)) return true
    if (FALSY_STRINGS.has(t)) return false
  }
  return undefined
}

/**
 * Ham feed satırlarını doğrulanmış `StaffRecord` listesine çevirir.
 *
 * @param rawRows      Ham satırlar (push JSON body, dosya parse çıktısı veya pull API sayfası)
 * @param fieldMapping Kaynak-alan → StaffRecord-alanı eşlemesi (StaffIntegration.fieldMapping).
 *                     null/undefined = kimliksel eşleme; mapping girdisi kimlikselin üstüne yazar.
 * @param defaults     Boş kalan alanlara doldurulacak varsayılanlar (StaffIntegration.defaults)
 * @returns `records` yalnız geçerli satırlar (feed sırası korunur); `rowErrors`'ta
 *          rowIndex, `rawRows` içindeki 0-bazlı index'tir.
 */
export function normalizeRecords(
  rawRows: Record<string, unknown>[],
  fieldMapping?: Record<string, string> | null,
  defaults?: Partial<StaffRecord> | null,
): NormalizeResult {
  const records: StaffRecord[] = []
  const rowErrors: NormalizeRowError[] = []

  rawRows.forEach((raw, rowIndex) => {
    // 1. Kimliksel eşleme: kaynak zaten bizim alan adlarımızı kullanıyorsa al.
    const candidate: Record<string, unknown> = {}
    for (const key of STAFF_RECORD_KEYS) {
      if (key in raw) candidate[key] = raw[key]
    }
    // 2. fieldMapping HAM satıra uygulanır — zod strip'inden ÖNCE (mapping kazanır).
    if (fieldMapping) {
      for (const [sourceKey, destKey] of Object.entries(fieldMapping)) {
        if (!STAFF_RECORD_KEYS.has(destKey)) continue
        if (sourceKey in raw) candidate[destKey] = raw[sourceKey]
      }
    }

    // 3. Tip düzeltme — xlsx/JSON feed'leri sayı/boş string gönderebilir.
    const cleaned: Record<string, unknown> = {}
    for (const field of STRING_FIELDS) {
      const val = toOptionalString(candidate[field])
      if (val !== undefined) cleaned[field] = val
    }
    const active = toOptionalBoolean(candidate.active)
    if (active !== undefined) cleaned.active = active

    // 4. defaults yalnız BOŞ alanlara dolar (feed'deki değer her zaman kazanır).
    if (defaults) {
      for (const [key, val] of Object.entries(defaults)) {
        if (val == null || !STAFF_RECORD_KEYS.has(key)) continue
        if (cleaned[key] === undefined) cleaned[key] = val
      }
    }

    // Zorunlu alanlar (defaults sonrası hâlâ) eksikse ''e indirgenir → zod'un
    // İngilizce "invalid type" mesajı yerine Türkçe min(1) mesajı üretilir.
    if (cleaned.firstName === undefined) cleaned.firstName = ''
    if (cleaned.lastName === undefined) cleaned.lastName = ''

    // 5. zod doğrulaması — hatalı satır rowErrors'a, koşu devam eder.
    const parsed = staffRecordSchema.safeParse(cleaned)
    if (!parsed.success) {
      const message = parsed.error.issues
        .map(issue => (issue.path.length > 0 ? `${String(issue.path[0])}: ${issue.message}` : issue.message))
        .join('; ')
      rowErrors.push({ rowIndex, message: message || 'Satır doğrulanamadı' })
      return
    }

    const record: StaffRecord = { ...parsed.data }
    // normalizeTcKimlik harf-içeren girişi ''e indirger — boş TC'yi alan olarak taşıma.
    if (!record.tcKimlik) delete record.tcKimlik
    records.push(record)
  })

  return { records, rowErrors }
}
