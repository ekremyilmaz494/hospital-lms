import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id: subjectId } = await params
  const { searchParams } = new URL(_request.url)
  const formId = searchParams.get('formId')
  const orgId = dbUser!.organizationId!

  if (!formId) return errorResponse('formId gereklidir', 400)

  // Form doğrulama
  const form = await prisma.competencyForm.findFirst({
    where: { id: formId, organizationId: orgId },
    include: {
      categories: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
    },
  })
  if (!form) return errorResponse('Form bulunamadı', 404)

  // Tüm tamamlanmış değerlendirmeleri getir
  const evaluations = await prisma.competencyEvaluation.findMany({
    where: { formId, subjectId, status: 'COMPLETED' },
    include: {
      evaluator: { select: { id: true, firstName: true, lastName: true } },
      answers: true,
    },
  })

  // Kategori bazlı, değerlendirici tipi bazlı ortalama hesapla
  const typeOrder = ['SELF', 'MANAGER', 'PEER', 'SUBORDINATE']
  const typeLabels: Record<string, string> = {
    SELF: 'Öz Değerlendirme',
    MANAGER: 'Yönetici',
    PEER: 'Akran',
    SUBORDINATE: 'Ast',
  }

  // Her kategori için her tip bazlı ortalama
  const radarData = form.categories.map(cat => {
    const entry: Record<string, string | number> = { category: cat.name }
    const itemIds = cat.items.map(i => i.id)

    for (const type of typeOrder) {
      const typeEvals = evaluations.filter(e => e.evaluatorType === type)
      if (typeEvals.length === 0) continue

      const scores: number[] = []
      for (const ev of typeEvals) {
        const catAnswers = ev.answers.filter(a => itemIds.includes(a.itemId))
        if (catAnswers.length > 0) {
          scores.push(catAnswers.reduce((s, a) => s + a.score, 0) / catAnswers.length)
        }
      }
      if (scores.length > 0) {
        entry[type] = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      }
    }
    return entry
  })

  // Genel ortalama hesapla
  const overallByType: Record<string, number> = {}
  for (const type of typeOrder) {
    const typeEvals = evaluations.filter(e => e.evaluatorType === type)
    if (typeEvals.length === 0) continue
    const allScores = typeEvals.flatMap(e => e.answers.map(a => a.score))
    if (allScores.length > 0) {
      overallByType[type] = parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
    }
  }

  // Güçlü yönler ve gelişim alanları (kategori bazlı genel ortalama)
  const categoryAverages = form.categories.map(cat => {
    const itemIds = cat.items.map(i => i.id)
    const allAnswers = evaluations.flatMap(e =>
      e.answers.filter(a => itemIds.includes(a.itemId))
    )
    const avg = allAnswers.length > 0
      ? allAnswers.reduce((s, a) => s + a.score, 0) / allAnswers.length
      : 0
    return { category: cat.name, weight: cat.weight, avg: parseFloat(avg.toFixed(2)) }
  }).sort((a, b) => b.avg - a.avg)

  const strengths = categoryAverages.filter(c => c.avg >= 4).map(c => c.category)
  const improvements = categoryAverages.filter(c => c.avg < 3).map(c => c.category)

  // Değerlendirme durumu özeti
  const allEvaluations = await prisma.competencyEvaluation.findMany({
    where: { formId, subjectId },
    select: { evaluatorType: true, status: true, evaluator: { select: { firstName: true, lastName: true } } },
  })
  const statusSummary = allEvaluations.map(e => ({
    evaluatorType: typeLabels[e.evaluatorType] ?? e.evaluatorType,
    status: e.status,
    evaluatorName: `${e.evaluator.firstName} ${e.evaluator.lastName}`,
  }))

  const completedCount = allEvaluations.filter(e => e.status === 'COMPLETED').length
  const totalCount = allEvaluations.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return jsonResponse({
    form: { id: form.id, title: form.title },
    radarData,
    overallByType,
    typeLabels,
    strengths,
    improvements,
    statusSummary,
    completedCount,
    totalCount,
    completionRate,
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}
