import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, ApiError } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { verifyLicenseJwt, LicenseVerifyError } from '@/lib/license/verify'

/**
 * Super-admin lisans yönetimi — lisans sunucusunun kayıt/izleme yüzü.
 *
 * Kayıt akışı: lisans JWT'si offline CLI (tools/license-cli) ile imzalanır,
 * super-admin buraya yapıştırır. Kayıt olmadan on-prem aktivasyon/heartbeat
 * uçları lisansı TANIMAZ — kayıt, iptal ve izlemenin kontrol noktasıdır.
 */

/** GET /api/super-admin/licenses — lisans listesi + aktivasyon/heartbeat özeti */
export const GET = withSuperAdminRoute(async () => {
  const licenses = await prisma.license.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      customerName: true,
      contactEmail: true,
      licenseType: true,
      maxOrganizations: true,
      maxStaff: true,
      graceDays: true,
      validUntil: true,
      status: true,
      revokedAt: true,
      createdAt: true,
      _count: { select: { activations: true } },
      heartbeats: {
        orderBy: { receivedAt: 'desc' },
        take: 1,
        select: { receivedAt: true, orgCount: true, staffCount: true, appVersion: true },
      },
    },
  })

  return jsonResponse(
    {
      licenses: licenses.map((l) => ({
        ...l,
        heartbeats: undefined,
        activationCount: l._count.activations,
        lastHeartbeat: l.heartbeats[0] ?? null,
        _count: undefined,
      })),
    },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
})

const registerSchema = z.object({
  licenseJwt: z.string().min(20),
  contactEmail: z.string().email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

/** POST /api/super-admin/licenses — CLI ile imzalanmış lisans JWT'sini kaydet/güncelle */
export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const rateOk = await checkRateLimit(`license-register:${dbUser.id}`, 20, 3600)
  if (!rateOk) throw new ApiError('Çok fazla istek. Lütfen daha sonra deneyin.', 429)

  const body = await parseBody<z.infer<typeof registerSchema>>(request)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) throw new ApiError('Geçersiz istek gövdesi', 400)

  let claims
  try {
    claims = await verifyLicenseJwt(parsed.data.licenseJwt)
  } catch (err) {
    if (err instanceof LicenseVerifyError) {
      return errorResponse(`Lisans doğrulanamadı: ${err.message}`, 400)
    }
    throw err
  }

  const existing = await prisma.license.findUnique({ where: { id: claims.jti } })

  // Aynı jti ile yeniden kayıt = güncelleme (örn. süre uzatılmış yeni JWT).
  // İptal edilmiş lisans yeni JWT yüklenerek SESSİZCE aktive edilemez — önce
  // açıkça iptal kaldırılmalı (revoke rotasının DELETE'i).
  if (existing?.status === 'revoked') {
    return errorResponse('Bu lisans iptal edilmiş. Önce iptali kaldırın.', 409)
  }

  const data = {
    customerName: claims.customerName,
    licenseJwt: parsed.data.licenseJwt,
    schemaVersion: claims.schemaVersion,
    licenseType: claims.licenseType,
    maxOrganizations: claims.limits.maxOrganizations,
    maxStaff: claims.limits.maxStaff,
    graceDays: claims.graceDays,
    validUntil: claims.validUntil ? new Date(claims.validUntil) : null,
    ...(parsed.data.contactEmail !== undefined ? { contactEmail: parsed.data.contactEmail } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
  }

  const license = await prisma.license.upsert({
    where: { id: claims.jti },
    create: { id: claims.jti, ...data, createdBy: dbUser.id },
    update: data,
  })

  await audit({
    action: existing ? 'license.update' : 'license.register',
    entityType: 'license',
    entityId: license.id,
    oldData: existing ? { validUntil: existing.validUntil, maxStaff: existing.maxStaff } : undefined,
    newData: {
      customerName: claims.customerName,
      validUntil: claims.validUntil,
      maxStaff: claims.limits.maxStaff,
      maxOrganizations: claims.limits.maxOrganizations,
    },
  })

  return jsonResponse(license, existing ? 200 : 201)
})
