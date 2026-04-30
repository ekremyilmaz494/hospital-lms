import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'

const CACHE_TTL = 300 // 5 dakika
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=180' }

export const GET = withAdminRoute(async ({ organizationId: orgId }) => {
  const cacheKey = `dashboard:certs:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, CACHE_HEADERS)

  try {
    const now = new Date()
    const sixtyDays = new Date(now.getTime() + 60 * 86400000)

    const expiringCertsData = await prisma.certificate.findMany({
      where: {
        training: { organizationId: orgId },
        expiresAt: { gte: now, lte: sixtyDays },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        training: { select: { title: true } },
      },
      orderBy: { expiresAt: 'asc' },
      take: 10,
    })

    const expiringCerts = expiringCertsData.map(c => {
      const daysLeft = Math.ceil((new Date(c.expiresAt!).getTime() - now.getTime()) / 86400000)
      return {
        name: `${c.user.firstName} ${c.user.lastName}`,
        cert: c.training.title,
        expiryDate: new Date(c.expiresAt!).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        daysLeft,
        status: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
      }
    })

    const responseData = { expiringCerts }

    await setCached(cacheKey, responseData, CACHE_TTL)
    return jsonResponse(responseData, 200, CACHE_HEADERS)
  } catch (err) {
    logger.error('Dashboard Certs', 'Sertifika verileri alinamadi', err instanceof Error ? err.message : err)
    return errorResponse('Sertifika verileri alinamadi', 503)
  }
}, { requireOrganization: true })
