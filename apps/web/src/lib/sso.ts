import crypto from 'crypto'
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml'
import * as jose from 'jose'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { getAppUrl } from '@/lib/api-helpers'

// ── SSO State (Nonce) Management ──

const SSO_STATE_PREFIX = 'sso:state:'
const SSO_STATE_TTL = 600 // 10 dakika

/** In-memory fallback for dev/staging (no Redis) */
const memoryStates = new Map<string, { data: string; expiresAt: number }>()

export interface SsoStatePayload {
  orgId: string
  email: string
  nonce: string
}

/**
 * SSO state parametresi oluşturur ve Redis/memory'de saklar.
 * CSRF koruması icin nonce tabanli dogrulama yapar.
 */
export async function createSsoState(orgId: string, email: string): Promise<string> {
  const nonce = crypto.randomBytes(32).toString('hex')
  const payload: SsoStatePayload = { orgId, email, nonce }
  const stateJson = JSON.stringify(payload)

  const redis = getRedis()
  if (redis) {
    await redis.set(`${SSO_STATE_PREFIX}${nonce}`, stateJson, { ex: SSO_STATE_TTL })
  } else {
    memoryStates.set(nonce, { data: stateJson, expiresAt: Date.now() + SSO_STATE_TTL * 1000 })
  }

  // State parametresi olarak nonce'u gonder (plain JSON degil)
  return nonce
}

/**
 * SSO state parametresini dogrular ve tek kullanimlik olarak siler.
 * Gecersiz veya suresi dolmus state icin null doner.
 */
export async function verifySsoState(nonce: string): Promise<SsoStatePayload | null> {
  if (!nonce || typeof nonce !== 'string' || nonce.length !== 64) {
    return null
  }

  const redis = getRedis()
  if (redis) {
    const raw = await redis.get<string>(`${SSO_STATE_PREFIX}${nonce}`)
    if (!raw) return null
    // Tek kullanimlik — hemen sil
    await redis.del(`${SSO_STATE_PREFIX}${nonce}`)
    try {
      return JSON.parse(raw) as SsoStatePayload
    } catch {
      return null
    }
  }

  // In-memory fallback
  const entry = memoryStates.get(nonce)
  if (!entry || entry.expiresAt < Date.now()) {
    memoryStates.delete(nonce)
    return null
  }
  memoryStates.delete(nonce) // tek kullanimlik
  try {
    return JSON.parse(entry.data) as SsoStatePayload
  } catch {
    return null
  }
}

// ── SAML Response Validation (node-saml) ──
//
// GÜVENLİK: Önceki implementasyon imzayı regex ile bulup checkSignature ile doğruluyor,
// ardından kimliği TÜM belgeden regex ile çıkarıyordu. İmza okunan düğüme bağlanmadığı için
// bu klasik XML Signature Wrapping (XSW) saldırısına açıktı (saldırgan imzalı bir assertion +
// imzasız sahte NameID enjekte edip herhangi biri olarak giriş yapabiliyordu). Artık vetlenmiş
// @node-saml/node-saml kullanılıyor: kimlik YALNIZCA imzalı assertion'dan okunur ve
// Conditions/NotBefore/NotOnOrAfter + AudienceRestriction otomatik doğrulanır.
//
// Replay/CSRF: Akış IdP-initiated (initiate AuthnRequest üretmez) olduğundan InResponseTo
// doğrulanmaz; bunun yerine RelayState nonce'u (createSsoState/verifySsoState) tek kullanımlık
// olarak tüketilir ve assertion'ın kısa NotOnOrAfter penceresi replay'i sınırlar.

export interface SamlIdentity {
  email: string
  firstName: string | null
  lastName: string | null
}

/** node-saml Profile'ından bilinen claim adlarından ilk dolu string değeri seçer. */
function pickAttr(profile: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    const v = profile[name]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim()
  }
  return null
}

/**
 * SAML POST yanıtını (base64 SAMLResponse) kriptografik olarak doğrular ve kimliği
 * YALNIZCA imzalı assertion'dan döndürür. Geçersiz imza / wrapping / süresi geçmiş /
 * yanlış audience durumunda null döner.
 */
export async function validateSamlResponse(
  samlResponseB64: string,
  org: { samlCert: string; samlIssuer: string | null },
): Promise<SamlIdentity | null> {
  try {
    const callbackUrl = `${getAppUrl()}/api/auth/sso/callback`
    // issuer = SP entityID (org.samlIssuer); audience = beklenen AudienceRestriction.
    // samlIssuer yoksa audience kontrolünü kapat (false) ama issuer için callbackUrl'e düş.
    const spIssuer = org.samlIssuer || callbackUrl
    const saml = new SAML({
      idpCert: org.samlCert,
      issuer: spIssuer,
      callbackUrl,
      audience: org.samlIssuer ? org.samlIssuer : false,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      validateInResponseTo: ValidateInResponseTo.never,
      acceptedClockSkewMs: 30_000,
    })

    const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponseB64 })
    if (!profile || !profile.nameID) {
      logger.warn('SSO:SAML', 'SAML profile/nameID bulunamadı')
      return null
    }

    const p = profile as unknown as Record<string, unknown>
    const email =
      (typeof profile.email === 'string' && profile.email) ||
      (typeof profile.mail === 'string' && profile.mail) ||
      pickAttr(p, [
        'urn:oid:0.9.2342.19200300.100.1.3',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      ]) ||
      profile.nameID
    const firstName = pickAttr(p, [
      'FirstName', 'givenName', 'first_name',
      'urn:oid:2.5.4.42',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    ])
    const lastName = pickAttr(p, [
      'LastName', 'surname', 'sn', 'last_name',
      'urn:oid:2.5.4.4',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    ])

    return { email, firstName, lastName }
  } catch (err) {
    logger.warn('SSO:SAML', 'SAML doğrulama başarısız — olası sahte/wrapping response', err instanceof Error ? err.message : err)
    return null
  }
}

// ── OIDC JWT Verification ──

/**
 * OIDC ID Token'ini kriptografik olarak dogrular.
 * JWKS endpoint'inden public key'leri alir ve JWT imzasini kontrol eder.
 */
export async function verifyOidcToken(
  idToken: string,
  discoveryUrl: string,
  clientId: string,
): Promise<{
  valid: boolean
  payload: Record<string, unknown> | null
  error?: string
}> {
  try {
    // Discovery endpoint'inden JWKS URI'yi al
    const discoveryRes = await fetch(discoveryUrl)
    if (!discoveryRes.ok) {
      return { valid: false, payload: null, error: 'Discovery endpoint ulasilamadi' }
    }
    const discovery = await discoveryRes.json()
    const jwksUri = discovery.jwks_uri
    const issuer = discovery.issuer

    if (!jwksUri) {
      return { valid: false, payload: null, error: 'JWKS URI bulunamadi' }
    }

    // JWKS'yi al (cache'li)
    const JWKS = jose.createRemoteJWKSet(new URL(jwksUri))

    // Token'i dogrula
    const { payload } = await jose.jwtVerify(idToken, JWKS, {
      issuer,
      audience: clientId,
      clockTolerance: 30, // 30 saniye saat farki toleransi
    })

    return {
      valid: true,
      payload: payload as Record<string, unknown>,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token dogrulama hatasi'
    logger.error('SSO:OIDC', 'ID token dogrulama basarisiz', message)
    return { valid: false, payload: null, error: message }
  }
}
