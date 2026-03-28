import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

interface DeleteUserDataBody {
  userId: string
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

    // ── Tenant isolation: admin can only delete users in their own org ──
    if (dbUser!.role === 'admin' && targetUser.organizationId !== dbUser!.organizationId) {
      return errorResponse('Bu kullanıcı üzerinde işlem yetkiniz bulunmamaktadır.', 403)
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

    await prisma.user.update({
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
    })

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
