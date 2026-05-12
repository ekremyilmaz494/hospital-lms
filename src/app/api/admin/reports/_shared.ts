import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { z } from 'zod/v4'

const periodIdSchema = z.string().uuid()

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
  periodId?: string
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
  const periodIdParam = searchParams.get('periodId')

  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  // Geçersiz UUID gelirse sessizce undefined — caller aktif period'a düşer
  const periodIdParsed = periodIdParam ? periodIdSchema.safeParse(periodIdParam) : null
  const periodId = periodIdParsed?.success ? periodIdParsed.data : undefined

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
      periodId,
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

export interface DepartmentHierarchy {
  childrenByParent: Map<string, string[]>
  validIds: Set<string>
}

/**
 * `rawDepartments` listesinden parent→children map'i ve geçerli id seti üretir.
 * Birden çok kez subtree expansion yapılacaksa (örn. tüm departmanlar için
 * staffCount hesabı), tek pass build edip helper'a inject edin — O(n²) yerine
 * O(n+m).
 */
export function buildDepartmentHierarchy(
  rawDepartments: { id: string; parentId: string | null }[],
): DepartmentHierarchy {
  const childrenByParent = new Map<string, string[]>()
  for (const d of rawDepartments) {
    if (!d.parentId) continue
    const list = childrenByParent.get(d.parentId)
    if (list) list.push(d.id)
    else childrenByParent.set(d.parentId, [d.id])
  }
  return { childrenByParent, validIds: new Set(rawDepartments.map(d => d.id)) }
}

/**
 * Verilen departman id'lerini BFS ile genişletir: tüm descendants (self dahil).
 * Hiyerarşik departman filtreleri için tek nokta — staff listesi, raporlar,
 * wizard, dashboard hepsi aynı semantiği kullanır: bir parent seçildiğinde
 * alt birimlerdeki kullanıcılar da kapsama girer.
 *
 * Cross-tenant koruma: `validIds` setinde geçmeyen id'ler sessizce atlanır
 * (geriye 0 sonuç dönecek bir filtrede güvenle kullanılır).
 */
export function expandDepartmentSubtree(
  hierarchy: DepartmentHierarchy,
  rootIds: string[],
): string[] {
  if (rootIds.length === 0) return []
  const { childrenByParent, validIds } = hierarchy
  const result: string[] = []
  const seen = new Set<string>()
  const queue: string[] = rootIds.filter(id => validIds.has(id))
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
    const children = childrenByParent.get(id)
    if (children) queue.push(...children)
  }
  return result
}
