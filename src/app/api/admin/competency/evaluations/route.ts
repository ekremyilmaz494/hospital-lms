import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { startEvaluationSchema } from '@/lib/validations'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams)
  const subjectId = searchParams.get('subjectId')
  const formId = searchParams.get('formId')

  const where = {
    form: { organizationId },
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
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = startEvaluationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { formId, subjectId, managerId, peerIds, subordinateIds, includeSelf } = parsed.data

  // Form'un bu organizasyona ait olduğunu doğrula
  const form = await prisma.competencyForm.findFirst({
    where: { id: formId, organizationId },
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
    where: { id: { in: evaluatorIds }, organizationId },
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
        organizationId,
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
      organizationId,
      title: '360° Değerlendirme Başlatıldı',
      message: `"${form.title}" formu kapsamında hakkınızda ${evaluators.length} kişilik değerlendirme süreci başlatıldı.`,
      type: 'competency_evaluation',
    },
  })

  await audit({
    action: 'CREATE',
    entityType: 'CompetencyEvaluation',
    entityId: subjectId,
    newData: { created: created.length, total: evaluators.length },
  })

  return jsonResponse({ created: created.length, total: evaluators.length }, 201)
}, { requireOrganization: true })
