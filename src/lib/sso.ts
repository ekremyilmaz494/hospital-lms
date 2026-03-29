import crypto from 'crypto'
import { SignedXml } from 'xml-crypto'
import * as jose from 'jose'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

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

// ── SAML Signature Verification ──

/**
 * SAML Response XML'indeki imzayi dogrular.
 * IdP'nin X.509 sertifikasi ile XML-DSIG imzasi kontrol edilir.
 */
export function verifySamlSignature(samlXml: string, idpCert: string): boolean {
  try {
    // Sertifikayi PEM formatina cevir (gerekiyorsa)
    const pemCert = idpCert.includes('BEGIN CERTIFICATE')
      ? idpCert
      : `-----BEGIN CERTIFICATE-----\n${idpCert}\n-----END CERTIFICATE-----`

    // XML icerisindeki Signature elementini bul
    const signatureMatch = samlXml.match(/<(?:ds:)?Signature[^>]*xmlns[^>]*>[\s\S]*?<\/(?:ds:)?Signature>/i)
    if (!signatureMatch) {
      logger.warn('SSO:SAML', 'SAML response icinde imza bulunamadi')
      return false
    }

    const sig = new SignedXml()
    sig.publicCert = pemCert
    sig.loadSignature(signatureMatch[0])
    const isValid = sig.checkSignature(samlXml)

    if (!isValid) {
      logger.warn('SSO:SAML', 'SAML imza dogrulanamadi')
    }

    return isValid
  } catch (err) {
    logger.error('SSO:SAML', 'SAML imza dogrulama hatasi', err)
    return false
  }
}

/**
 * SAML XML'den temel kimlik bilgilerini extract eder.
 * Imza dogrulamasi SONRASI cagrilmalidir.
 */
export function extractSamlIdentity(samlXml: string): {
  email: string | null
  firstName: string | null
  lastName: string | null
} {
  return {
    email: extractFromXml(samlXml, 'NameID'),
    firstName: extractFromXml(samlXml, 'FirstName') || extractFromXml(samlXml, 'givenName'),
    lastName: extractFromXml(samlXml, 'LastName') || extractFromXml(samlXml, 'surname'),
  }
}

/** XML'den attribute veya tag degeri extract eder */
function extractFromXml(xml: string, tag: string): string | null {
  // Attribute-based: <Attribute Name="FirstName"><AttributeValue>John</AttributeValue></Attribute>
  const attrRegex = new RegExp(
    `Name=["'](?:[^"']*:)?${tag}["'][^>]*>\\s*<[^>]*AttributeValue[^>]*>([^<]+)`,
    'i'
  )
  const attrMatch = xml.match(attrRegex)
  if (attrMatch) return attrMatch[1].trim()

  // Direct tag: <NameID>john@example.com</NameID>
  const tagRegex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]+)`, 'i')
  const tagMatch = xml.match(tagRegex)
  if (tagMatch) return tagMatch[1].trim()

  return null
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
