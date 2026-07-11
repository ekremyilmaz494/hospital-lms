/**
 * Süper-admin "Org panelini görüntüle" (acting-org) bağlamı.
 *
 * Süper-admin bir organizasyonun /admin panelini SALT-OKUNUR görüntülerken,
 * kimliğini DEĞİŞTİRMEDEN (magic-link/impersonation YOK, Supabase oturumu
 * `sb-<ref>-auth-token`'a ASLA dokunulmaz → self-logout yok) isteklerini
 * seçtiği org'a scope'lamak için imzalı, httpOnly bir cookie kullanılır.
 *
 * Güvenlik:
 * - Değer HMAC-SHA256 ile imzalanır → istemci sahteleyemez (secret sunucuda).
 * - `uid` cookie'yi set eden süper-admin'e bağlanır → kaçan cookie başka
 *   kullanıcıda geçersiz (verify uid eşleşmesi ister).
 * - Rol kararı ASLA bu cookie'den verilmez; çağıran kod önce `dbUser.role ===
 *   'super_admin'` (JWT-doğrulanmış) kontrol eder, sonra bu token'ı çözer.
 * - Secret yoksa fail-closed (verify null döner) → yetki yükseltmesi olmaz.
 */

import crypto from 'crypto'
import { cookies } from 'next/headers'

export const ACTING_ORG_COOKIE = 'klx-acting-org'
/**
 * Hassas OLMAYAN "drill-in aktif" işareti. Middleware imzalı httpOnly cookie'yi ucuz
 * doğrulayamaz; grup yöneticisini bare /admin'den /group'a yönlendirip yönlendirmeyeceğine
 * bu varlık-cookie'sine bakarak karar verir. Asıl yetki kararı api-handler'da (imzalı cookie
 * + grup sınırı) verilir — bu yalnızca yönlendirme sinyali.
 */
export const ACTING_PRESENT_COOKIE = 'klx-acting-present'
/** Görüntüleme bağlamı ömrü — destek oturumu için makul, kısa. */
export const ACTING_ORG_TTL_SECONDS = 30 * 60
/** HMAC domain-separation etiketi (başka HMAC kullanımlarıyla karışmasın). */
const LABEL = 'acting-org:v1'

/**
 * İmza secret'i. Ayrı env eklemeden, her ortamda garanti mevcut olan
 * SUPABASE_SERVICE_ROLE_KEY (yalnız sunucu, istemciye asla verilmez) kullanılır.
 */
function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY tanımsız — acting-org imzalama kullanılamıyor')
  return s
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

/**
 * Cookie değeri üret: `orgId.uid.exp.sig` (exp = saniye cinsinden epoch son kullanma).
 * @param nowMs Date.now() — test edilebilirlik için parametre.
 */
export function makeActingOrgToken(orgId: string, uid: string, nowMs: number): string {
  const exp = Math.floor(nowMs / 1000) + ACTING_ORG_TTL_SECONDS
  const body = `${orgId}.${uid}.${exp}`
  const sig = sign(`${LABEL}.${body}`)
  return `${body}.${sig}`
}

/**
 * Token'ı doğrula. Geçerliyse `orgId` döner, aksi halde `null`.
 * `uid` cookie'yi set eden süper-admin ile EŞLEŞMELİ.
 */
export function verifyActingOrgToken(
  token: string | null | undefined,
  uid: string,
  nowMs: number,
): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [orgId, tokUid, expStr, sig] = parts
  if (!orgId || !tokUid || tokUid !== uid) return null

  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp * 1000 <= nowMs) return null

  let expected: string
  try {
    expected = sign(`${LABEL}.${orgId}.${tokUid}.${expStr}`)
  } catch {
    return null // secret yok → fail-closed
  }

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return orgId
}

/** İstek Cookie header'ından acting-org cookie değerini çıkarır (yoksa null). */
export function readActingOrgCookie(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === ACTING_ORG_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return null
}

/** Görüntüleme bağlamını başlat (imzalı httpOnly cookie set eder). */
export async function setActingOrgCookie(orgId: string, uid: string): Promise<void> {
  const store = await cookies()
  store.set(ACTING_ORG_COOKIE, makeActingOrgToken(orgId, uid, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACTING_ORG_TTL_SECONDS,
  })
}

/** Görüntüleme bağlamını sonlandır (yalnız bu cookie'yi siler; auth oturumuna dokunmaz). */
export async function clearActingOrgCookie(): Promise<void> {
  const store = await cookies()
  store.set(ACTING_ORG_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/** Drill-in "aktif" varlık-işaretini set eder (middleware yönlendirme sinyali). */
export async function setActingPresentCookie(): Promise<void> {
  const store = await cookies()
  store.set(ACTING_PRESENT_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACTING_ORG_TTL_SECONDS,
  })
}

/** Drill-in "aktif" varlık-işaretini siler. */
export async function clearActingPresentCookie(): Promise<void> {
  const store = await cookies()
  store.set(ACTING_PRESENT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
