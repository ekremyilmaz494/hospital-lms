/**
 * Deadline / kalan gün / uyarı seviyesi türetimi için tek doğruluk kaynağı.
 *
 * Varsayılan eşikler eğitim/compliance için kullanılır (7/30).
 * Abonelik gibi farklı eşik isteyen yerler `thresholds` parametresiyle özelleştirir
 * (ör. super-admin dashboard → critical:7, warning:14).
 */

export const URGENT_DEADLINE_DAYS = 7
export const WARNING_DEADLINE_DAYS = 30
export const MS_PER_DAY = 86_400_000

export type DeadlineStatus = 'ok' | 'warning' | 'critical' | 'overdue'

export interface DeadlineThresholds {
  critical?: number
  warning?: number
}

export interface DeadlineInfo {
  status: DeadlineStatus
  daysLeft: number | null
}

export function daysUntil(date: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  return Math.ceil((d.getTime() - now.getTime()) / MS_PER_DAY)
}

export function getDeadlineStatus(
  date: Date | string | null | undefined,
  thresholds: DeadlineThresholds = {},
  now: Date = new Date(),
): DeadlineInfo {
  const days = daysUntil(date, now)
  if (days === null) return { status: 'ok', daysLeft: null }

  const critical = thresholds.critical ?? URGENT_DEADLINE_DAYS
  const warning = thresholds.warning ?? WARNING_DEADLINE_DAYS

  if (days < 0) return { status: 'overdue', daysLeft: days }
  if (days <= critical) return { status: 'critical', daysLeft: days }
  if (days <= warning) return { status: 'warning', daysLeft: days }
  return { status: 'ok', daysLeft: days }
}
