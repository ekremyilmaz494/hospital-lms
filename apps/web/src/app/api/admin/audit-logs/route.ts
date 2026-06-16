import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  // Pagination clamp — kullanıcı kontrollü take/skip'i sınırla: sınırsız take ağır audit
  // tablosunda DoS/yavaş sorgu üretir, NaN/negatif değer Prisma'yı patlatır. Varsayılan
  // sayfa boyutu (50) korunur; üst sınır 100. (Number(...)||fallback NaN'i de ele alır.)
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get('limit')) || 50)))
  const skip = (page - 1) * limit
  const entityType = searchParams.get('entityType')

  const where: Record<string, unknown> = { organizationId }
  if (entityType) where.entityType = entityType

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return jsonResponse({ logs, total, page, limit, totalPages: Math.ceil(total / limit) }, 200, { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' })
}, { requireOrganization: true })
