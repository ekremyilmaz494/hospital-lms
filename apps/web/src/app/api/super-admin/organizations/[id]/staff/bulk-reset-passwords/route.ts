import { prisma } from '@/lib/prisma'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTempPassword } from '@/lib/passwords'
import { revokeAllUserSessions } from '@/lib/auth/revoke-user-sessions'
import { decryptTcKimlik, tcAuditRef } from '@/lib/tc-crypto'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const maxDuration = 60

/**
 * POST /api/super-admin/organizations/[id]/staff/bulk-reset-passwords
 *
 * Bir hastanedeki TÜM AKTİF PERSONEL'in (role='staff') şifresini topluca sıfırlar.
 *  - Yalniz super_admin çağırabilir.
 *  - Admin ve super_admin hesaplari ETKİLENMEZ — sadece staff.
 *  - Her personel için: yeni geçici şifre üretilir, Supabase auth güncellenir,
 *    tüm refresh token'lar ve trusted device kayıtlari iptal edilir.
 *  - DB tarafında mustChangePassword=true topluca set edilir.
 *
 * Response: items[] — frontend bunu credentials-pdf endpoint'ine geçirerek
 * profesyonel "Personel Giriş Bilgileri" PDF'i üretir (TC + tempPassword).
 *
 * KVKK:
 *  - tempPassword sadece bu HTTP yanıtında gider (DB plaintext tutulmaz).
 *  - Audit log'a tempPassword YAZILMAZ — sadece kaç kullanıcı etkilendi + tcRefs.
 *  - TC plaintext yalnız PDF üretimi için decrypt edilir, response sonrasında atılır.
 */
export const POST = withSuperAdminRoute<{ id: string }>(async ({ params, dbUser, audit }) => {
  const organizationId = params.id

  const rateOk = await checkRateLimit(`super-admin-bulk-reset:${dbUser.id}`, 5, 3600)
  if (!rateOk) {
    return errorResponse('Çok fazla toplu sıfırlama isteği. 60 dakika sonra tekrar deneyin.', 429)
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  })
  if (!organization) return errorResponse('Organizasyon bulunamadı', 404)

  const staff = await prisma.user.findMany({
    where: {
      organizationId: organizationId,
      role: 'staff',
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      title: true,
      tcEncrypted: true,
      departmentRel: { select: { name: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  if (staff.length === 0) {
    return errorResponse('Bu organizasyonda şifresi sıfırlanacak aktif personel yok', 400)
  }

  const supabase = await createServiceClient()

  const items: Array<{
    id: string
    fullName: string
    tcKimlik: string
    email: string | null
    tempPassword: string
    department: string | null
    title: string | null
  }> = []
  const failed: Array<{ id: string; name: string; reason: string }> = []

  // Supabase admin updateUserById'yi 5'erli batch'lerde paralel calistir.
  // Tek tek sirayla ~141 × 200ms = 28s (Vercel timeout sinirina yakin).
  // 5 paralel → ~6s. Supabase admin endpoint kendi rate limit'ine sahip;
  // 5 makul bir uzlasma.
  const BATCH_SIZE = 5
  for (let i = 0; i < staff.length; i += BATCH_SIZE) {
    const batch = staff.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (s) => {
      const tempPassword = generateTempPassword()
      try {
        const { error: updateError } = await supabase.auth.admin.updateUserById(s.id, {
          password: tempPassword,
        })
        if (updateError) {
          failed.push({ id: s.id, name: `${s.firstName} ${s.lastName}`, reason: updateError.message })
          return
        }

        // Eski oturumlari + trusted device'lari oldur (KRITIK guvenlik adimi)
        await revokeAllUserSessions(s.id)

        let tcPlain = ''
        try {
          tcPlain = s.tcEncrypted ? decryptTcKimlik(s.tcEncrypted) : ''
        } catch (err) {
          // TC decrypt basarisiz olursa PDF'te bos kalir; reset yine de tamamlanmis sayilir.
          logger.warn('super-admin:bulk-reset', 'TC decrypt basarisiz', {
            userId: s.id,
            error: err instanceof Error ? err.message : err,
          })
        }

        items.push({
          id: s.id,
          fullName: `${s.firstName} ${s.lastName}`.trim(),
          tcKimlik: tcPlain,
          email: s.email,
          tempPassword,
          department: s.departmentRel?.name ?? null,
          title: s.title ?? null,
        })
      } catch (err) {
        failed.push({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          reason: err instanceof Error ? err.message : 'Bilinmeyen hata',
        })
      }
    }))
  }

  // Basarili olanlar icin mustChangePassword=true (tek query)
  if (items.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: items.map(i => i.id) } },
      data: { mustChangePassword: true },
    })
  }

  await audit({
    action: 'staff.bulk_password_reset_by_super_admin',
    entityType: 'user',
    entityId: null,
    newData: {
      organizationId,
      organizationName: organization.name,
      totalStaff: staff.length,
      succeeded: items.length,
      failed: failed.length,
      // KVKK: plaintext TC veya tempPassword AUDIT'e yazilmaz; sadece hash referanslari
      tcRefs: items.filter(i => i.tcKimlik).map(i => tcAuditRef(i.tcKimlik)),
      failedSamples: failed.slice(0, 5),
    },
  })

  logger.info('super-admin:bulk-reset', 'Toplu staff sifre sifirlama tamamlandi', {
    superAdminId: dbUser.id,
    organizationId,
    succeeded: items.length,
    failed: failed.length,
  })

  return jsonResponse({
    success: true,
    organizationId,
    organizationName: organization.name,
    total: staff.length,
    succeeded: items.length,
    failed: failed.length,
    failedDetails: failed.slice(0, 20),
    items,
  })
})
