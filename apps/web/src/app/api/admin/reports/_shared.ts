import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { findActivePeriod, getPeriodById } from '@/lib/training-periods'
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
  /**
   * Dönem (TrainingPeriod) çözümü — TÜM rapor endpoint'leri burayı kullanır ki
   * dönem filtresi tutarlı uygulansın. `periodId` verilmemişse aktif döneme düşer;
   * geçersiz/yabancı periodId getPeriodById ile elenip null'a düşer (tüm dönemler).
   */
  resolvedPeriodId: string | null
  /** Çözülen dönem nesnesi (effectiveStartDate için startDate, export etiketi için label). */
  targetPeriod: { id: string; startDate: Date; label: string } | null
  /** assignment.where için: `{ periodId }` veya `{}`. */
  assignmentPeriodFilter: Record<string, unknown>
  /** examAttempt.where için: `{ assignment: { periodId } }` veya `{}`. */
  attemptPeriodFilter: Record<string, unknown>
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

  // Departman doğrulama + dönem çözümü paralel (birbirinden bağımsız sorgular).
  const [deptRow, targetPeriod] = await Promise.all([
    departmentId
      ? prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId }, select: { id: true } })
      : Promise.resolve(null),
    // periodId verilmişse org-guard'lı çek (yabancı/yok → null), yoksa aktif dönem.
    periodId ? getPeriodById(periodId, orgId).catch(() => null) : findActivePeriod(orgId),
  ])

  if (departmentId && !deptRow) {
    return { filters: null, error: errorResponse('Departman bulunamadı veya bu organizasyona ait değil', 403) }
  }
  const validatedDeptId = deptRow?.id

  // Subtree expansion: parent dept seçildiğinde child dept'lerdeki staff'ı da kapsa.
  // Staff listesi, dashboard, wizard ile aynı semantik — raporun mantığı kopmasın.
  // validIds tek-org guard: cross-tenant id'leri zaten siler (defense in depth).
  let userDeptFilter: Record<string, unknown> = {}
  if (validatedDeptId) {
    const rawDepartments = await prisma.department.findMany({
      where: { organizationId: orgId },
      select: { id: true, parentId: true },
    })
    const hierarchy = buildDepartmentHierarchy(rawDepartments)
    const subtree = expandDepartmentSubtree(hierarchy, [validatedDeptId])
    userDeptFilter = subtree.length > 1
      ? { departmentId: { in: subtree } }
      : { departmentId: validatedDeptId }
  }

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

  const resolvedPeriodId = targetPeriod?.id ?? null
  const assignmentPeriodFilter: Record<string, unknown> = resolvedPeriodId ? { periodId: resolvedPeriodId } : {}
  const attemptPeriodFilter: Record<string, unknown> = resolvedPeriodId ? { assignment: { periodId: resolvedPeriodId } } : {}

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
      resolvedPeriodId,
      targetPeriod: targetPeriod ? { id: targetPeriod.id, startDate: targetPeriod.startDate, label: targetPeriod.label } : null,
      assignmentPeriodFilter,
      attemptPeriodFilter,
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
