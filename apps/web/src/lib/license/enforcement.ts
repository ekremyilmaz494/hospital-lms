import { isOnPrem } from '@/lib/deployment'
import { getLicenseState } from '@/lib/license/cache'
import type { LicenseStateName } from '@/lib/license/state'

/**
 * Lisans ZORLAMA yardımcıları — API kapısı, sayfa guard'ı, cron guard'ı.
 * Hepsi bulut modunda no-op (getLicenseState kısa devre VALID döner).
 *
 * Katman ayrımı:
 * - LOCKED / NO_LICENSE → HERKESE 403 (super_admin DAHİL) — bunu abonelik
 *   katmanı ifade edemez, bu yüzden ayrı kapı (`licenseApiGate`).
 * - READONLY → yazma bloğu, mevcut write-guard yolunda (`checkWritePermission`
 *   on-prem dalı) ele alınır; aktif sınav ilerleme yazmaları muaftır.
 */

/**
 * Middleware sayfa yönlendirmesi için sentinel çerez adı (hlms-must-change-pw
 * deseni). Login sonrası set edilir; middleware kilitliyken /license'a yönlendirir.
 * Advisory'dir — asıl zorlama API kapısı + sayfa guard'ıdır.
 */
export const LICENSE_STATE_COOKIE = 'hlms-license-state'

/** Kilitliyken bile erişilebilmesi gereken API yolları (aktivasyon/health/oturum). */
const ALWAYS_OPEN_API = [
  '/api/license/status',
  '/api/license/activate',
  '/api/health',
  '/api/auth/logout',
  '/api/public/',
  '/api/cron/', // kendi CRON_SECRET guard'ı var; heartbeat kilidi kendini iyileştirir
]

/**
 * READONLY durumunda yazmaya İZİN verilen yollar — süresi dolmadan başlamış
 * sınav denemesinin ilerlemesi kaybolmasın (personel mağdur olmaz) + oturum/şifre.
 */
// Grup sonu segment sınırına sabitlenir ((?:$|[/?])) → ileride eklenecek bir rota
// (ör. /api/exam/{id}/submit-review) `submit` prefix'iyle YANLIŞLIKLA muaf olmasın;
// alt-yollar (ör. /scorm/tracking/commit) `/` ile eşleşmeyi sürdürür.
const READONLY_WRITE_EXEMPT = [
  /^\/api\/exam\/[^/]+\/(save-answer|timer|videos\/progress|submit|state|sign|scorm\/tracking)(?:$|[/?])/,
  /^\/api\/auth\/(logout|change-password)(?:$|[/?])/,
]

export function isReadonlyWriteExempt(pathname: string): boolean {
  return READONLY_WRITE_EXEMPT.some((re) => re.test(pathname))
}

/** Kullanıcıya sızdırılmadan durum sınıflandırması (mesajlar Türkçe, iç detay yok). */
function lockMessage(state: LicenseStateName): string {
  if (state === 'NO_LICENSE') {
    return 'Sistem lisansı bulunamadı. Lütfen yöneticinizle iletişime geçin.'
  }
  return 'Sistem lisansı geçerli değil. Lütfen yöneticinizle iletişime geçin.'
}

export interface LicenseApiDecision {
  /** true → isteği reddet; kod/mesaj ile 403 dön. */
  blocked: boolean
  code?: 'license_locked' | 'license_no_license'
  message?: string
}

/**
 * API kapısı — LOCKED/NO_LICENSE'ta 403 kararı. withApiHandler auth'tan HEMEN
 * sonra çağırır (tüm sarılı route'ları tek noktadan kapsar). super_admin MUAF
 * DEĞİL. READONLY/WARN/VALID → geçir (yazma bloğu ayrı katmanda).
 */
export async function licenseApiGate(pathname: string): Promise<LicenseApiDecision> {
  if (!isOnPrem()) return { blocked: false }
  if (ALWAYS_OPEN_API.some((p) => pathname.startsWith(p))) return { blocked: false }

  const { state } = await getLicenseState()
  if (state === 'LOCKED' || state === 'NO_LICENSE') {
    return {
      blocked: true,
      code: state === 'NO_LICENSE' ? 'license_no_license' : 'license_locked',
      message: lockMessage(state),
    }
  }
  return { blocked: false }
}

/**
 * Sayfa guard'ı — layout server component'lerinde çağrılır; LOCKED/NO_LICENSE'ta
 * /license'a yönlendirilmesi gerektiğini bildirir (redirect'i çağıran yapar,
 * `redirect()` server-component bağlamı ister).
 */
export async function shouldRedirectToLicense(): Promise<boolean> {
  if (!isOnPrem()) return false
  const { state } = await getLicenseState()
  return state === 'LOCKED' || state === 'NO_LICENSE'
}

/**
 * İş cron'ları için guard — READONLY/LOCKED'ta iş cron'ları (hatırlatma, quiz
 * push, streak) atlanır; yalnız altyapı cron'ları (backup, cleanup, heartbeat)
 * her durumda çalışır. Cron route'unda erken `return` için kullanılır.
 */
export async function isBusinessCronAllowed(): Promise<boolean> {
  if (!isOnPrem()) return true
  const { state } = await getLicenseState()
  return state === 'VALID' || state === 'WARN'
}
