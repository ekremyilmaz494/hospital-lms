import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

/**
 * KVKK m.7 (unutulma hakkı / veri imhası) — kullanıcı PII'sının anonimleştirilmesi.
 *
 * Erasure için TEK doğruluk kaynağı: hem admin KVKK silme route'u
 * (`api/admin/kvkk/delete-user-data`) hem personel purge akışı (`api/admin/staff/[id]?purge=true`)
 * BU helper'ı kullanır. Anonimleştirme kapsamı tek yerde tanımlı olsun ki bir tablo eklenince tüm
 * akışlar birden güncellensin (geçmişte imza görseli + cihaz/IP kayıtları bu yüzden atlanmıştı).
 */

/** Anonimleştirilmiş kullanıcı için görünen ad/soyad sabitleri. */
export const ANON_FIRST_NAME = 'Silinmiş'
export const ANON_LAST_NAME = 'Kullanıcı'

/** Her anonimleştirmede çakışmayan benzersiz sahte e-posta üretir. */
export function anonymizedEmail(): string {
  return `deleted_${randomUUID()}@anonymized.local`
}

/**
 * Kullanıcının tüm ilişkili tablolardaki kişisel verisini tek transaction'da anonimleştirir:
 * - `User`: ad/soyad/e-posta/telefon/avatar + TC ciphertext & hash → temizlenir, `isActive=false`
 * - `AuditLog`: kullanıcıya ait kayıtlarda `oldData`/`newData` redakte, IP/User-Agent temizlenir
 * - `Certificate`: sertifika kodu (isim içerebilir) redakte
 * - `ExamAttempt`: **imza görseli (`signatureData`, potansiyel biyometrik) + imza IP** temizlenir
 * - `TrustedDevice`: cihaz IP + User-Agent + token'ları silinir (AuditLog IP temizliğiyle tutarlı)
 * - `PushSubscription` / `ExpoPushToken` / `ExpoPushTicket`: cihaz push tanımlayıcıları silinir
 * - `Invitation`: kabul edilmiş (acceptedUserId) VE aynı org'da bu e-postayla eşleşen bekleyen
 *   davetlerdeki ad/e-posta/telefon/ünvan + TC kopyası temizlenir (org-scope cross-tenant'ı önler)
 * - `Notification`: kişiye özel bildirimler silinir
 *
 * `VideoProgress`, `ExamAnswer`, `SmgActivity`, `CompetencyAnswer` gibi tablolar yalnız `userId`
 * FK'siyle bağlıdır ve bağımsız kimlik verisi taşımaz → User anonimleşince ilişki-koparma yoluyla
 * anonimleşirler; ayrıca silinmelerine gerek yoktur (eğitim/sınav istatistikleri korunur).
 *
 * Not: Çağıran taraf tenant/rol guard'ından (kullanıcı bu org'a ait mi, super_admin değil mi)
 * SORUMLUDUR — bu helper doğrudan `id` ile çalışır.
 *
 * @param userId Anonimleştirilecek kullanıcının id'si
 * @returns Kullanılan anonim e-posta (audit için)
 */
export async function anonymizeUserData(userId: string): Promise<{ anonymizedEmail: string }> {
  const email = anonymizedEmail()

  // Davet kaydı temizliği için kullanıcının org'u + orijinal e-postası gerekir: bekleyen (henüz
  // kabul edilmemiş) davet yalnızca e-posta ile bağlıdır. org-scope, aynı e-postanın başka bir
  // hastanedeki davetine dokunmayı engeller (cross-tenant koruması).
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, organizationId: true },
  })
  // organizationId null yalnız super_admin'de olur; onlar zaten çağıranlarda engelli. Yine de
  // org-scope davet temizliği için org zorunlu — yoksa güvenli tarafta kal ve fırlat.
  if (!target?.organizationId) {
    throw new Error(`anonymizeUserData: kullanıcı veya organizasyonu bulunamadı (${userId})`)
  }

  await prisma.$transaction([
    // 1. Ana kullanıcı tablosu — TC dahil tüm PII
    prisma.user.update({
      where: { id: userId },
      data: {
        firstName: ANON_FIRST_NAME,
        lastName: ANON_LAST_NAME,
        email,
        phone: null,
        avatarUrl: null,
        isActive: false,
        tcEncrypted: null,
        tcHash: null,
        tcAddedAt: null,
        tcAddedBy: null,
      },
    }),
    // 2. Kullanıcıyla ilgili audit loglarda veri anlık görüntülerini redakte et
    prisma.auditLog.updateMany({
      where: { entityType: 'User', entityId: userId },
      data: {
        oldData: { redacted: true, reason: 'KVKK_DATA_DELETION' },
        newData: { redacted: true, reason: 'KVKK_DATA_DELETION' },
      },
    }),
    // 3. Kullanıcının ürettiği audit loglarda IP + User-Agent temizle
    prisma.auditLog.updateMany({
      where: { userId },
      data: { ipAddress: null, userAgent: null },
    }),
    // 4. Sertifika kodları — kullanıcı adı içerebilir
    prisma.certificate.updateMany({
      where: { userId },
      data: { certificateCode: `CERT-REDACTED-${userId.slice(0, 8)}` },
    }),
    // 5. Sınav imza görseli (potansiyel biyometrik) + imza IP
    prisma.examAttempt.updateMany({
      where: { userId },
      data: { signatureData: null, signatureIp: null },
    }),
    // 6. Güvenilir cihaz kayıtları — IP + User-Agent + token taşır (AuditLog IP temizliğiyle tutarlı)
    prisma.trustedDevice.deleteMany({ where: { userId } }),
    // 7-9. Cihaz push tanımlayıcıları (web + mobil + delivery audit)
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.expoPushToken.deleteMany({ where: { userId } }),
    prisma.expoPushTicket.deleteMany({ where: { userId } }),
    // 10. Davet kaydı — kabul edilmiş (acceptedUserId) + aynı org'da bu e-postayla eşleşen bekleyen
    //     davetlerdeki ad/e-posta/telefon/ünvan + TC kopyasını temizle (org-scope cross-tenant koruması)
    prisma.invitation.updateMany({
      where: {
        organizationId: target.organizationId,
        OR: [{ acceptedUserId: userId }, { email: target.email }],
      },
      data: {
        email,
        firstName: ANON_FIRST_NAME,
        lastName: ANON_LAST_NAME,
        phone: null,
        title: null,
        tcEncrypted: null,
        tcHash: null,
      },
    }),
    // 11. Kişiye özel bildirimler
    prisma.notification.deleteMany({
      where: { userId },
    }),
  ])

  return { anonymizedEmail: email }
}
