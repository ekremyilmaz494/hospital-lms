import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { isDeviceTrusted } from './trusted-device'

/**
 * SMS MFA session yönetimi + layout-level guard.
 *
 * Neden middleware'de değil: middleware her request'te çalışır ve org ayarını
 * (smsMfaEnabled) okumak için DB sorgusu gerektirir. Bu performansı bozar
 * (her route isabeti +1 DB roundtrip). Layout server component'leri zaten
 * getAuthUser → prisma.user.findUnique çağırıyor (30s cache var) — guard
 * oraya oturur, ek DB sorgusu minimum.
 */

const SMS_VERIFIED_COOKIE = 'hlms-sms-verified'

/**
 * SMS doğrulama başarılıysa çağrılır — session süresince geçerli cookie set eder.
 * httpOnly değil ki client tarafı "doğrulandın" durumunu okuyabilsin (güvenlik
 * değeri düşük — asıl doğrulama server guard'da).
 */
export async function markSmsVerifiedInSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SMS_VERIFIED_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // maxAge vermiyoruz — session cookie, tarayıcı kapanınca biter
  })
}

export async function clearSmsVerifiedCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SMS_VERIFIED_COOKIE)
}

async function isSmsVerifiedInSession(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(SMS_VERIFIED_COOKIE)?.value === '1'
}

/**
 * Dashboard layout'larında (`/admin/layout.tsx`, `/staff/layout.tsx` vb.) çağrılır.
 *
 * Kontrol sırası:
 *   1. Org SMS MFA açık değilse → geç (no-op)
 *   2. Telefon yoksa → /auth/phone-setup'a yönlendir (kullanıcı numarasını girmeli)
 *   3. Bu session'da zaten SMS doğrulandıysa → geç
 *   4. Güvenilir cihaz cookie'si varsa → geç
 *   5. Yukarıdakilerden hiçbiri → /auth/sms-verify'a yönlendir
 *
 * Çağıran layout önceden `getAuthUser()` yapmış olmalı ve dbUser'ı vermeli
 * (ek DB sorgusu yapmamak için).
 */
export async function enforceSmsMfaGuard(dbUser: {
  id: string
  organizationId: string | null
  phone: string | null
  phoneVerifiedAt: Date | null
  role: string
}): Promise<void> {
  // Super admin SMS MFA'dan muaf — platform operatörü, hastane verisi değil
  if (dbUser.role === 'super_admin') return

  if (!dbUser.organizationId) return

  // Org ayarını oku — bu cache'lenebilir ileride ama şimdilik direkt
  const org = await prisma.organization.findUnique({
    where: { id: dbUser.organizationId },
    select: { smsMfaEnabled: true },
  }).catch((err) => {
    logger.error('sms-guard', 'Org sorgu basarisiz', err)
    return null
  })

  if (!org?.smsMfaEnabled) return

  // SMS MFA aktif — kontrolleri uygula
  if (!dbUser.phone) {
    redirect('/auth/phone-setup')
  }

  if (await isSmsVerifiedInSession()) return
  if (await isDeviceTrusted(dbUser.id)) return

  redirect('/auth/sms-verify')
}
