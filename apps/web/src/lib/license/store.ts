import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { verifyLicenseJwt, verifyReceiptJwt } from '@/lib/license/verify'
import type { LicenseClaims, ReceiptClaims } from '@/lib/license/schema'
import type { LicenseSnapshot } from '@/lib/license/state'

/**
 * PlatformLicense singleton satırının (id=1) okuma/yazma katmanı.
 *
 * Güvenlik modeli: DB'de saklanan lisans/makbuz JWT'leri HER OKUYUŞTA imza
 * doğrulamasından geçer — satır elle değiştirilirse (DB tamper) imza düşer ve
 * durum makinesi NO_LICENSE'a düşer. Saat watermark'ı yalnız İLERİ sarar
 * (aktivasyon, makbuz, boot/heartbeat ratchet) — geri sarma tespiti state.ts'te.
 */

const SINGLETON_ID = 1
/** Watermark'ı her küçük ilerleme için yazmamak adına eşik. */
const WATERMARK_MIN_ADVANCE_MS = 60 * 60 * 1000

/** Satırı okuyup imzaları doğrular; tamper/eksik durumları alanlara yansır. */
export async function loadLicenseSnapshot(): Promise<LicenseSnapshot> {
  const row = await prisma.platformLicense.findUnique({ where: { id: SINGLETON_ID } })
  if (!row) {
    return { claims: null, receipt: null, activatedAt: null, clockWatermark: null }
  }

  let claims: LicenseClaims | null = null
  let signatureInvalid = false
  try {
    claims = await verifyLicenseJwt(row.licenseJwt)
  } catch {
    signatureInvalid = true
  }

  // Bozuk makbuz lisansı ÖLDÜRMEZ — makbuz yok sayılır, grace çapası
  // activatedAt'e düşer (fail-safe ama fail-open değil).
  let receipt: ReceiptClaims | null = null
  if (row.receiptJwt) {
    try {
      receipt = await verifyReceiptJwt(row.receiptJwt)
    } catch {
      logger.warn('license', 'Kayıtlı makbuz imzası doğrulanamadı — yok sayılıyor')
    }
  }

  return {
    claims,
    signatureInvalid,
    receipt,
    activatedAt: row.activatedAt,
    clockWatermark: row.clockWatermark,
  }
}

/**
 * Lisans aktivasyonu/yenilemesi — JWT'yi doğrular ve singleton satıra yazar.
 * instanceId İLK aktivasyonda üretilir ve lisans yenilense de KORUNUR
 * (SaaS tarafındaki aktivasyon/anomali takibi kuruluma bağlıdır).
 * @returns doğrulanmış claim'ler
 * @throws LicenseVerifyError — imza/biçim/şema hatası
 */
export async function activateLicense(licenseJwt: string): Promise<LicenseClaims> {
  const claims = await verifyLicenseJwt(licenseJwt)
  const now = new Date()
  const existing = await prisma.platformLicense.findUnique({
    where: { id: SINGLETON_ID },
    select: { instanceId: true, clockWatermark: true },
  })
  const clockWatermark =
    existing && existing.clockWatermark > now ? existing.clockWatermark : now

  await prisma.platformLicense.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      licenseJwt,
      licenseId: claims.jti,
      instanceId: randomUUID(),
      clockWatermark: now,
      activatedAt: now,
    },
    update: {
      licenseJwt,
      licenseId: claims.jti,
      // Eski lisansın makbuzu yeni lisansa uygulanmaz — temizlenir; grace
      // çapası activatedAt'ten yeniden başlar.
      receiptJwt: null,
      lastHeartbeatAt: null,
      lastHeartbeatStatus: null,
      clockWatermark,
      activatedAt: now,
    },
  })
  return claims
}

/**
 * Heartbeat/offline makbuzunu doğrulayıp kaydeder; watermark'ı makbuz iat'i
 * ile ileri sarar (makbuz = güvenilir sunucu zamanı).
 * @throws Error — makbuz bu kurulumun lisansına/instance'ına ait değilse
 */
export async function storeReceipt(receiptJwt: string): Promise<ReceiptClaims> {
  const receipt = await verifyReceiptJwt(receiptJwt)
  const row = await prisma.platformLicense.findUnique({
    where: { id: SINGLETON_ID },
    select: { licenseId: true, instanceId: true, clockWatermark: true },
  })
  if (!row) throw new Error('Aktif lisans yok — önce lisans aktive edilmeli')
  if (receipt.licenseId !== row.licenseId || receipt.instanceId !== row.instanceId) {
    throw new Error('Makbuz bu kurulumun lisansına ait değil')
  }

  const now = new Date()
  const candidates = [row.clockWatermark.getTime(), receipt.iat * 1000, now.getTime()]
  const clockWatermark = new Date(Math.max(...candidates))

  await prisma.platformLicense.update({
    where: { id: SINGLETON_ID },
    data: {
      receiptJwt,
      lastHeartbeatAt: now,
      lastHeartbeatStatus: receipt.status,
      clockWatermark,
    },
  })
  return receipt
}

/**
 * Saat watermark'ını şimdiki zamana ilerletir (boot + heartbeat cron çağırır).
 * Yazma amplifikasyonunu önlemek için 1 saatten küçük ilerlemeler atlanır.
 * GET/istek yolunda ÇAĞRILMAZ (GET'te DB write yasağı).
 */
export async function ratchetClockWatermark(now: Date = new Date()): Promise<void> {
  const row = await prisma.platformLicense.findUnique({
    where: { id: SINGLETON_ID },
    select: { clockWatermark: true },
  })
  if (!row) return
  if (now.getTime() - row.clockWatermark.getTime() < WATERMARK_MIN_ADVANCE_MS) return
  await prisma.platformLicense.update({
    where: { id: SINGLETON_ID },
    data: { clockWatermark: now },
  })
}

/** Kurulumun instanceId'si (heartbeat kimliği); lisans aktive edilmemişse null. */
export async function getInstanceId(): Promise<string | null> {
  const row = await prisma.platformLicense.findUnique({
    where: { id: SINGLETON_ID },
    select: { instanceId: true },
  })
  return row?.instanceId ?? null
}
