import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

/**
 * GET /api/super-admin/backups
 * Tüm organizasyonların yedeklerini (platform-geneli) listeler — geri yükleme sayfası için.
 * Geri yükleme yalnız super_admin'in işidir; bu liste o akışın giriş noktasıdır.
 */
export const GET = withSuperAdminRoute(async () => {
  const backups = await prisma.dbBackup.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      organizationId: true,
      backupType: true,
      status: true,
      verified: true,
      fileSizeMb: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
  })

  return jsonResponse(
    {
      backups: backups.map((b) => ({
        id: b.id,
        organizationId: b.organizationId,
        organizationName: b.organization?.name ?? '(platform geneli)',
        backupType: b.backupType,
        status: b.status,
        verified: b.verified,
        fileSizeMb: b.fileSizeMb != null ? Number(b.fileSizeMb) : null,
        createdAt: b.createdAt,
      })),
    },
    200,
    { 'Cache-Control': 'private, no-store' },
  )
})
