import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { checkFeature } from '@/lib/feature-gate'
import { checkRateLimit } from '@/lib/redis'
import { encrypt } from '@/lib/crypto'

/**
 * İK/HBYS personel entegrasyonu — kanal yapılandırması (hospital-admin).
 *
 * GET  → org'un tüm kanal config'leri (push/file/pull). Credentials ASLA
 *        döndürülmez — yalnız `pullCredentialsSet: boolean` maskesi.
 * PUT  → kanal config upsert (org + channel benzersiz). pullCredentials
 *        verilirse AES-256-GCM ile şifrelenip saklanır; verilmezse mevcut
 *        değer KORUNUR.
 */

// perf-check: no-cache-invalidation — entegrasyon config'i Redis'te cache'lenmiyor;
// GET yalnız HTTP Cache-Control (private, max-age=30) kullanır.
const FEATURE_DISABLED_MSG = 'Personel entegrasyonu planınızda etkin değil.'

// GET/PUT yanıtlarında dönen alanlar — pullCredentialsEncrypted yalnız
// `pullCredentialsSet` maskesine dönüştürülmek için çekilir, HAM DEĞER ASLA
// yanıt gövdesine yazılmaz (toClientConfig strip'ler).
const integrationSelect = {
  id: true,
  channel: true,
  isActive: true,
  syncMode: true,
  fieldMapping: true,
  defaults: true,
  deactivateMissing: true,
  deactivateThresholdPct: true,
  pullBaseUrl: true,
  pullAuthType: true,
  pullCredentialsEncrypted: true,
  pullIntervalMinutes: true,
  pullPagination: true,
  lastRunAt: true,
  lastRunStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffIntegrationSelect

type IntegrationRow = Prisma.StaffIntegrationGetPayload<{ select: typeof integrationSelect }>

/** Şifreli credential'ı boolean maskeye çevirir — ham/şifreli değer yanıtta sızmaz. */
function toClientConfig(row: IntegrationRow) {
  const { pullCredentialsEncrypted: creds, ...rest } = row
  return { ...rest, pullCredentialsSet: creds !== null }
}

// Sayfalama stratejisi (pull kanalı) — model yorumundaki sözleşmeyle aynı.
const pullPaginationSchema = z.object({
  style: z.enum(['page', 'offset', 'cursor'], { error: 'Geçerli bir sayfalama stili seçin' }),
  pageParam: z.string().min(1).max(50).optional(),
  sizeParam: z.string().min(1).max(50).optional(),
  pageSize: z.number().int().min(1).max(1000).optional(),
  itemsPath: z.string().min(1).max(200).optional(),
  cursorPath: z.string().min(1).max(200).optional(),
})

// Pull kanalı kimlik bilgisi — üç auth tipine karşılık üç şekil.
const pullCredentialsSchema = z.union([
  z.object({ token: z.string().min(1).max(1000) }),
  z.object({ username: z.string().min(1).max(255), password: z.string().min(1).max(255) }),
  z.object({ headerName: z.string().min(1).max(100), key: z.string().min(1).max(1000) }),
])

// DİKKAT (zod v4): z.object() şemada olmayan anahtarları SİLER — yeni config
// alanı eklerken buraya da eklemeyi unutma, yoksa route alanı hiç görmez.
const configPutSchema = z.object({
  channel: z.enum(['push', 'file', 'pull'], { error: 'Geçerli bir kanal seçin (push, file, pull)' }),
  isActive: z.boolean().optional(),
  syncMode: z.enum(['delta', 'snapshot'], { error: 'Geçerli bir senkron modu seçin (delta, snapshot)' }).optional(),
  fieldMapping: z.record(z.string().max(100), z.string().max(100)).nullable().optional(),
  defaults: z.record(z.string().max(100), z.union([z.string().max(500), z.number(), z.boolean()])).nullable().optional(),
  deactivateMissing: z.boolean().optional(),
  deactivateThresholdPct: z.number({ error: 'Deaktivasyon eşiği sayı olmalıdır' }).int().min(5, 'Deaktivasyon eşiği en az %5 olmalıdır').max(100, 'Deaktivasyon eşiği en fazla %100 olabilir').optional(),
  pullBaseUrl: z.string().url('Geçerli bir URL girin').max(500)
    .refine((u) => u.startsWith('https://'), 'Pull adresi https:// ile başlamalıdır')
    .optional(),
  pullAuthType: z.enum(['bearer', 'basic', 'header_key'], { error: 'Geçerli bir kimlik doğrulama tipi seçin' }).optional(),
  pullCredentials: pullCredentialsSchema.optional(),
  pullIntervalMinutes: z.number({ error: 'Sorgu aralığı sayı olmalıdır' }).int().min(15, 'Sorgu aralığı en az 15 dakika olmalıdır').max(1440, 'Sorgu aralığı en fazla 1440 dakika olabilir').optional(),
  pullPagination: pullPaginationSchema.nullable().optional(),
})

// GET /api/admin/integration — org'un tüm kanal yapılandırmaları
export const GET = withAdminRoute(async ({ organizationId }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  const integrations = await prisma.staffIntegration.findMany({
    where: { organizationId },
    select: integrationSelect,
    orderBy: { channel: 'asc' },
  })

  return jsonResponse(
    { integrations: integrations.map(toClientConfig) },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })

// PUT /api/admin/integration — kanal config upsert
export const PUT = withAdminRoute(async ({ request, organizationId, audit }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  const allowed = await checkRateLimit(`integration-config:${organizationId}`, 30, 3600)
  if (!allowed) {
    return errorResponse('Çok fazla yapılandırma değişikliği yapıldı. Lütfen daha sonra tekrar deneyin.', 429)
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = configPutSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const input = parsed.data
  const { channel } = input

  // Eski config'i audit oldData + 200/201 ayrımı için çek — upsert'e bağımlı
  // sıra (bilinçli ardışık), Promise.all edilemez.
  const existing = await prisma.staffIntegration.findUnique({ // perf-check-disable-line
    where: { organizationId_channel: { organizationId, channel } },
    select: integrationSelect,
  })

  // Yalnız gönderilen alanlar güncellenir; pullCredentials verilmezse mevcut
  // şifreli değer KORUNUR (update data'da alan hiç yer almaz).
  const update: Prisma.StaffIntegrationUncheckedUpdateInput = {}
  if (input.isActive !== undefined) update.isActive = input.isActive
  if (input.syncMode !== undefined) update.syncMode = input.syncMode
  if (input.fieldMapping !== undefined) update.fieldMapping = input.fieldMapping ?? Prisma.DbNull
  if (input.defaults !== undefined) update.defaults = input.defaults ?? Prisma.DbNull
  if (input.deactivateMissing !== undefined) update.deactivateMissing = input.deactivateMissing
  if (input.deactivateThresholdPct !== undefined) update.deactivateThresholdPct = input.deactivateThresholdPct
  if (input.pullBaseUrl !== undefined) update.pullBaseUrl = input.pullBaseUrl
  if (input.pullAuthType !== undefined) update.pullAuthType = input.pullAuthType
  if (input.pullIntervalMinutes !== undefined) update.pullIntervalMinutes = input.pullIntervalMinutes
  if (input.pullPagination !== undefined) update.pullPagination = input.pullPagination ?? Prisma.DbNull
  if (input.pullCredentials !== undefined) {
    // AES-256-GCM — düz credential DB'ye ASLA yazılmaz.
    update.pullCredentialsEncrypted = encrypt(JSON.stringify(input.pullCredentials))
  }

  const result = await prisma.staffIntegration.upsert({
    where: { organizationId_channel: { organizationId, channel } },
    create: {
      organizationId,
      channel,
      isActive: input.isActive ?? true,
      syncMode: input.syncMode ?? 'delta',
      fieldMapping: input.fieldMapping ?? Prisma.DbNull,
      defaults: input.defaults ?? Prisma.DbNull,
      deactivateMissing: input.deactivateMissing ?? false,
      deactivateThresholdPct: input.deactivateThresholdPct ?? 20,
      pullBaseUrl: input.pullBaseUrl ?? null,
      pullAuthType: input.pullAuthType ?? null,
      pullCredentialsEncrypted: input.pullCredentials !== undefined
        ? encrypt(JSON.stringify(input.pullCredentials))
        : null,
      pullIntervalMinutes: input.pullIntervalMinutes ?? null,
      pullPagination: input.pullPagination ?? Prisma.DbNull,
    },
    update,
    select: integrationSelect,
  })

  // Audit'e şifreli/düz credential ASLA yazılmaz — iki taraf da maskelenir.
  await audit({
    action: 'integration.config.update',
    entityType: 'staff_integration',
    entityId: result.id,
    oldData: existing ? toClientConfig(existing) : null,
    newData: toClientConfig(result),
  })

  return jsonResponse(toClientConfig(result), existing ? 200 : 201)
}, { requireOrganization: true })
