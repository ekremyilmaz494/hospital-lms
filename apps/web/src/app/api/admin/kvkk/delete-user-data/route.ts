import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { anonymizeUserData, ANON_FIRST_NAME, ANON_LAST_NAME } from '@/lib/kvkk/anonymize-user'

interface DeleteUserDataBody {
  userId: string
  organizationId?: string // Super admin için zorunlu — hedef organizasyon
}

export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  // ── Parse body ──
  const body = await parseBody<DeleteUserDataBody>(request)
  if (!body?.userId) {
    return errorResponse('userId alanı gereklidir.', 400)
  }

  const { userId } = body

  try {
    // ── Find target user ──
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
      },
    })

    if (!targetUser) {
      return errorResponse('Kullanıcı bulunamadı.', 404)
    }

    // ── Tenant isolation: admin kendi org'unda, super_admin herhangi birinde değil ──
    // Super admin bile sadece belirli bir organizasyondaki kullanıcıyı silebilir
    // (yanlışlıkla cross-org silmeyi önle)
    if (targetUser.organizationId !== organizationId && dbUser.role !== 'super_admin') {
      return errorResponse('Bu kullanıcı üzerinde işlem yetkiniz bulunmamaktadır.', 403)
    }
    // Super admin için: hedef kullanıcının organizationId'si body'den gelen org ile eşleşmeli
    if (dbUser.role === 'super_admin' && !body.organizationId) {
      return errorResponse('Super admin KVKK silme işlemi için organizationId zorunludur.', 400)
    }
    if (dbUser.role === 'super_admin' && body.organizationId && targetUser.organizationId !== body.organizationId) {
      return errorResponse('Kullanıcı belirtilen organizasyona ait değil.', 403)
    }

    // ── Prevent deleting other admins / super_admins ──
    if (targetUser.role === 'super_admin') {
      return errorResponse('Süper admin verileri bu yöntemle silinemez.', 403)
    }

    // ── Anonymize user data ──
    // KVKK m.7: Talep üzerine kişisel veri SİLİNMELİ (yok edilmeli/anonimleştirilmeli).
    // Anonimleştirme kapsamı tek yerde: `anonymizeUserData` (JSDoc'una bak). Personel purge akışı
    // (`api/admin/staff/[id]?purge=true`) da aynı helper'ı kullanır — kapsam bir yerden güncellenir.
    const oldData = {
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      phone: '[REDACTED]',
    }

    const { anonymizedEmail } = await anonymizeUserData(userId)

    // ── Audit log ──
    await audit({
      action: 'KVKK_DATA_DELETION',
      entityType: 'User',
      entityId: userId,
      oldData,
      newData: {
        firstName: ANON_FIRST_NAME,
        lastName: ANON_LAST_NAME,
        email: anonymizedEmail,
        phone: null,
      },
    })

    logger.info('kvkk', 'Kullanıcı verileri anonimleştirildi', {
      targetUserId: userId,
      performedBy: dbUser.id,
    })

    return jsonResponse({
      message: 'Kullanıcı kişisel verileri başarıyla anonimleştirildi.',
      userId,
    })
  } catch (err) {
    logger.error('kvkk', 'Veri silme işlemi sırasında hata', err)
    return errorResponse('Veri silme işlemi sırasında bir hata oluştu.', 500)
  }
}, { requireOrganization: true })
