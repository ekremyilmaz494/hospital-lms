import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { checkRateLimit, invalidateOrgCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { z } from 'zod/v4'

const rollbackSchema = z.object({
  batchId: z.string().uuid({ message: 'Geçersiz batch ID' }),
})

/**
 * Toplu yüklemenin geri alınması — auditLogId verildiğinde:
 *  1. Audit log okunur, createdUserIds alınır
 *  2. Her kullanıcı için Supabase Auth + DB kaydı silinir
 *  3. Yeni bir audit log yazılır (rollback event)
 *
 * Güvenlik:
 *  - Sadece admin rolü
 *  - Batch organizasyona ait olmalı (cross-tenant koruma)
 *  - Rate limit: 5 rollback / saat
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const orgId = organizationId

  const allowed = await checkRateLimit(`bulk-rollback:${dbUser.id}`, 5, 3600)
  if (!allowed) return errorResponse('Saatte en fazla 5 geri alma işlemi. Lütfen bekleyin.', 429)

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek')

  const parsed = rollbackSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Geçersiz batch ID')

  const { batchId } = parsed.data

  // Audit log'u bul ve doğrula
  const log = await prisma.auditLog.findFirst({
    where: {
      id: batchId,
      organizationId: orgId,  // ← cross-tenant koruma
      action: 'bulk_import',
      entityType: 'user',
    },
    select: { id: true, newData: true, createdAt: true },
  })

  if (!log) return errorResponse('Yükleme kaydı bulunamadı veya başka organizasyona ait', 404)

  const data = log.newData as { createdUserIds?: string[]; createdInvitationIds?: string[] } | null
  const userIds = data?.createdUserIds ?? []
  const invitationIds = data?.createdInvitationIds ?? []

  if (userIds.length === 0 && invitationIds.length === 0) {
    return errorResponse('Bu kayıt geri alınamaz (eski kayıt, kullanıcı/davet ID bilgisi yok)', 400)
  }

  // Güvenlik: sadece bu organizasyondaki + audit log'da listelenen kullanıcılar
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, organizationId: orgId },
        select: { id: true, email: true },
      })
    : []

  // Davet kayıtları — bu org'a ait + henüz kabul edilmemiş olanlar
  const pendingInvitations = invitationIds.length > 0
    ? await prisma.invitation.findMany({
        where: {
          id: { in: invitationIds },
          organizationId: orgId,
          acceptedAt: null,
          revokedAt: null,
        },
        select: { id: true, email: true },
      })
    : []

  if (users.length === 0 && pendingInvitations.length === 0) {
    return errorResponse('Bu yüklemedeki kullanıcılar/davetler zaten silinmiş veya kabul edilmiş', 400)
  }

  const supabase = await createServiceClient()
  let deleted = 0
  let revoked = 0
  let failed = 0
  const failedEmails: string[] = []

  // 1. Direct mode kullanıcıları sil (Auth + DB)
  for (const user of users) {
    try {
      await supabase.auth.admin.deleteUser(user.id)
      await prisma.user.delete({ where: { id: user.id } })
      deleted++
    } catch (err) {
      failed++
      failedEmails.push(user.email)
      logger.error('bulk-rollback', `Silme başarısız: ${user.email}`, err instanceof Error ? err.message : err)
    }
  }

  // 2. Invite mode bekleyen davetleri revoke et (link 410 dönecek)
  if (pendingInvitations.length > 0) {
    try {
      const result = await prisma.invitation.updateMany({
        where: {
          id: { in: pendingInvitations.map(i => i.id) },
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      })
      revoked = result.count
    } catch (err) {
      // Davet revoke başarısız → toplu sayım failed'a düşmesin, ayrı raporla
      logger.error('bulk-rollback', 'Davet revoke başarısız', err instanceof Error ? err.message : err)
      failed += pendingInvitations.length
      failedEmails.push(...pendingInvitations.map(i => i.email))
    }
  }

  await audit({
    action: 'bulk_rollback',
    entityType: 'user',
    entityId: batchId,
    newData: {
      originalBatchId: batchId,
      originalDate: log.createdAt,
      deleted,
      revoked,
      failed,
      failedEmails: failedEmails.slice(0, 20),
    },
  })

  revalidatePath('/admin/staff')
  try { await invalidateDashboardCache(orgId) } catch {}
  try { await invalidateOrgCache(orgId, 'staff') } catch {}

  return jsonResponse({
    deleted,
    revoked,
    failed,
    total: users.length + pendingInvitations.length,
  })
}, { requireOrganization: true })
