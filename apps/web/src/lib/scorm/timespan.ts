/**
 * SCORM zaman-aralığı (timespan) yardımcıları.
 *
 * İki farklı format vardır ve LMS her ikisini de doğru toplamalıdır:
 *  - **SCORM 1.2** `cmi.core.session_time` / `cmi.core.total_time` → CMITimespan
 *    `HHHH:MM:SS.SS` (saat 2-4 hane, dakika/saniye 00-59, saniye ondalıklı olabilir).
 *  - **SCORM 2004** `cmi.session_time` / `cmi.total_time` → ISO-8601 süre
 *    `P[nY][nM][nD]T[nH][nM][nS]` (pratikte `PT#H#M#S`, ondalık saniye olabilir).
 *
 * LMS davranışı (her iki sürüm): yeni_total = eski_total + session. SCO'ya
 * yeniden girişte cmi total_time birikmiş toplamı, session_time ise 0 döner.
 */

export type ScormVersion = '1.2' | '2004'

/** Ondalık saniye kaybını önlemek için 2 haneye yuvarla (SCORM 1.2 SS.SS). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Bir CMITimespan (`HHHH:MM:SS.SS`) veya ISO-8601 süre (`PT#H#M#S`) değerini
 * toplam saniyeye çevirir. Geçersiz/boş girdi → 0 (SCO'ları kırmamak için toleranslı).
 */
export function parseTimespanToSeconds(value: string | null | undefined): number {
  if (!value || typeof value !== 'string') return 0
  const trimmed = value.trim()
  if (trimmed === '') return 0

  // ISO-8601 süre (SCORM 2004): P ile başlar.
  if (/^[+-]?P/i.test(trimmed)) {
    return parseIso8601DurationToSeconds(trimmed)
  }

  // CMITimespan (SCORM 1.2): HHHH:MM:SS.SS
  const m = /^(\d{1,4}):([0-5]?\d):([0-5]?\d(?:\.\d{1,2})?)$/.exec(trimmed)
  if (!m) return 0
  const hours = parseInt(m[1], 10)
  const minutes = parseInt(m[2], 10)
  const seconds = parseFloat(m[3])
  return round2(hours * 3600 + minutes * 60 + seconds)
}

/** ISO-8601 süre string'ini saniyeye çevirir (Y≈365g, M≈30g yaklaşık — session'da nadir). */
function parseIso8601DurationToSeconds(value: string): number {
  // PnYnMnDTnHnMnS — tarih ve zaman kısımlarını ayır.
  const re =
    /^([+-])?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  const m = re.exec(value.trim())
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const years = parseFloat(m[2] ?? '0')
  const months = parseFloat(m[3] ?? '0')
  const weeks = parseFloat(m[4] ?? '0')
  const days = parseFloat(m[5] ?? '0')
  const hours = parseFloat(m[6] ?? '0')
  const minutes = parseFloat(m[7] ?? '0')
  const seconds = parseFloat(m[8] ?? '0')
  const total =
    years * 365 * 86400 +
    months * 30 * 86400 +
    weeks * 7 * 86400 +
    days * 86400 +
    hours * 3600 +
    minutes * 60 +
    seconds
  return round2(sign * total)
}

/** Saniyeyi SCORM 1.2 CMITimespan (`HHHH:MM:SS.SS`) formatına çevirir. */
export function formatSecondsToCmiTimespan(totalSeconds: number): string {
  const safe = Math.max(0, round2(totalSeconds))
  let hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = round2(safe % 60)
  // SCORM 1.2 saat alanı en fazla 4 hane (9999). Taşarsa sabitle.
  if (hours > 9999) hours = 9999
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = seconds.toFixed(2).padStart(5, '0')
  return `${hh}:${mm}:${ss}`
}

/** Saniyeyi SCORM 2004 ISO-8601 süre (`PT#H#M#S`) formatına çevirir. */
export function formatSecondsToIso8601(totalSeconds: number): string {
  const safe = Math.max(0, round2(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = round2(safe % 60)
  let out = 'PT'
  if (hours > 0) out += `${hours}H`
  if (minutes > 0) out += `${minutes}M`
  // Saniye her zaman yaz (hepsi 0 ise en az PT0S geçerli süre olsun).
  if (seconds > 0 || (hours === 0 && minutes === 0)) {
    out += `${Number.isInteger(seconds) ? seconds : seconds.toFixed(2)}S`
  }
  return out
}

/**
 * Birikmiş toplam + yeni oturum süresini toplayıp sürüme uygun formatta döner.
 * LMS-tarafı doğru birikim: her commit/finish'te SCO'nun raporladığı session_time
 * saklanan total_time'a eklenir.
 */
export function addSessionToTotal(
  totalTime: string | null | undefined,
  sessionTime: string | null | undefined,
  version: ScormVersion,
): string {
  const sum = parseTimespanToSeconds(totalTime) + parseTimespanToSeconds(sessionTime)
  return version === '2004' ? formatSecondsToIso8601(sum) : formatSecondsToCmiTimespan(sum)
}
