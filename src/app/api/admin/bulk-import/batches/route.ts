import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'
import type { UserRole } from '@/types/database'

/**
 * Son toplu yükleme işlemlerini listeler.
 * audit_log tablosundaki action='bulk_import' kayıtlarından okunur.
 * Her kayıt: kim yükledi, kaç kişi ekledi, geri alınabilir mi.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: { organizationId: orgId, action: 'bulk_import', entityType: 'user' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        newData: true,
        userId: true,
      },
    }),
    // Hangi admin yaptı — isim bilgisi için
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'admin' satisfies UserRole },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ])

  const adminMap = new Map(users.map(u => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email]))

  // createdUserIds'deki kullanıcılar hâlâ aktif mi? Kontrol et (rollback anlamlı mı?)
  const allCreatedIds = logs.flatMap(l => {
    const data = l.newData as { createdUserIds?: string[] } | null
    return data?.createdUserIds ?? []
  })
  const activeUsers = allCreatedIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allCreatedIds }, organizationId: orgId, isActive: true },
        select: { id: true },
      })
    : []
  const activeUserSet = new Set(activeUsers.map(u => u.id))

  const batches = logs.map(log => {
    const data = log.newData as {
      totalRows?: number
      created?: number
      failed?: number
      createdUserIds?: string[]
    } | null

    const createdIds = data?.createdUserIds ?? []
    const stillActive = createdIds.filter(id => activeUserSet.has(id)).length

    return {
      id: log.id,
      createdAt: log.createdAt,
      adminName: log.userId ? adminMap.get(log.userId) : 'Bilinmiyor',
      totalRows: data?.totalRows ?? 0,
      created: data?.created ?? 0,
      failed: data?.failed ?? 0,
      stillActive,
      // Eski kayıtlarda createdUserIds yok → rollback edilemez
      canRollback: createdIds.length > 0 && stillActive > 0,
    }
  })

  return jsonResponse({ batches }, 200, {
    'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
  })
}
