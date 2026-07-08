import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { assertCronAuth } from '@/lib/cron-auth'
import { isOnPrem } from '@/lib/deployment'
import {
  loadLicenseSnapshot,
  storeReceipt,
  ratchetClockWatermark,
  getInstanceId,
  activateLicense,
} from '@/lib/license/store'
import { invalidateLicenseCache } from '@/lib/license/cache'
import { computeLicenseState } from '@/lib/license/state'
import { callHeartbeat } from '@/lib/license/client'
import { createAuditLog } from '@/lib/api-helpers'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/cron/license-heartbeat — on-prem periyodik doğrulama (altyapı cron'u).
 *
 * ~6 saatte bir scheduler tarafından çağrılır (assertCronAuth). Adımlar:
 *  1. Saat watermark'ını ilerlet (geri-alma tespiti için taban).
 *  2. Lisans sunucusuna kullanım snapshot'ı gönder → taze makbuz al.
 *  3. Makbuz status/renewedLicense işle → offline grace penceresini sıfırla.
 * İnternet yoksa sessiz geçer (offline grace geçerli); dead-man's-switch:
 * kilit/uyarı durumunda 200 döner ama gövdede state bildirir (monitör için).
 * Bulut modunda no-op.
 */
export async function GET(request: Request) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  if (!isOnPrem()) {
    return NextResponse.json({ ok: true, skipped: 'cloud' }, { headers: NO_STORE })
  }

  await ratchetClockWatermark()

  const before = await loadLicenseSnapshot()
  if (!before.claims) {
    // Lisans yok/bozuk — heartbeat yapılamaz; durum makinesi zaten NO_LICENSE.
    return NextResponse.json({ ok: true, state: 'NO_LICENSE' }, { headers: NO_STORE })
  }

  const instanceId = await getInstanceId()
  if (!instanceId) {
    return NextResponse.json({ ok: true, state: 'NO_LICENSE' }, { headers: NO_STORE })
  }

  // Kullanım snapshot'ı (global — tek kurulum).
  const [orgCount, staffCount] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count({ where: { role: 'staff' } }),
  ])

  // Heartbeat lisans JWT'sini gövdede ister; store'daki ham JWT'yi oku
  // (loadLicenseSnapshot claim döner, ham JWT değil).
  const licenseRow = await prisma.platformLicense.findUnique({
    where: { id: 1 },
    select: { licenseJwt: true },
  })

  let phoneHome: 'ok' | 'offline' = 'offline'
  const receipt = licenseRow
    ? await callHeartbeat(licenseRow.licenseJwt, instanceId, { orgCount, staffCount })
    : null

  if (receipt) {
    try {
      const stored = await storeReceipt(receipt)
      phoneHome = 'ok'
      invalidateLicenseCache()

      // Dosyasız yenileme: makbuz yeni lisans taşıyorsa uygula, sonra makbuzu
      // yeni lisansa yeniden bağla (activateLicense makbuzu temizler).
      if (stored.renewedLicense) {
        try {
          await activateLicense(stored.renewedLicense)
          await storeReceipt(receipt).catch(() => {})
          invalidateLicenseCache()
          logger.info('license', 'Lisans dosyasız yenilendi (renewedLicense)')
        } catch (err) {
          logger.warn('license', 'renewedLicense uygulanamadı', err)
        }
      }
    } catch (err) {
      logger.warn('license', 'Heartbeat makbuzu kaydedilemedi', err)
    }
  }

  const after = await loadLicenseSnapshot()
  const state = computeLicenseState(after, new Date())

  // Durum geçişi audit'i (VALID dışına çıkış izlenebilir olsun).
  if (state.state !== 'VALID') {
    await createAuditLog({
      action: 'license.state_changed',
      entityType: 'license',
      entityId: after.claims?.jti ?? null,
      newData: { state: state.state, reasons: state.reasons, phoneHome, offlineDaysLeft: state.offlineDaysLeft },
    }).catch(() => {})
  }

  return NextResponse.json(
    { ok: true, state: state.state, phoneHome, offlineDaysLeft: state.offlineDaysLeft },
    { headers: NO_STORE },
  )
}
