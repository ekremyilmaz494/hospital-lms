import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { seedDemoOrganization } from '@/lib/demo-seed'

export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams, 500)
  const status = searchParams.get('status')
  const where = {
    isDemo: true,
    ...(status === 'active' ? { isActive: true, isSuspended: false } : {}),
    ...(status === 'suspended' ? { isSuspended: true } : {}),
  }

  const [demos, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        subscription: { include: { plan: true } },
        users: {
          where: { role: 'admin' },
          select: { email: true, firstName: true, lastName: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        _count: {
          select: {
            users: true,
            trainings: { where: { isActive: true, publishStatus: { not: 'archived' } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ])

  return jsonResponse({ demos, total, page, limit, totalPages: Math.ceil(total / limit) }, 200, {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  })
})

export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const allowed = await checkRateLimit(`super-admin-demo-create:${dbUser.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla demo oluşturma isteği. Lütfen daha sonra tekrar deneyin.', 429)

  const body = await parseBody<{ filled?: boolean }>(request)
  const filled = typeof body?.filled === 'boolean' ? body.filled : true
  const credentials = await seedDemoOrganization({ filled, createdByUserId: dbUser.id })

  await audit({
    action: 'demo.create',
    entityType: 'organization',
    entityId: credentials.orgId,
    newData: {
      organizationName: credentials.orgName,
      filled,
      adminEmail: credentials.adminEmail,
    },
  })

  return jsonResponse(credentials, 201)
})
