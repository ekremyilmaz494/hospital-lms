/**
 * Çerez/analitik onayı: TEK kaynak. Banner yazar, analitik ve "Çerez tercihleri"
 * düğmesi okur/dinler. localStorage erişimi gizli pencerede veya engelli site
 * verisinde fırlatabilir; her erişim try/catch içindedir ve varsayılan "yalnız zorunlu"dur.
 */

export interface CookiePreferences {
  essential: true
  functional: boolean
  analytics: boolean
}

export const COOKIE_CONSENT_KEY = 'lms_cookie_consent'
export const COOKIE_PREFS_KEY = 'lms_cookie_prefs'

/** Tercih kaydedildiğinde `window` üstünde yayınlanır (detail: CookiePreferences). */
export const CONSENT_CHANGE_EVENT = 'klinovax:consent-change'
/** Banner'ı ayarlar açık hâlde yeniden göstermek için yayınlanır. */
export const CONSENT_OPEN_EVENT = 'klinovax:consent-open'

export const ESSENTIAL_ONLY: CookiePreferences = { essential: true, functional: false, analytics: false }

/** Kullanıcı daha önce bir seçim yaptı mı? */
export function hasStoredConsent(): boolean {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

/** Kayıtlı tercihleri okur; bozuk/eksik kayıtta yalnız zorunlu çerezler. */
export function readConsentPrefs(): CookiePreferences {
  try {
    if (!hasStoredConsent()) return ESSENTIAL_ONLY
    const raw = window.localStorage.getItem(COOKIE_PREFS_KEY)
    if (!raw) return ESSENTIAL_ONLY
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return ESSENTIAL_ONLY
    const p = parsed as Record<string, unknown>
    return { essential: true, functional: p.functional === true, analytics: p.analytics === true }
  } catch {
    return ESSENTIAL_ONLY
  }
}

/** Tercihi kaydeder ve dinleyenlere (analitik) bildirir. */
export function saveConsentPrefs(prefs: CookiePreferences): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    window.localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Depolama kapalı: tercih bu sayfa ömrü boyunca olay ile yine uygulanır.
  }
  window.dispatchEvent(new CustomEvent<CookiePreferences>(CONSENT_CHANGE_EVENT, { detail: prefs }))
}

/** Çerez banner'ını ayarlar paneli açık olarak yeniden açar. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}
