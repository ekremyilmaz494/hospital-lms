import { invalidateCache, invalidateOrgCache } from '@/lib/redis'

/** Dashboard cache key prefixes — combined endpoint per-section keys */
const DASHBOARD_CACHE_KEYS = [
  'dashboard:stats',
  'dashboard:charts',
  'dashboard:compliance',
  'dashboard:activity',
  'dashboard:certs',
] as const

/**
 * Invalidate all dashboard cache keys for a given organization.
 * Call this after any data mutation that affects dashboard (trainings, staff, exams).
 *
 * Competency-matrix endpoint (`/api/admin/competency-matrix`) `cache:{orgId}:competency:*`
 * prefix'i kullanıyor — dashboard'ın matrix mini widget'ı da bayat kalmasın diye
 * birlikte temizleniyor (P0 §2.5).
 */
export async function invalidateDashboardCache(orgId: string): Promise<void> {
  await Promise.all([
    ...DASHBOARD_CACHE_KEYS.map(prefix => invalidateCache(`${prefix}:${orgId}`)),
    invalidateOrgCache(orgId, 'competency'),
  ])
}
