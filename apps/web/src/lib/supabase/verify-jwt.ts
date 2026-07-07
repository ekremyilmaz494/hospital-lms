import * as jose from 'jose'
import { logger } from '@/lib/logger'
import { isOnPrem } from '@/lib/deployment'

/**
 * Supabase access_token (JWT) kriptografik doğrulaması.
 *
 * NEDEN: `supabase.auth.getSession()` token'ı YALNIZCA istemcinin çerezinden okuyup
 * decode eder — imzayı DOĞRULAMAZ. API route'ları Prisma ile RLS'i bypass ettiği için
 * yetkilendirme tamamen uygulamaya bağlıdır; bu yüzden `session.user.id`/role'e güvenmeden
 * ÖNCE access_token'ın imzasını burada doğrularız. Aksi halde saldırgan keyfi `sub`/role
 * içeren sahte bir çerez üretip herhangi bir kullanıcıyı (admin dahil) taklit edebilir.
 *
 * Bu proje asimetrik ES256 imzalama kullanır (JWKS endpoint'i ile doğrulanır). HS256
 * fallback'i (SUPABASE_JWT_SECRET) yalnızca legacy/simetrik projeler için dayanıklılık amaçlı
 * tutulur. Hiçbir durumda fail-open yok: doğrulanamayan token reddedilir (null döner).
 */

let jwksCache: ReturnType<typeof jose.createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwksCache) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL gerekli (JWT JWKS doğrulaması)')
    // createRemoteJWKSet anahtarları cache'ler ve eşzamanlı istekleri birleştirir.
    jwksCache = jose.createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`))
  }
  return jwksCache
}

let hsKeyCache: Uint8Array | null = null
function getHsKey(): Uint8Array | null {
  if (hsKeyCache) return hsKeyCache
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return null
  hsKeyCache = new TextEncoder().encode(secret)
  return hsKeyCache
}

function expectedIssuer(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url ? `${url}/auth/v1` : undefined
}

export interface VerifiedToken {
  /** Doğrulanmış kullanıcı id'si (JWT sub). */
  sub: string
  /** app_metadata.role (kanonik değil — API'de DB dbUser.role kullanılır, ama middleware buna güvenir). */
  role: string | null
  payload: jose.JWTPayload
}

function extractRole(payload: jose.JWTPayload): string | null {
  const appMeta = payload.app_metadata as Record<string, unknown> | undefined
  const userMeta = payload.user_metadata as Record<string, unknown> | undefined
  const r = appMeta?.role ?? userMeta?.role
  return typeof r === 'string' ? r : null
}

/**
 * Access token'ı doğrular. Geçerliyse {sub, role, payload}, aksi halde null döner.
 * `exp` jose tarafından otomatik kontrol edilir; issuer ve audience ('authenticated') de doğrulanır.
 */
export async function verifyAccessToken(token: string): Promise<VerifiedToken | null> {
  if (!token || typeof token !== 'string') return null
  try {
    const header = jose.decodeProtectedHeader(token)
    const alg = header.alg
    // On-prem self-hosted GoTrue (HS256) token'a `iss` claim'i KOYMAZ; issuer opsiyonu
    // tanımlıyken jose iss'siz token'ı koşulsuz reddeder → her istek 401. Güvenlik korunur:
    // HS256 imzası SUPABASE_JWT_SECRET ile, aud='authenticated' ve algorithms allowlist ile
    // doğrulanır (iss kriptografik değil, yalnız claim-eşleşme). Bulutta (isOnPrem=false)
    // issuer kontrolü aynen korunur — verifyOpts bulut yolunda bit-bit aynı.
    const verifyOpts: jose.JWTVerifyOptions = {
      audience: 'authenticated',
      ...(isOnPrem() ? {} : { issuer: expectedIssuer() }),
    }

    let payload: jose.JWTPayload
    if (alg === 'HS256' || alg === 'HS384' || alg === 'HS512') {
      const key = getHsKey()
      if (!key) {
        // HS imzalı token ama secret yapılandırılmamış → doğrulayamayız, fail-closed.
        logger.error('verify-jwt', 'HS256 token geldi ama SUPABASE_JWT_SECRET tanımlı değil — reddedildi')
        return null
      }
      ;({ payload } = await jose.jwtVerify(token, key, { ...verifyOpts, algorithms: [alg] }))
    } else {
      // Asimetrik (ES256/RS256/EdDSA) → JWKS. algorithms allowlist algorithm-confusion'ı engeller.
      ;({ payload } = await jose.jwtVerify(token, getJwks(), {
        ...verifyOpts,
        algorithms: ['ES256', 'RS256', 'EdDSA'],
      }))
    }

    if (!payload.sub) return null
    return { sub: payload.sub, role: extractRole(payload), payload }
  } catch {
    // İmza/exp/issuer/audience uyumsuzluğu — sessizce reddet (fail-closed).
    return null
  }
}
