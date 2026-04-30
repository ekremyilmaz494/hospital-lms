import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? '1')
  const limit = Number(searchParams.get('limit') ?? '50')
  const entityType = searchParams.get('entityType')
  const action = searchParams.get('action')

  const where: Record<string, unknown> = {}
  if (entityType) where.entityType = entityType
  if (action) where.action = action

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } }, organization: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  const formatted = logs.map(log => {
    const fn = log.user?.firstName ?? ''
    const ln = log.user?.lastName ?? ''
    const name = `${fn} ${ln}`.trim() || log.user?.email || 'Sistem'
    return {
      id: log.id,
      user: name,
      initials: `${fn[0] ?? ''}${ln[0] ?? ''}`.toUpperCase() || 'S',
      color: 'var(--color-primary)',
      action: log.action,
      entity: log.entityId ?? '',
      entityType: log.entityType ?? '',
      ip: log.ipAddress ?? '-',
      time: log.createdAt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }
  })

  return jsonResponse({ logs: formatted, total, page, limit, totalPages: Math.ceil(total / limit) })
})
