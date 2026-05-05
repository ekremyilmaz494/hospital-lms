import type { PeriodStatus } from '@/types/database'

/**
 * Period status için Türkçe etiket. Client-safe (prisma bağımlılığı yok)
 * — UI komponentlerinde direkt kullanılabilir.
 */
export function periodStatusLabel(status: PeriodStatus | string): string {
  switch (status) {
    case 'active':
      return 'Aktif'
    case 'upcoming':
      return 'Yaklaşan'
    case 'closed':
      return 'Kapalı'
    default:
      return status
  }
}
