import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, safePagination, createAuditLog } from '@/lib/api-helpers'
import { startEvaluationSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams)
  const subjectId = searchParams.get('subjectId')
  const formId = searchParams.get('formId')
  const orgId = dbUser!.organizationId!

  const where = {
    form: { organizationId: orgId },
    ...(subjectId ? { subjectId } : {}),
    ...(formId ? { formId } : {}),
  }

  const [evaluations, total] = await Promise.all([
    prisma.competencyEvaluation.findMany({
      where,
      include: {
        subject: { select: { id: true, firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
        evaluator: { select: { id: true, firstName: true, lastName: true } },
        form: { select: { id: true, title: true } },
        _count: { select: { answers: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.competencyEvaluation.count({ where }),
  ])

  return jsonResponse({ evaluations, total, page, limit }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = startEvaluationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { formId, subjectId, managerId, peerIds, subordinateIds, includeSelf } = parsed.data
  const orgId = dbUser!.organizationId!

  // Form'un bu organizasyona ait olduğunu doğrula
  const form = await prisma.competencyForm.findFirst({
    where: { id: formId, organizationId: orgId },
  })
  if (!form) return errorResponse('Form bulunamadı', 404)

  // Tüm değerlendiricileri topla
  type Evaluator = { id: string; type: 'SELF' | 'MANAGER' | 'PEER' | 'SUBORDINATE' }
  const evaluators: Evaluator[] = []
  if (includeSelf) evaluators.push({ id: subjectId, type: 'SELF' })
  if (managerId) evaluators.push({ id: managerId, type: 'MANAGER' })
  for (const id of peerIds) evaluators.push({ id, type: 'PEER' })
  for (const id of subordinateIds) evaluators.push({ id, type: 'SUBORDINATE' })

  if (evaluators.length === 0) return errorResponse('En az bir değerlendirici gereklidir')

  // Tüm evaluator ID'lerinin bu organizasyona ait olduğunu doğrula
  const evaluatorIds = evaluators.map(e => e.id)
  const validUsers = await prisma.user.findMany({
    where: { id: { in: evaluatorIds }, organizationId: orgId },
    select: { id: true },
  })
  if (validUsers.length !== evaluatorIds.length) {
    return errorResponse('Bazı değerlendiriciler bu kuruluşa ait değil', 400)
  }

  // Evaluations oluştur (mevcut olanları atla)
  const created: string[] = []
  for (const ev of evaluators) {
    try {
      await prisma.competencyEvaluation.create({
        data: { formId, subjectId, evaluatorId: ev.id, evaluatorType: ev.type },
      })
      created.push(ev.id)
    } catch {
      // Zaten mevcut (unique constraint) — atla
    }
  }

  // Değerlendiricilere (kendisi hariç) bildirim gönder
  const notifTargets = evaluators.filter(e => e.id !== subjectId)
  const subject = await prisma.user.findUnique({
    where: { id: subjectId },
    select: { firstName: true, lastName: true },
  })

  if (notifTargets.length > 0 && subject) {
    await prisma.notification.createMany({
      data: notifTargets.map(e => ({
        userId: e.id,
        organizationId: orgId,
        title: 'Yeni Yetkinlik Değerlendirmesi',
        message: `"${form.title}" formu kapsamında ${subject.firstName} ${subject.lastName} için değerlendirme yapmanız bekleniyor.`,
        type: 'competency_evaluation',
      })),
      skipDuplicates: true,
    })
  }

  // Değerlendirilen kişiye bildirim
  await prisma.notification.create({
    data: {
      userId: subjectId,
      organizationId: orgId,
      title: '360° Değerlendirme Başlatıldı',
      message: `"${form.title}" formu kapsamında hakkınızda ${evaluators.length} kişilik değerlendirme süreci başlatıldı.`,
      type: 'competency_evaluation',
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'CREATE',
    entityType: 'CompetencyEvaluation',
    entityId: subjectId,
    newData: { created: created.length, total: evaluators.length },
    request,
  })

  return jsonResponse({ created: created.length, total: evaluators.length }, 201)
}
