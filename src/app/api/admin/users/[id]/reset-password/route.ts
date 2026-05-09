import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, ApiError, getAppUrl } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendPasswordResetByAdminEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'

/**
 * POST /api/admin/users/[id]/reset-password
 *
 * Yönetici tarafından kullanıcı şifre sıfırlama (yetkili reset).
 *
 * Yetki kuralları:
 * - Hedef = staff → aynı org'taki herhangi bir admin/super_admin sıfırlayabilir
 * - Hedef = admin → yalnız Esas Yönetici (Organization.ownerUserId) sıfırlayabilir
 * - Hedef = super_admin → bu endpoint'ten YASAK (super admin'i super admin'in kendi akışı sıfırlasın)
 * - Cross-org → 404 (var/yok bilgisi sızdırma)
 *
 * Davranış: rastgele geçici şifre üretir → Supabase auth password'ü üzerine yazar →
 * mustChangePassword=true set eder → mail atar → tempPassword'ü response'ta döner
 * (mail gitmezse admin PDF basıp elden teslim edebilsin).
 */
export const POST = withAdminRoute<{ id: string }>(
  async ({ request, params, dbUser, organizationId, audit }) => {
    const { id: targetUserId } = params

    // Self-reset bu endpoint'ten YASAK — kullanıcı kendi şifresini /auth/change-password'tan değiştirir
    if (targetUserId === dbUser.id) {
      throw new ApiError('Kendi şifrenizi bu yoldan sıfırlayamazsınız. Profil > Şifre Değiştir kullanın.', 400)
    }

    // Rate limit: bir admin saatte 30 reset (toplu kötüye kullanım önleme)
    const allowed = await checkRateLimit(`admin-reset-pw:${dbUser.id}`, 30, 3600)
    if (!allowed) {
      return errorResponse('Çok fazla şifre sıfırlama isteği. 60 dakika sonra tekrar deneyin.', 429)
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    })

    if (!target) {
      // Cross-org veya yok — fingerprint sızdırmamak için aynı 404
      return errorResponse('Kullanıcı bulunamadı', 404)
    }

    if (target.role === 'super_admin') {
      return errorResponse('Süper admin hesapları bu yoldan sıfırlanamaz', 403)
    }

    if (target.role === 'admin') {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerUserId: true, name: true, brandColor: true },
      })
      if (!org) throw new ApiError('Organizasyon bulunamadı', 404)
      if (org.ownerUserId !== dbUser.id) {
        return errorResponse('Yönetici şifresini yalnız Esas Yönetici sıfırlayabilir', 403)
      }
    }

    if (!target.isActive) {
      return errorResponse('Devre dışı kullanıcının şifresi sıfırlanamaz. Önce hesabı aktifleştirin.', 400)
    }

    // Org bilgisi (admin reset değilse yukarıda çekilmedi — mail için lazım)
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, brandColor: true },
    })
    if (!org) throw new ApiError('Organizasyon bulunamadı', 404)

    const tempPassword = 'Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1' // secret-scanner-disable-line

    const supabase = await createServiceClient()
    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUserId, {
      password: tempPassword,
    })

    if (updateError) {
      logger.error('admin:reset-password', 'Supabase şifre güncelleme başarısız', {
        targetUserId,
        error: updateError.message,
      })
      return errorResponse('Şifre güncellenemedi. Lütfen tekrar deneyin.', 500)
    }

    // mustChangePassword=true → ilk girişte zorla şifre değiştirme middleware tetiklenir
    await prisma.user.update({
      where: { id: targetUserId },
      data: { mustChangePassword: true },
    })

    await audit({
      action: 'user.password.reset_by_admin',
      entityType: 'user',
      entityId: targetUserId,
      newData: {
        targetEmail: target.email,
        targetRole: target.role,
        // tempPassword AUDIT'e ASLA yazılmaz — yalnız işlemin yapıldığı bilgisi
      },
    })

    // Mail gönderimi — best effort, başarısız olursa tempPassword response'ta dönüyor zaten
    let emailSent = true
    try {
      await sendPasswordResetByAdminEmail({
        to: target.email,
        recipientName: `${target.firstName} ${target.lastName}`,
        organizationName: org.name,
        brandColor: org.brandColor,
        tempPassword,
        loginUrl: `${getAppUrl()}/auth/login`,
        resetByName: `${dbUser.firstName} ${dbUser.lastName}`,
      })
    } catch (err) {
      emailSent = false
      logger.warn('admin:reset-password', 'Şifre sıfırlama maili gönderilemedi', {
        targetUserId,
        error: err instanceof Error ? err.message : err,
      })
    }

    logger.info('admin:reset-password', 'Şifre sıfırlandı', {
      adminId: dbUser.id,
      targetUserId,
      targetRole: target.role,
      emailSent,
    })

    return jsonResponse({
      success: true,
      userId: target.id,
      email: target.email,
      firstName: target.firstName,
      lastName: target.lastName,
      // tempPassword her durumda dön — admin PDF basıp elden teslim seçeneğini hep görsün
      tempPassword,
      emailSent,
    })
  },
  { requireOrganization: true },
)
