import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Güvenilir cihaz (Trusted Device) yönetimi.
 *
 * Kullanıcı SMS OTP ile başarılı giriş yaptıktan sonra cihazı 7 gün "güvenilir"
 * olarak işaretlenir. Aynı cihazdan tekrar giriş yapıldığında SMS istenmez.
 *
 * Güvenlik modeli:
 *   - Plaintext token (256-bit rastgele) cookie'de httpOnly+Secure+SameSite=Lax saklanır
 *   - DB'de sadece token'ın SHA-256 hash'i saklanır (DB leak → token kullanılamaz)
 *   - Her kullanım `last_used_at`'i günceller (aktif cihaz takibi için)
 *   - `revoked_at` set edilen cihaz artık güvenilir sayılmaz ("diğer cihazlardan çık" akışı)
 *   - Süresi dolmuş cihazlar cron ile temizlenir (ayrı PR, şimdilik sadece filter)
 */

const COOKIE_NAME = 'trusted_device_token'
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 gün
const TOKEN_BYTES = 32 // 256-bit

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex')
}

/**
 * Yeni güvenilir cihaz kaydı oluşturur ve cookie'yi set eder.
 * OTP doğrulaması başarılı olduktan hemen sonra çağrılır.
 */
export async function issueTrustedDevice(params: {
  userId: string
  userAgent?: string | null
  ipAddress?: string | null
}): Promise<void> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000)

  try {
    await prisma.trustedDevice.create({
      data: {
        userId: params.userId,
        tokenHash,
        userAgent: params.userAgent?.slice(0, 500) ?? null,
        ipAddress: params.ipAddress?.slice(0, 45) ?? null,
        expiresAt,
      },
    })
  } catch (err) {
    logger.error('trusted-device', 'DB insert basarisiz', err)
    // Token set edilmezse kullanıcı her seferinde SMS gireceği için fatal değil
    return
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })

  logger.info('trusted-device', 'Yeni guvenilir cihaz kaydedildi', { userId: params.userId })
}

/**
 * Mevcut cookie'nin geçerli bir güvenilir cihaz olup olmadığını kontrol eder.
 * Geçerliyse `last_used_at`'i günceller (fire-and-forget).
 *
 * @returns Cihaz güvenilirse `true`, değilse `false`
 */
export async function isDeviceTrusted(userId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false

  const tokenHash = hashToken(token)

  try {
    const device = await prisma.trustedDevice.findUnique({
      where: { tokenHash },
      select: { userId: true, expiresAt: true, revokedAt: true, id: true },
    })

    if (!device) return false
    if (device.userId !== userId) {
      // Token başka user'ın — saldırı işareti
      logger.warn('trusted-device', 'Token user ile eslesmedi', { userId, tokenUser: device.userId })
      return false
    }
    if (device.revokedAt) return false
    if (device.expiresAt.getTime() < Date.now()) return false

    // last_used_at güncellemesi kritik yoldan değil — fire and forget
    prisma.trustedDevice
      .update({ where: { id: device.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {})

    return true
  } catch (err) {
    logger.error('trusted-device', 'DB lookup basarisiz', err)
    // Fail-closed: DB hatasında güvenilir saymıyoruz, SMS iste
    return false
  }
}

/**
 * Kullanıcının tüm güvenilir cihazlarını iptal eder (logout-all benzeri akış).
 * "Diğer cihazlardan çık" butonunda kullanılır.
 */
export async function revokeAllTrustedDevices(userId: string): Promise<void> {
  try {
    await prisma.trustedDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    logger.info('trusted-device', 'Tum cihazlar iptal edildi', { userId })
  } catch (err) {
    logger.error('trusted-device', 'Revoke-all basarisiz', err)
  }
}

export interface TrustedDeviceInfo {
  id: string
  userAgent: string | null
  ipAddress: string | null
  lastUsedAt: Date
  expiresAt: Date
  /** Bu kayıt, isteği yapan tarayıcının kendi cihazı mı? */
  isCurrent: boolean
}

/**
 * Kullanıcının aktif (iptal edilmemiş + süresi dolmamış) güvenilir cihazlarını listeler.
 * "Cihazlarım" ekranı için. Mevcut tarayıcının cihazı `isCurrent: true` ile işaretlenir.
 */
export async function listTrustedDevices(userId: string): Promise<TrustedDeviceInfo[]> {
  const cookieStore = await cookies()
  const currentToken = cookieStore.get(COOKIE_NAME)?.value
  const currentHash = currentToken ? hashToken(currentToken) : null

  try {
    const devices = await prisma.trustedDevice.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, tokenHash: true, userAgent: true, ipAddress: true, lastUsedAt: true, expiresAt: true },
      orderBy: { lastUsedAt: 'desc' },
    })
    return devices.map((d) => ({
      id: d.id,
      userAgent: d.userAgent,
      ipAddress: d.ipAddress,
      lastUsedAt: d.lastUsedAt,
      expiresAt: d.expiresAt,
      isCurrent: currentHash != null && d.tokenHash === currentHash,
    }))
  } catch (err) {
    logger.error('trusted-device', 'Cihaz listesi alinamadi', err)
    return []
  }
}

/**
 * Tek bir güvenilir cihazı iptal eder (yalnız kaydın sahibi). "Çıkış yaptır" butonu.
 * @returns iptal edildiyse `true`, cihaz bulunamadı/yetki yoksa `false`
 */
export async function revokeTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
  try {
    const res = await prisma.trustedDevice.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return res.count > 0
  } catch (err) {
    logger.error('trusted-device', 'Tekil cihaz revoke basarisiz', err)
    return false
  }
}

/**
 * Mevcut cihazın trusted cookie'sini siler (session logout tarafından çağrılabilir).
 * DB kaydını silmez — audit için korunur.
 */
export async function clearTrustedDeviceCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
