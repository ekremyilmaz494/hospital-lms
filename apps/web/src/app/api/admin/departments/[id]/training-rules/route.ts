import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { autoAssignByDepartment } from '@/lib/auto-assign'
import type { UserRole } from '@/types/database'

/** GET /api/admin/departments/[id]/training-rules — Departman eğitim kurallarını listele */
export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id: departmentId } = params

  const rules = await prisma.departmentTrainingRule.findMany({ // perf-check-disable-line
    where: { departmentId, organizationId },
    include: {
      training: { select: { id: true, title: true, category: true, isActive: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return jsonResponse(rules, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

/** POST /api/admin/departments/[id]/training-rules — Yeni kural ekle */
export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id: departmentId } = params

  const body = await parseBody<{ trainingId: string }>(request)
  if (!body?.trainingId) return errorResponse('trainingId zorunlu')

  // Departman bu hastaneye ait mi?
  const dept = await prisma.department.findFirst({ where: { id: departmentId, organizationId } }) // perf-check-disable-line
  if (!dept) return errorResponse('Departman bulunamadı', 404)

  // Eğitim bu hastaneye ait mi?
  const training = await prisma.training.findFirst({ where: { id: body.trainingId, organizationId } }) // perf-check-disable-line
  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Kural zaten var mı?
  const existing = await prisma.departmentTrainingRule.findUnique({ // perf-check-disable-line
    where: { departmentId_trainingId: { departmentId, trainingId: body.trainingId } },
  })
  if (existing) return errorResponse('Bu kural zaten mevcut')

  const rule = await prisma.departmentTrainingRule.create({ // perf-check-disable-line
    data: { departmentId, trainingId: body.trainingId, organizationId },
    include: { training: { select: { id: true, title: true, category: true, isActive: true } } },
  })

  // Mevcut departman üyelerine otomatik ata
  const deptUsers = await prisma.user.findMany({ // perf-check-disable-line
    where: { departmentId, organizationId, role: 'staff' satisfies UserRole, isActive: true },
    select: { id: true },
  })

  let autoAssigned = 0
  for (const user of deptUsers) {
    const count = await autoAssignByDepartment(user.id, departmentId, organizationId, dbUser.id)
    autoAssigned += count
  }

  await audit({
    action: 'department.training_rule.create',
    entityType: 'department_training_rule',
    entityId: rule.id,
    newData: { departmentId, trainingId: body.trainingId, autoAssigned },
  })

  return jsonResponse({ rule, autoAssigned }, 201)
}, { requireOrganization: true })

/** DELETE /api/admin/departments/[id]/training-rules — Kural sil */
export const DELETE = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id: departmentId } = params

  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('ruleId')
  if (!ruleId) return errorResponse('ruleId query parametresi zorunlu')

  const rule = await prisma.departmentTrainingRule.findFirst({ // perf-check-disable-line
    where: { id: ruleId, departmentId, organizationId },
  })
  if (!rule) return errorResponse('Kural bulunamadı', 404)

  await prisma.departmentTrainingRule.delete({ where: { id: ruleId } })

  await audit({
    action: 'department.training_rule.delete',
    entityType: 'department_training_rule',
    entityId: ruleId,
  })

  return jsonResponse({ deleted: true })
}, { requireOrganization: true })
