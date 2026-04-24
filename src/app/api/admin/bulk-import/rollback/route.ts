import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
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
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`bulk-rollback:${dbUser!.id}`, 5, 3600)
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

  const data = log.newData as { createdUserIds?: string[] } | null
  const userIds = data?.createdUserIds ?? []

  if (userIds.length === 0) {
    return errorResponse('Bu kayıt geri alınamaz (eski kayıt, kullanıcı ID bilgisi yok)', 400)
  }

  // Güvenlik: sadece bu organizasyondaki + audit log'da listelenen kullanıcılar
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, organizationId: orgId },
    select: { id: true, email: true },
  })

  if (users.length === 0) {
    return errorResponse('Bu yüklemedeki kullanıcılar zaten silinmiş', 400)
  }

  const supabase = await createServiceClient()
  let deleted = 0
  let failed = 0
  const failedEmails: string[] = []

  for (const user of users) {
    try {
      // 1. Supabase Auth'tan sil (kullanıcı bir daha giremez)
      await supabase.auth.admin.deleteUser(user.id)
      // 2. DB'den sil (cascade ilişkileri schema'ya göre)
      await prisma.user.delete({ where: { id: user.id } })
      deleted++
    } catch (err) {
      failed++
      failedEmails.push(user.email)
      logger.error('bulk-rollback', `Silme başarısız: ${user.email}`, err instanceof Error ? err.message : err)
    }
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'bulk_rollback',
    entityType: 'user',
    entityId: batchId,
    newData: {
      originalBatchId: batchId,
      originalDate: log.createdAt,
      deleted,
      failed,
      failedEmails: failedEmails.slice(0, 20),
    },
    request,
  })

  revalidatePath('/admin/staff')
  try { await invalidateDashboardCache(orgId) } catch {}
  try { await invalidateOrgCache(orgId, 'staff') } catch {}

  return jsonResponse({ deleted, failed, total: users.length })
}
