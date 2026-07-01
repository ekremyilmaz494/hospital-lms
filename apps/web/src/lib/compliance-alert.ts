/**
 * Uyum alarmı durumu — son teslim tarihine kalan güne göre.
 * `overdue` = süresi geçmiş (frontend "Süre Doldu!" render eder).
 *
 * NOT: Bu helper bilinçli olarak route dosyasından AYRI bir modülde tutulur.
 * Next.js route dosyaları (route.ts) yalnızca HTTP handler'ları ve tanınan config
 * alanlarını export edebilir; route'tan yardımcı fonksiyon export etmek
 * `next build` route-tip doğrulamasını kırar ("... is not a valid Route export field").
 */
export function complianceAlertStatus(daysLeft: number): 'overdue' | 'critical' | 'warning' | 'ok' {
  if (daysLeft <= 0) return 'overdue'
  if (daysLeft <= 7) return 'critical'
  if (daysLeft <= 30) return 'warning'
  return 'ok'
}
