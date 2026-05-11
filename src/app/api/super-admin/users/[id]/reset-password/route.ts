import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, ApiError, getOrgUrl } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendPasswordResetByAdminEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'

/**
 * POST /api/super-admin/users/[id]/reset-password
 *
 * Süper admin tarafından hastane admin şifresinin sıfırlanması.
 *
 * Yetki kuralları:
 * - Yalnız hedef.role === 'admin' kabul edilir (staff için admin endpoint, super_admin için forgot-password var)
 * - Self-reset YASAK — süper admin kendi şifresini /auth/forgot-password ile yeniler
 * - Hedef org'u target user'dan çekilir (süper admin global, organizationId path'te yok)
 *
 * Davranış: rastgele geçici şifre üret → Supabase auth password'ü üzerine yaz →
 * mustChangePassword=true set et → mail at → tempPassword response'ta dön (mail gitmezse
 * süper admin kopyalayıp manuel iletebilsin).
 */
export const POST = withSuperAdminRoute<{ id: string }>(
  async ({ params, dbUser, audit }) => {
    const { id: targetUserId } = params

    if (targetUserId === dbUser.id) {
      throw new ApiError(
        'Kendi şifrenizi bu yoldan sıfırlayamazsınız. /auth/forgot-password kullanın.',
        400,
      )
    }

    const allowed = await checkRateLimit(`super-admin-reset-pw:${dbUser.id}`, 30, 3600)
    if (!allowed) {
      return errorResponse('Çok fazla şifre sıfırlama isteği. 60 dakika sonra tekrar deneyin.', 429)
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        organizationId: true,
        organization: {
          select: { name: true, slug: true, brandColor: true },
        },
      },
    })

    if (!target) {
      return errorResponse('Kullanıcı bulunamadı', 404)
    }

    if (target.role !== 'admin') {
      return errorResponse('Bu endpoint yalnız hastane admin hesapları için kullanılır', 403)
    }

    if (!target.organization) {
      return errorResponse('Kullanıcı bir organizasyona bağlı değil', 400)
    }

    if (!target.isActive) {
      return errorResponse(
        'Devre dışı kullanıcının şifresi sıfırlanamaz. Önce hesabı aktifleştirin.',
        400,
      )
    }

    const tempPassword = 'Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1' // secret-scanner-disable-line

    const supabase = await createServiceClient()
    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUserId, {
      password: tempPassword,
    })

    if (updateError) {
      logger.error('super-admin:reset-password', 'Supabase şifre güncelleme başarısız', {
        targetUserId,
        error: updateError.message,
      })
      return errorResponse('Şifre güncellenemedi. Lütfen tekrar deneyin.', 500)
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { mustChangePassword: true },
    })

    await audit({
      action: 'user.password.reset_by_super_admin',
      entityType: 'user',
      entityId: targetUserId,
      newData: {
        targetEmail: target.email,
        targetRole: target.role,
        organizationId: target.organizationId,
        // tempPassword AUDIT'e ASLA yazılmaz
      },
    })

    let emailSent = true
    try {
      await sendPasswordResetByAdminEmail({
        to: target.email,
        recipientName: `${target.firstName} ${target.lastName}`,
        organizationName: target.organization.name,
        brandColor: target.organization.brandColor,
        tempPassword,
        loginUrl: `${getOrgUrl(target.organization.slug)}/auth/login`,
        resetByName: `${dbUser.firstName} ${dbUser.lastName} (Klinovax)`,
      })
    } catch (err) {
      emailSent = false
      logger.warn('super-admin:reset-password', 'Şifre sıfırlama maili gönderilemedi', {
        targetUserId,
        error: err instanceof Error ? err.message : err,
      })
    }

    logger.info('super-admin:reset-password', 'Şifre sıfırlandı', {
      superAdminId: dbUser.id,
      targetUserId,
      organizationId: target.organizationId,
      emailSent,
    })

    return jsonResponse({
      success: true,
      userId: target.id,
      email: target.email,
      firstName: target.firstName,
      lastName: target.lastName,
      tempPassword,
      emailSent,
    })
  },
)
