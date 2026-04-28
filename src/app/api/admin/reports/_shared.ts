import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'

/**
 * Tab bazlı rapor endpoint'leri için ortak yardımcılar.
 * Her endpoint kendi sorgusunu yapar; bu modül sadece filtre çözümlemesi
 * ve ortak sabitleri içerir.
 */

// DoS koruması — kapasite aşılırsa UI'da uyarı göster
export const TRAINING_CAP = 500
export const STAFF_CAP = 2000

export interface ReportFilters {
  orgId: string
  dateFrom?: Date
  dateTo?: Date
  departmentId?: string
}

export interface ResolvedFilters extends ReportFilters {
  assignmentDateFilter: Record<string, unknown>
  attemptDateFilter: Record<string, unknown>
  userDeptFilter: Record<string, unknown>
  trainingScope: { organizationId: string; isActive: true; publishStatus: { not: 'archived' } }
}

/**
 * URL search params'tan filtre çözümle ve departman izolasyonunu doğrula.
 * Hata varsa Response döner (caller early-return etmeli).
 */
export async function resolveReportFilters(
  request: Request,
  orgId: string,
): Promise<{ filters: ResolvedFilters; error: null } | { filters: null; error: Response }> {
  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const departmentId = searchParams.get('departmentId')

  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  let validatedDeptId: string | undefined
  if (departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true },
    })
    if (!dept) {
      return { filters: null, error: errorResponse('Departman bulunamadı veya bu organizasyona ait değil', 403) }
    }
    validatedDeptId = dept.id
  }

  const userDeptFilter: Record<string, unknown> = validatedDeptId ? { departmentId: validatedDeptId } : {}

  const assignmentDateFilter: Record<string, unknown> = dateFrom || dateTo ? {
    assignedAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  const attemptDateFilter: Record<string, unknown> = dateFrom || dateTo ? {
    createdAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  return {
    filters: {
      orgId,
      dateFrom,
      dateTo,
      departmentId: validatedDeptId,
      assignmentDateFilter,
      attemptDateFilter,
      userDeptFilter,
      trainingScope: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } },
    },
    error: null,
  }
}

// Cache-Control: private, max-age=30, stale-while-revalidate=60
export const REPORTS_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
}
