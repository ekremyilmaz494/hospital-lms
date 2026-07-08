import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { verifyLicenseJwt, LicenseVerifyError } from '@/lib/license/verify'
import { signReceipt } from '@/lib/license/receipt-signer'
import { isOnPrem } from '@/lib/deployment'

/**
 * POST /api/public/license/activate — lisans sunucusu (SaaS) aktivasyon ucu.
 *
 * Oturum yok: GEÇERLİ İMZALI lisans JWT'sine sahip olmak kimlik yerine geçer
 * (imza bizim ihraç anahtarımızla doğrulanır; sahte JWT üretilemez).
 * On-prem kurulum ilk aktivasyonda/gerektiğinde çağırır; imzalı makbuz döner.
 * Rate limit: IP başına 10/saat (brute-force/enum koruması).
 */

const bodySchema = z.object({
  licenseJwt: z.string().min(20),
  instanceId: z.string().uuid(),
  appVersion: z.string().max(40).optional(),
  hostname: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  // Lisans SUNUCUSU bulut dağıtımıdır — on-prem kopyada bu uç kapalı.
  if (isOnPrem()) return errorResponse('Not found', 404)

  try {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const allowed = await checkRateLimit(`license-activate:${ip}`, 10, 3600)
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
    const { licenseJwt, instanceId, appVersion, hostname } = parsed.data

    // İmza doğrulaması — geçmezse istek kimliksizdir, ayrıntı sızdırma.
    let claims
    try {
      claims = await verifyLicenseJwt(licenseJwt)
    } catch (err) {
      const reason = err instanceof LicenseVerifyError ? err.reason : 'unknown'
      logger.warn('license-server', `Aktivasyonda geçersiz lisans JWT (${reason})`)
      return errorResponse('Lisans doğrulanamadı.', 403)
    }

    // Lisans super-admin tarafından kayıtlı olmalı (kayıt = iptal/izleme kontrol noktası).
    const license = await prisma.license.findUnique({ where: { id: claims.jti } })
    if (!license) {
      return errorResponse('Lisans sistemde kayıtlı değil. Klinovax ile iletişime geçin.', 404)
    }

    await prisma.licenseActivation.upsert({
      where: { licenseId_instanceId: { licenseId: license.id, instanceId } },
      create: {
        licenseId: license.id,
        instanceId,
        appVersion: appVersion ?? null,
        hostname: hostname ?? null,
      },
      update: {
        lastSeenAt: new Date(),
        appVersion: appVersion ?? null,
        hostname: hostname ?? null,
      },
    })

    const receipt = await signReceipt({
      licenseId: license.id,
      instanceId,
      status: license.status === 'revoked' ? 'revoked' : 'valid',
    })

    logger.info('license-server', `Lisans aktivasyonu: ${license.customerName} (${license.id.slice(0, 8)}…)`)
    return jsonResponse({ receipt })
  } catch (err) {
    logger.error('license-server', 'Aktivasyon ucu hatası', err)
    return errorResponse('Sunucu hatası. Lütfen tekrar deneyin.', 500)
  }
}
