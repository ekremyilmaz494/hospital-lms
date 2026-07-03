import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { checkFeature } from '@/lib/feature-gate'
import { checkRateLimit } from '@/lib/redis'
import { generateApiKey } from '@/lib/integration/api-key'

/**
 * İK/HBYS entegrasyonu — makine (M2M) API anahtarı yönetimi (hospital-admin).
 *
 * GET  → org'un anahtar listesi. `keyHash` ASLA döndürülmez — yalnız
 *        `keyPrefix` (log/UI'da tanıma) + meta alanlar.
 * POST → yeni anahtar üretir. Düz anahtar (`plaintext`) YALNIZ bu yanıtta
 *        bir kez döner; DB'de sadece SHA-256 hash saklanır, geri getirilemez.
 */

// perf-check: no-cache-invalidation — anahtar listesi Redis'te cache'lenmiyor;
// GET yalnız HTTP Cache-Control (private, max-age=30) kullanır.
const FEATURE_DISABLED_MSG = 'Personel entegrasyonu planınızda etkin değil.'

/** Org başına aktif (revoke edilmemiş) anahtar üst sınırı. */
const MAX_ACTIVE_KEYS = 10

const createKeySchema = z.object({
  name: z.string({ error: 'Anahtar adı zorunludur' }).trim()
    .min(1, 'Anahtar adı boş olamaz')
    .max(100, 'Anahtar adı en fazla 100 karakter olabilir'),
  expiresAt: z.string().datetime({ offset: true, message: 'Geçerli bir ISO tarih girin' }).optional(),
})

// GET /api/admin/integration/keys — anahtar listesi (hash ASLA dönmez)
export const GET = withAdminRoute(async ({ organizationId }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  const keys = await prisma.integrationApiKey.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return jsonResponse(
    { keys },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })

// POST /api/admin/integration/keys — yeni anahtar üret
export const POST = withAdminRoute(async ({ request, organizationId, dbUser, audit }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  const allowed = await checkRateLimit(`integration-keys:${organizationId}`, 10, 3600)
  if (!allowed) {
    return errorResponse('Çok fazla anahtar üretme denemesi yapıldı. Lütfen daha sonra tekrar deneyin.', 429)
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return errorResponse('Geçerlilik tarihi gelecekte olmalıdır', 400)
  }

  // Kota guard'ı create'e bağımlı sıra (bilinçli ardışık) — Promise.all edilemez.
  const activeCount = await prisma.integrationApiKey.count({ // perf-check-disable-line
    where: { organizationId, revokedAt: null },
  })
  if (activeCount >= MAX_ACTIVE_KEYS) {
    return errorResponse(`En fazla ${MAX_ACTIVE_KEYS} aktif anahtar oluşturulabilir. Yenisi için önce bir anahtarı iptal edin.`, 409)
  }

  // Düz anahtar DB'ye YAZILMAZ — yalnız prefix + SHA-256 hash saklanır.
  const generated = generateApiKey()

  const created = await prisma.integrationApiKey.create({
    data: {
      organizationId,
      name: parsed.data.name,
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
      expiresAt,
      createdById: dbUser.id,
    },
    select: { id: true, name: true, keyPrefix: true, expiresAt: true, createdAt: true },
  })

  // Audit'e plaintext/hash ASLA yazılmaz — yalnız tanıma amaçlı keyPrefix.
  await audit({
    action: 'integration.key.create',
    entityType: 'integration_api_key',
    entityId: created.id,
    newData: { name: created.name, keyPrefix: created.keyPrefix, expiresAt: created.expiresAt },
  })

  // DİKKAT: `plaintext` YALNIZ bu yanıtta bir kez görünür — DB'de hash
  // saklandığı için kaybedilen anahtar geri getirilemez, yenisi üretilir.
  return jsonResponse(
    {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
      plaintext: generated.plaintext,
    },
    201,
  )
}, { requireOrganization: true })
