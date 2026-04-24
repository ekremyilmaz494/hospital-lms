import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { autoAssignByDepartment } from '@/lib/auto-assign'
import type { UserRole } from '@/types/database'

type Params = { params: Promise<{ id: string }> }

/** GET /api/admin/departments/[id]/training-rules — Departman eğitim kurallarını listele */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: departmentId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const rules = await prisma.departmentTrainingRule.findMany({ // perf-check-disable-line
    where: { departmentId, organizationId: dbUser!.organizationId! },
    include: {
      training: { select: { id: true, title: true, category: true, isActive: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return jsonResponse(rules, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

/** POST /api/admin/departments/[id]/training-rules — Yeni kural ekle */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: departmentId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody<{ trainingId: string }>(request)
  if (!body?.trainingId) return errorResponse('trainingId zorunlu')

  const orgId = dbUser!.organizationId!

  // Departman bu hastaneye ait mi?
  const dept = await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } }) // perf-check-disable-line
  if (!dept) return errorResponse('Departman bulunamadı', 404)

  // Eğitim bu hastaneye ait mi?
  const training = await prisma.training.findFirst({ where: { id: body.trainingId, organizationId: orgId } }) // perf-check-disable-line
  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Kural zaten var mı?
  const existing = await prisma.departmentTrainingRule.findUnique({ // perf-check-disable-line
    where: { departmentId_trainingId: { departmentId, trainingId: body.trainingId } },
  })
  if (existing) return errorResponse('Bu kural zaten mevcut')

  const rule = await prisma.departmentTrainingRule.create({ // perf-check-disable-line
    data: { departmentId, trainingId: body.trainingId, organizationId: orgId },
    include: { training: { select: { id: true, title: true, category: true, isActive: true } } },
  })

  // Mevcut departman üyelerine otomatik ata
  const deptUsers = await prisma.user.findMany({ // perf-check-disable-line
    where: { departmentId, organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
    select: { id: true },
  })

  let autoAssigned = 0
  for (const user of deptUsers) {
    const count = await autoAssignByDepartment(user.id, departmentId, orgId, dbUser!.id)
    autoAssigned += count
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'department.training_rule.create',
    entityType: 'department_training_rule',
    entityId: rule.id,
    newData: { departmentId, trainingId: body.trainingId, autoAssigned },
    request,
  })

  return jsonResponse({ rule, autoAssigned }, 201)
}

/** DELETE /api/admin/departments/[id]/training-rules — Kural sil */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: departmentId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('ruleId')
  if (!ruleId) return errorResponse('ruleId query parametresi zorunlu')

  const rule = await prisma.departmentTrainingRule.findFirst({ // perf-check-disable-line
    where: { id: ruleId, departmentId, organizationId: dbUser!.organizationId! },
  })
  if (!rule) return errorResponse('Kural bulunamadı', 404)

  await prisma.departmentTrainingRule.delete({ where: { id: ruleId } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'department.training_rule.delete',
    entityType: 'department_training_rule',
    entityId: ruleId,
    request,
  })

  return jsonResponse({ deleted: true })
}
