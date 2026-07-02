import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { isOnPrem } from '@/lib/deployment'
import { activateLicense, storeReceipt, getInstanceId } from '@/lib/license/store'
import { invalidateLicenseCache } from '@/lib/license/cache'
import { callActivate } from '@/lib/license/client'
import { LicenseVerifyError } from '@/lib/license/verify'

/**
 * POST /api/license/activate — on-prem kurulumda lisans/makbuz yükleme.
 *
 * withApiHandler KULLANMAZ (kilitliyken de çalışmalı — aksi halde aktivasyon
 * kilidini açamama kilidi oluşurdu). Kendi auth'unu yapar: admin/super_admin.
 * İki mod:
 *  - { licenseJwt }: lokal Ed25519 doğrula → kaydet → best-effort phone-home
 *    (makbuz alınırsa kaydet). İnternet yoksa yine aktive olur (offline grace).
 *  - { receiptJwt }: kapalı-ağ müşterisi için CLI-üretilmiş offline makbuz yükler.
 */

const bodySchema = z.union([
  z.object({ licenseJwt: z.string().min(20) }),
  z.object({ receiptJwt: z.string().min(20) }),
])

export async function POST(request: NextRequest) {
  if (!isOnPrem()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Yalnız admin/super_admin lisans yükleyebilir.
  const auth = await getAuthUserStrict()
  if (auth.error || !auth.dbUser) {
    return auth.error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (auth.dbUser.role !== 'admin' && auth.dbUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Bu işlem için yönetici yetkisi gerekir.' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek formatı.' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 })
  }

  try {
    // ── Offline makbuz yükleme (kapalı ağ) ──
    if ('receiptJwt' in parsed.data) {
      await storeReceipt(parsed.data.receiptJwt)
      invalidateLicenseCache()
      await createAuditLog({
        userId: auth.dbUser.id,
        action: 'license.receipt_uploaded',
        entityType: 'license',
      })
      return NextResponse.json({ ok: true, mode: 'receipt' })
    }

    // ── Lisans dosyası yükleme ──
    const claims = await activateLicense(parsed.data.licenseJwt)
    invalidateLicenseCache()

    // Best-effort phone-home: makbuz alınırsa online doğrulama zincirini başlat.
    let phoneHome: 'ok' | 'offline' = 'offline'
    const instanceId = await getInstanceId()
    if (instanceId) {
      const receipt = await callActivate(parsed.data.licenseJwt, instanceId, request.headers.get('host') ?? undefined)
      if (receipt) {
        try {
          await storeReceipt(receipt)
          phoneHome = 'ok'
        } catch (err) {
          logger.warn('license', 'Aktivasyon makbuzu kaydedilemedi', err)
        }
        invalidateLicenseCache()
      }
    }

    await createAuditLog({
      userId: auth.dbUser.id,
      action: 'license.activated',
      entityType: 'license',
      entityId: claims.jti,
      newData: { customerName: claims.customerName, validUntil: claims.validUntil, phoneHome },
    })

    return NextResponse.json({
      ok: true,
      mode: 'license',
      phoneHome,
      customerName: claims.customerName,
      validUntil: claims.validUntil,
    })
  } catch (err) {
    if (err instanceof LicenseVerifyError) {
      logger.warn('license', `Aktivasyon reddedildi (${err.reason})`)
      return NextResponse.json({ error: `Lisans doğrulanamadı: ${err.message}` }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes('Makbuz bu kurulumun')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    logger.error('license', 'Aktivasyon hatası', err)
    return NextResponse.json({ error: 'Aktivasyon başarısız. Lütfen tekrar deneyin.' }, { status: 500 })
  }
}
