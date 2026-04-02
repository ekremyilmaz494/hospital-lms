import { invalidateCache } from '@/lib/redis'

/** Dashboard cache key prefixes — split endpoints use separate cache keys */
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
 */
export async function invalidateDashboardCache(orgId: string): Promise<void> {
  await Promise.all(
    DASHBOARD_CACHE_KEYS.map(prefix => invalidateCache(`${prefix}:${orgId}`))
  )
}
