import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { verifyLicenseJwt, LicenseVerifyError } from '@/lib/license/verify'
import { signReceipt } from '@/lib/license/receipt-signer'
import { isOnPrem } from '@/lib/deployment'

/**
 * POST /api/public/license/heartbeat — lisans sunucusu periyodik doğrulama ucu.
 *
 * On-prem kurulum ~6 saatte bir çağırır: kullanım anlık görüntüsünü bildirir,
 * karşılığında taze imzalı makbuz alır (offline grace penceresini sıfırlar).
 * İptal edilen lisans burada `status: revoked` makbuzuyla kilitlenir; kayıtlı
 * JWT sunulandan yeniyse `renewedLicense` ile dosyasız yenileme yapılır.
 * Aynı lisansın >1 instance'tan heartbeat'i kopyalama anomalisi olarak loglanır.
 */

const bodySchema = z.object({
  licenseJwt: z.string().min(20),
  instanceId: z.string().uuid(),
  usage: z.object({
    orgCount: z.number().int().min(0),
    staffCount: z.number().int().min(0),
    appVersion: z.string().max(40).optional(),
  }),
})

/** base64url JWT payload'ından iat okur (imza ZATEN doğrulanmış JWT'ler için). */
function readIat(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')) as {
      iat?: number
    }
    return payload.iat ?? 0
  } catch {
    return 0
  }
}

export async function POST(request: NextRequest) {
  if (isOnPrem()) return errorResponse('Not found', 404)

  try {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const allowed = await checkRateLimit(`license-heartbeat:${ip}`, 30, 3600)
    if (!allowed) {
      return errorResponse('Çok fazla istek. Lütfen daha sonra tekrar deneyin.', 429)
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return errorResponse('Geçersiz istek formatı.', 400)
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) return errorResponse('Geçersiz istek gövdesi.', 400)
    const { licenseJwt, instanceId, usage } = parsed.data

    let claims
    try {
      claims = await verifyLicenseJwt(licenseJwt)
    } catch (err) {
      const reason = err instanceof LicenseVerifyError ? err.reason : 'unknown'
      logger.warn('license-server', `Heartbeat'te geçersiz lisans JWT (${reason})`)
      return errorResponse('Lisans doğrulanamadı.', 403)
    }

    const license = await prisma.license.findUnique({ where: { id: claims.jti } })
    if (!license) {
      return errorResponse('Lisans sistemde kayıtlı değil. Klinovax ile iletişime geçin.', 404)
    }

    const now = new Date()
    const [, , recentActivations] = await Promise.all([
      prisma.licenseActivation.upsert({
        where: { licenseId_instanceId: { licenseId: license.id, instanceId } },
        create: {
          licenseId: license.id,
          instanceId,
          appVersion: usage.appVersion ?? null,
        },
        update: { lastSeenAt: now, appVersion: usage.appVersion ?? null },
      }),
      prisma.licenseHeartbeat.create({
        data: {
          licenseId: license.id,
          instanceId,
          orgCount: usage.orgCount,
          staffCount: usage.staffCount,
          appVersion: usage.appVersion ?? null,
        },
      }),
      prisma.licenseActivation.findMany({
        where: {
          licenseId: license.id,
          lastSeenAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: { instanceId: true },
      }),
    ])

    // Kopyalama anomalisi: son 24 saatte birden fazla instance aynı lisansla yaşıyor.
    const distinctInstances = new Set(recentActivations.map((a) => a.instanceId))
    distinctInstances.add(instanceId)
    if (distinctInstances.size > 1) {
      logger.warn(
        'license-server',
        `Lisans paylaşım anomalisi: ${license.customerName} — 24s içinde ${distinctInstances.size} farklı instance`,
      )
      await createAuditLog({
        action: 'license.anomaly.multi_instance',
        entityType: 'license',
        entityId: license.id,
        newData: { instanceCount: distinctInstances.size, reportingInstance: instanceId },
      })
    }

    // Dosyasız yenileme: kayıtlı JWT sunulandan yeniyse makbuzla ilet.
    const renewedLicense =
      license.licenseJwt !== licenseJwt && readIat(license.licenseJwt) > claims.iat
        ? license.licenseJwt
        : null

    const receipt = await signReceipt({
      licenseId: license.id,
      instanceId,
      status: license.status === 'revoked' ? 'revoked' : 'valid',
      renewedLicense,
    })

    return jsonResponse({ receipt })
  } catch (err) {
    logger.error('license-server', 'Heartbeat ucu hatası', err)
    return errorResponse('Sunucu hatası. Lütfen tekrar deneyin.', 500)
  }
}
