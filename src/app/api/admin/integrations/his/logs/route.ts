import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'

/** GET /api/admin/integrations/his/logs — Sayfalı sync log listesi */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams)

  const integration = await prisma.hisIntegration.findFirst({
    where: { organizationId: dbUser!.organizationId! },
    select: { id: true },
  })

  if (!integration) {
    return jsonResponse({ logs: [], total: 0, page, limit, totalPages: 0 })
  }

  const [logs, total] = await Promise.all([
    prisma.syncLog.findMany({
      where: {
        organizationId: dbUser!.organizationId!,
        integrationId: integration.id,
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        syncType: true,
        status: true,
        totalRecords: true,
        processedRecords: true,
        startedAt: true,
        completedAt: true,
        // errors alanı listede gösterilmez — sadece detay sayfasında
      },
    }),
    prisma.syncLog.count({
      where: {
        organizationId: dbUser!.organizationId!,
        integrationId: integration.id,
      },
    }),
  ])

  // Hata sayısını ekle (errors dizisinin uzunluğu)
  const logsWithErrorCount = await Promise.all(
    logs.map(async (log) => {
      const full = await prisma.syncLog.findUnique({
        where: { id: log.id },
        select: { errors: true },
      })
      const errors = full?.errors as unknown[]
      return { ...log, errorCount: Array.isArray(errors) ? errors.length : 0 }
    })
  )

  return jsonResponse({
    logs: logsWithErrorCount,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
