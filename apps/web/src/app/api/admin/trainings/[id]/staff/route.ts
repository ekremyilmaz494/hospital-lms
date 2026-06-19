import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { jsonResponse, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * GET /api/admin/trainings/[id]/staff?page&limit&search&status
 *
 * Eğitim detayındaki personel listesi — sunucu-taraflı sayfalama + arama + durum
 * filtresi. Detay GET'i (`[id]/route.ts`) artık tüm atamaları çekmiyor (5000+
 * atamalı org'larda ağırdı); bu endpoint flatten `assignedStaff` şeklini döndürür.
 * Stat kartları/sekme sayaçları detay GET'in `statusBreakdown`'ından beslenir.
 */
const COMPLETED_STATUSES = ['passed', 'failed']
const INCOMPLETE_STATUSES = ['in_progress', 'assigned']

export const GET = withAdminRoute<{ id: string }>(async ({ request, params, organizationId }) => {
  const { id } = params
  const url = new URL(request.url)
  const { page, limit, skip } = safePagination(url.searchParams)
  const search = (url.searchParams.get('search') ?? '').trim()
  const statusFilter = url.searchParams.get('status') // 'completed' | 'incomplete' | null

  const where: Prisma.TrainingAssignmentWhereInput = {
    trainingId: id,
    organizationId,
  }
  if (statusFilter === 'completed') where.status = { in: COMPLETED_STATUSES }
  else if (statusFilter === 'incomplete') where.status = { in: INCOMPLETE_STATUSES }
  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }
  }

  const [total, assignments] = await Promise.all([
    prisma.trainingAssignment.count({ where }),
    prisma.trainingAssignment.findMany({
      where,
      select: {
        id: true,
        currentAttempt: true,
        status: true,
        completedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            departmentRel: { select: { name: true } },
          },
        },
        examAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
          select: {
            preExamScore: true,
            postExamScore: true,
            preExamCompletedAt: true,
            videosCompletedAt: true,
            postExamCompletedAt: true,
            signedAt: true,
            signatureMethod: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: limit,
    }),
  ])

  const assignedStaff = assignments.map((a) => {
    const latest = a.examAttempts[0]
    const progress = (() => {
      if (!latest) return 0
      const steps = [
        !!latest.preExamCompletedAt,
        !!latest.videosCompletedAt,
        !!latest.postExamCompletedAt,
      ]
      return Math.round((steps.filter(Boolean).length / 3) * 100)
    })()
    return {
      assignmentId: a.id,
      userId: a.user.id,
      name: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim() || a.user.email,
      department: a.user.departmentRel?.name ?? '',
      attempt: a.currentAttempt,
      progress,
      preScore: latest?.preExamScore ? Number(latest.preExamScore) : null,
      postScore: latest?.postExamScore ? Number(latest.postExamScore) : null,
      status: a.status,
      completedAt: a.completedAt ? a.completedAt.toISOString() : '',
      signedAt: latest?.signedAt?.toISOString() ?? null,
      signatureMethod: latest?.signatureMethod ?? null,
    }
  })

  return jsonResponse(
    { assignedStaff, total, page, limit },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })
