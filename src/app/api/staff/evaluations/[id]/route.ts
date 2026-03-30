import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const { id } = await params
  const userId = dbUser!.id

  const evaluation = await prisma.competencyEvaluation.findFirst({
    where: {
      id,
      evaluatorId: userId,
      form: { organizationId: dbUser!.organizationId! },
    },
    include: {
      form: {
        include: {
          categories: {
            orderBy: { order: 'asc' },
            include: { items: { orderBy: { order: 'asc' } } },
          },
        },
      },
      subject: { select: { firstName: true, lastName: true, title: true, departmentRel: { select: { name: true } } } },
      answers: true,
    },
  })

  if (!evaluation) return errorResponse('Değerlendirme bulunamadı', 404)

  // Kaç madde var, kaçı cevaplandı
  const totalItems = evaluation.form.categories.flatMap(c => c.items).length
  const answeredItems = evaluation.answers.length
  const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0

  return jsonResponse({ evaluation, totalItems, answeredItems, progress })
}
