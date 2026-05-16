/**
 * Türkçe göreli zaman etiketi — bildirimler, dashboard aktivite feed'i ve
 * notification-bell için tek doğruluk kaynağı.
 *
 * İki stil:
 *  - 'suffixed' (varsayılan): "Az önce" / "5 dk önce" / "2 saat önce" / "3 gün önce"
 *  - 'compact': "az önce" / "5 dk" / "2 saat" / "3 gün" (tablo hücresi için)
 *
 * Her iki stilde de 7+ gün için tarih döner (ör. "15 Nis"), aksi halde
 * listeler "412 gün önce" gibi anlamsız etiketler üretirdi.
 */

export type RelativeTimeStyle = 'suffixed' | 'compact'

const MINUTE_MS = 60_000
const HOUR_MIN = 60
const DAY_HOUR = 24
const WEEK_DAY = 7

export function formatRelativeTime(
  date: Date | string,
  style: RelativeTimeStyle = 'suffixed',
): string {
  const d = date instanceof Date ? date : new Date(date)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / MINUTE_MS)

  if (style === 'compact') {
    if (minutes < 1) return 'az önce'
    if (minutes < HOUR_MIN) return `${minutes} dk`
    const hours = Math.floor(minutes / HOUR_MIN)
    if (hours < DAY_HOUR) return `${hours} saat`
    const days = Math.floor(hours / DAY_HOUR)
    if (days < WEEK_DAY) return `${days} gün`
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  }

  if (minutes < 1) return 'Az önce'
  if (minutes < HOUR_MIN) return `${minutes} dk önce`
  const hours = Math.floor(minutes / HOUR_MIN)
  if (hours < DAY_HOUR) return `${hours} saat önce`
  const days = Math.floor(hours / DAY_HOUR)
  if (days < WEEK_DAY) return `${days} gün önce`
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}
