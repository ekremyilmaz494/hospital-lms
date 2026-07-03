/**
 * İK/HBYS inbound push API (`/api/integration/v1`) — istek gövdesi zod şemaları.
 *
 * Katman ayrımı:
 *  - Buradaki şemalar ZARF kontrolü yapar (alan var mı, kaba tip doğru mu,
 *    kayıt sayısı limitte mi). Alan-düzeyi derin doğrulama (TC checksum,
 *    e-posta formatı, tarih parse) `normalize.ts`'tedir — oradaki Türkçe satır
 *    hataları route'larda 422 olarak döner.
 *  - zod v4 `z.object()` bilinmeyen anahtarları SİLER. Feed gövdeleri
 *    (`staffUpsertSchema`, `syncRequestSchema.records`) `StaffIntegration.fieldMapping`
 *    ile kaynak-sistem alan adları taşıyabilir → bu şemalar `looseObject`/`record`
 *    kullanır ki mapping'li anahtarlar normalize'a ulaşabilsin (normalize kendi
 *    whitelist'ini uygular, bilinmeyen alan DB'ye asla sızmaz).
 */
import { z } from 'zod/v4'

/** HBYS feed'leri string alanları sayı/null olarak da gönderir — normalize coerce eder. */
const looseField = z.union([z.string(), z.number(), z.null()]).optional()

/** Boolean'lar da string/sayı gelebilir ('1', 'aktif', 0 vb.) — normalize coerce eder. */
const looseBoolField = z.union([z.boolean(), z.string(), z.number(), z.null()]).optional()

const EXTERNAL_ID_REQUIRED = 'Sicil no (externalId) zorunludur'

/**
 * POST /api/integration/v1/staff — tekil personel upsert gövdesi.
 * `externalId` upsert anahtarıdır → ZORUNLU; diğer StaffRecord alanları opsiyonel.
 */
export const staffUpsertSchema = z.looseObject({
  externalId: z
    .union([z.string(), z.number()], { error: EXTERNAL_ID_REQUIRED })
    .refine(v => String(v).trim().length > 0, EXTERNAL_ID_REQUIRED),
  firstName: looseField,
  lastName: looseField,
  email: looseField,
  phone: looseField,
  tcKimlik: looseField,
  departmentName: looseField,
  departmentId: looseField,
  title: looseField,
  hireDate: looseField,
  active: looseBoolField,
})

/**
 * PATCH /api/integration/v1/staff/[externalId] — kısmi güncelleme gövdesi.
 * Kanonik alan adlarıyla gelir (fieldMapping uygulanmaz) → strip'li `z.object`.
 */
export const staffPatchSchema = z.object({
  firstName: looseField,
  lastName: looseField,
  email: looseField,
  phone: looseField,
  tcKimlik: looseField,
  departmentName: looseField,
  departmentId: looseField,
  title: looseField,
  hireDate: looseField,
  active: looseBoolField,
})

/** Tek istekte kabul edilen azami kayıt sayısı (toplu senkron). */
export const SYNC_MAX_RECORDS = 2000

/** POST /api/integration/v1/sync — toplu senkron gövdesi. */
export const syncRequestSchema = z.object({
  mode: z.enum(['snapshot', 'delta'], {
    error: "mode 'snapshot' veya 'delta' olmalıdır",
  }),
  dryRun: z.boolean({ error: 'dryRun true/false olmalıdır' }).optional().default(false),
  records: z
    .array(z.record(z.string(), z.unknown()), { error: 'records bir kayıt dizisi olmalıdır' })
    .min(1, 'records en az 1 kayıt içermelidir')
    .max(SYNC_MAX_RECORDS, `Tek istekte en fazla ${SYNC_MAX_RECORDS} kayıt gönderilebilir`),
})

export type StaffUpsertInput = z.infer<typeof staffUpsertSchema>
export type StaffPatchInput = z.infer<typeof staffPatchSchema>
export type SyncRequestInput = z.infer<typeof syncRequestSchema>

/** GET /api/integration/v1/sync-runs/[id] — geçersiz UUID Prisma'ya inmeden 404'lansın. */
export const syncRunIdSchema = z.string().uuid()

/** Satır sonucu `action` filtresi — SyncRowAction enum değerleri. */
export const rowActionFilterSchema = z.enum([
  'create', 'update', 'deactivate', 'reactivate', 'skip', 'conflict', 'error',
])

interface IssueLike {
  path: PropertyKey[]
  message: string
}

/**
 * zod hatasının ilk issue'sunu kullanıcıya gösterilebilir Türkçe mesaja çevirir
 * (`normalize.ts` satır-hata formatıyla aynı: `alan: mesaj`).
 */
export function firstIssueMessage(
  error: { issues: IssueLike[] },
  fallback = 'Geçersiz veri',
): string {
  const issue = error.issues[0]
  if (!issue) return fallback
  return issue.path.length > 0 ? `${String(issue.path[0])}: ${issue.message}` : issue.message
}
