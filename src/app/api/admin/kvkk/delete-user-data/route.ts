import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

interface DeleteUserDataBody {
  userId: string
  organizationId?: string // Super admin için zorunlu — hedef organizasyon
}

export async function POST(request: Request) {
  // ── Auth & role check ──
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

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
        tcNo: true,
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
    if (targetUser.organizationId !== dbUser!.organizationId && dbUser!.role !== 'super_admin') {
      return errorResponse('Bu kullanıcı üzerinde işlem yetkiniz bulunmamaktadır.', 403)
    }
    // Super admin için: hedef kullanıcının organizationId'si body'den gelen org ile eşleşmeli
    if (dbUser!.role === 'super_admin' && !body.organizationId) {
      return errorResponse('Super admin KVKK silme işlemi için organizationId zorunludur.', 400)
    }
    if (dbUser!.role === 'super_admin' && body.organizationId && targetUser.organizationId !== body.organizationId) {
      return errorResponse('Kullanıcı belirtilen organizasyona ait değil.', 403)
    }

    // ── Prevent deleting other admins / super_admins ──
    if (targetUser.role === 'super_admin') {
      return errorResponse('Süper admin verileri bu yöntemle silinemez.', 403)
    }

    // ── Anonymize user data ──
    const anonymizedEmail = `deleted_${randomUUID()}@anonymized.local`

    const oldData = {
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      tcNo: '[REDACTED]',
      phone: '[REDACTED]',
    }

    // KVKK Tam Anonimleştirme — tüm ilişkili tablolardaki PII temizlenir
    await prisma.$transaction([
      // 1. Ana kullanıcı tablosu
      prisma.user.update({
        where: { id: userId },
        data: {
          firstName: 'Silinmiş',
          lastName: 'Kullanıcı',
          email: anonymizedEmail,
          tcNo: null,
          phone: null,
          avatarUrl: null,
          isActive: false,
        },
      }),
      // 2. Audit log — oldData/newData içindeki PII'yı temizle
      prisma.auditLog.updateMany({
        where: { entityType: 'User', entityId: userId },
        data: {
          oldData: { redacted: true, reason: 'KVKK_DATA_DELETION' },
          newData: { redacted: true, reason: 'KVKK_DATA_DELETION' },
        },
      }),
      // 3. Kullanıcının oluşturduğu audit loglar — IP ve User-Agent temizle
      prisma.auditLog.updateMany({
        where: { userId },
        data: { ipAddress: null, userAgent: null },
      }),
      // 4. Sertifikalar — kullanıcı adı sertifika kodunda olabilir
      prisma.certificate.updateMany({
        where: { userId },
        data: { certificateCode: `CERT-REDACTED-${userId.slice(0, 8)}` },
      }),
      // 5. Bildirimler — kişiye özel içerik olabilir
      prisma.notification.deleteMany({
        where: { userId },
      }),
    ])

    // ── Audit log ──
    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      action: 'KVKK_DATA_DELETION',
      entityType: 'User',
      entityId: userId,
      oldData,
      newData: {
        firstName: 'Silinmiş',
        lastName: 'Kullanıcı',
        email: anonymizedEmail,
        tcNo: null,
        phone: null,
      },
      request,
    })

    logger.info('kvkk', 'Kullanıcı verileri anonimleştirildi', {
      targetUserId: userId,
      performedBy: dbUser!.id,
    })

    return jsonResponse({
      message: 'Kullanıcı kişisel verileri başarıyla anonimleştirildi.',
      userId,
    })
  } catch (err) {
    logger.error('kvkk', 'Veri silme işlemi sırasında hata', err)
    return errorResponse('Veri silme işlemi sırasında bir hata oluştu.', 500)
  }
}
