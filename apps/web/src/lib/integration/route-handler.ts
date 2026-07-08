/**
 * withIntegrationRoute — İK/HBYS makine (M2M) entegrasyon route'ları için HOF.
 *
 * `withApiHandler`'ın aynası; Supabase session YERİNE `Authorization: Bearer
 * klx_live_...` API anahtarı doğrular. Akış sırası:
 *
 *   1. IP rate limit (60/dk)            → 429
 *   2. Bearer + verifyApiKey            → 401 (jenerik — neden sızdırılmaz)
 *   3. Anahtar rate limit (varsayılan 120/dk) → 429
 *   4. Org aktif/suspend kontrolü       → 403
 *   5. Org IP allowlist                 → 403
 *   6. On-prem lisans kapısı            → 403
 *   7. Feature gate (staffIntegration)  → 403
 *   8. Subscription write-guard (write metodları) → 403
 *   9. Idempotency-Key (write metodları, opsiyonel) → replay/409
 *  10. handler(ctx) — ctx.audit makine aktörü izi (`_integration`) düşer
 *
 * Hata sözleşmesi `withApiHandler` ile aynı: `ApiError` → kendi yanıtı,
 * diğer hatalar → Sentry + jenerik Türkçe 500.
 */

import {
  errorResponse,
  createAuditLog,
  checkWritePermission,
  ApiError,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { maskIp } from '@/lib/pii-mask'
import { isIpAllowed } from '@/lib/auth/ip-allowlist'
import { checkFeature } from '@/lib/feature-gate'
import { licenseApiGate } from '@/lib/license/enforcement'
import { verifyApiKey } from './api-key'
import { idempotencyBegin, idempotencyComplete, idempotencyRelease } from './idempotency'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Jenerik kimlik hatası — eksik header, bozuk format ve geçersiz anahtar AYNI yanıtı alır. */
const GENERIC_AUTH_ERROR = 'Kimlik doğrulanamadı'

/** Idempotency-Key: 1-200 görünür ASCII karakter (hash'lendiği için içerik serbest). */
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{1,200}$/

/** İstek URL'inden pathname çıkarır (parse hatasında boş string). */
function pathOf(request: Request): string {
  try {
    return new URL(request.url).pathname
  } catch {
    return ''
  }
}

/** İstemci IP'sini çözer: x-forwarded-for ilk parça → x-real-ip → 'unknown'. */
function clientIpOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first
  const real = request.headers.get('x-real-ip')?.trim()
  return real || 'unknown'
}

export interface IntegrationContext<P = Record<string, string | string[] | undefined>> {
  request: Request
  params: P
  /** Anahtarın bağlı olduğu kurum — tüm sorgular buna scope'lanmalı (multi-tenant). */
  organizationId: string
  /** Doğrulanmış API anahtarı kimliği (log/audit izi için; düz anahtar YOK). */
  apiKey: { id: string; keyPrefix: string }
  /**
   * Convenience audit logger — `userId: null` (makine aktörü), organizationId ve
   * request otomatik doldurulur; `newData`'ya `_integration: { apiKeyId, keyPrefix }`
   * izi merge edilir.
   */
  audit: (p: {
    action: string
    entityType: string
    entityId?: string | null
    oldData?: unknown
    newData?: unknown
  }) => Promise<void>
}

export interface WithIntegrationRouteOptions {
  /** Anahtar-bazlı dakikalık istek limiti. Varsayılan: 120/dk. */
  rateLimitPerMinute?: number
  /**
   * Write metodlarında `Idempotency-Key` header desteği. Varsayılan: true.
   * false → header tamamen yok sayılır (her istek çalıştırılır).
   */
  idempotency?: boolean
}

/**
 * Next.js 16 validator uyumu — withApiHandler'daki iki-overload tekniğinin aynısı:
 * `Parameters<F>` SADECE son overload'a bakar → Next 16 `SecondArg` çıkarımı
 * `RouteContext<P>` görür; testler ise ilk overload ile 1-arg çağırabilir.
 */
type DefaultParams = Record<string, string | string[] | undefined>
type RouteContext<P extends DefaultParams = DefaultParams> = { params: Promise<P> }

export type IntegrationRouteHandler<P extends DefaultParams = DefaultParams> = {
  (request: Request): Promise<Response>
  (request: Request, routeCtx: RouteContext<P>): Promise<Response>
}

/**
 * Bir App Router route handler'ını M2M API-anahtarı auth katmanıyla sarar.
 *
 * @example
 * export const POST = withIntegrationRoute(
 *   async ({ request, organizationId, audit }) => {
 *     const body = await parseBody<SyncPayload>(request)
 *     if (!body) throw new ApiError('Geçersiz veri', 400)
 *     // ... organizationId scope'lu iş mantığı ...
 *     await audit({ action: 'integration.staff.sync', entityType: 'user' })
 *     return jsonResponse({ ok: true }, 201)
 *   },
 *   { rateLimitPerMinute: 60, idempotency: true },
 * )
 */
export function withIntegrationRoute<P extends DefaultParams = DefaultParams>(
  handler: (ctx: IntegrationContext<P>) => Promise<Response>,
  options: WithIntegrationRouteOptions = {},
): IntegrationRouteHandler<P> {
  const { rateLimitPerMinute = 120, idempotency = true } = options

  return (async (request: Request, routeCtx?: RouteContext<P>): Promise<Response> => {
    try {
      const params = routeCtx?.params ? await routeCtx.params : ({} as P)
      const pathname = pathOf(request)
      const method = request.method.toUpperCase()
      const isWrite = WRITE_METHODS.has(method)

      // ── 1) IP bazlı rate limit ── auth'tan ÖNCE: anahtar brute-force'u
      // daha DB'ye dokunmadan yavaşlat. SAFE_KEY_PATTERN uyumu için sanitize.
      const clientIp = clientIpOf(request)
      const safeIp = clientIp.replace(/[^a-zA-Z0-9:._-]/g, '_')
      const ipAllowed = await checkRateLimit(`integration:ip:${safeIp}`, 60, 60)
      if (!ipAllowed) {
        return errorResponse('Çok fazla istek. Lütfen daha sonra tekrar deneyin.', 429)
      }

      // ── 2) Bearer token → API anahtarı ── eksik/bozuk/geçersiz hepsi AYNI
      // jenerik 401 (neden sızdırma yok — license/activate deseni).
      const authHeader = (request.headers.get('authorization') ?? '').trim()
      if (!authHeader.toLowerCase().startsWith('bearer ')) {
        logger.warn('integration', 'Authorization header eksik veya bozuk', {
          ip: maskIp(clientIp),
          path: pathname,
        })
        return errorResponse(GENERIC_AUTH_ERROR, 401)
      }
      const token = authHeader.slice(7).trim()
      const verified = await verifyApiKey(token)
      if (!verified.ok) {
        logger.warn('integration', 'Geçersiz API anahtarı denemesi', {
          ip: maskIp(clientIp),
          path: pathname,
        })
        return errorResponse(GENERIC_AUTH_ERROR, 401)
      }
      const apiKey = verified.key
      const organizationId = apiKey.organizationId

      // ── 3) Anahtar bazlı rate limit ──
      const keyAllowed = await checkRateLimit(`integration:key:${apiKey.id}`, rateLimitPerMinute, 60)
      if (!keyAllowed) {
        return errorResponse('Çok fazla istek. Lütfen daha sonra tekrar deneyin.', 429)
      }

      // ── 4) Org aktif mi? ──
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          isActive: true,
          isSuspended: true,
          ipAllowlistEnabled: true,
          ipAllowlist: true,
        },
      })
      if (!org || !org.isActive || org.isSuspended) {
        return errorResponse('Kurum hesabı aktif değil', 403)
      }

      // ── 5) Org IP allowlist ── (mevcut CIDR helper'ı yeniden kullanılır)
      if (org.ipAllowlistEnabled && !isIpAllowed(clientIp === 'unknown' ? null : clientIp, org.ipAllowlist)) {
        logger.warn('integration', 'IP allowlist reddi', {
          ip: maskIp(clientIp),
          organizationId,
        })
        return errorResponse('Bu IP adresinden erişime izin verilmiyor', 403)
      }

      // ── 6) Feature gate ── staffIntegration plana bağlı.
      const featureEnabled = await checkFeature(organizationId, 'staffIntegration')
      if (!featureEnabled) {
        return errorResponse(
          'Personel entegrasyonu planınızda etkin değil. Lütfen Klinovax ile iletişime geçin.',
          403,
        )
      }

      // ── 7) On-prem lisans kapısı ── LOCKED/NO_LICENSE'ta tüm entegrasyon uçları
      // (okuma dahil) 403. Bu route-handler withApiHandler DIŞI olduğundan (API-key
      // auth) merkezi licenseApiGate'i kendisi çağırmalı; aksi halde lisanssız/kilitli
      // kurulumda HBYS senkron API'leri çalışmaya devam eder (kademeli-kilit deliği).
      // Bulutta isOnPrem=false → no-op (main davranışı bit-bit korunur).
      const licenseDecision = await licenseApiGate(pathOf(request))
      if (licenseDecision.blocked) {
        return errorResponse(licenseDecision.message ?? 'Lisans geçersiz.', 403)
      }

      // ── 8) Subscription write-guard ── yalnız write metodlarında.
      if (isWrite) {
        const block = await checkWritePermission(organizationId, method)
        if (block) return block
      }

      const ctx: IntegrationContext<P> = {
        request,
        params,
        organizationId,
        apiKey: { id: apiKey.id, keyPrefix: apiKey.keyPrefix },
        audit: async (p) => {
          // Makine aktörü izi: newData'ya _integration merge edilir. newData obje
          // değilse (primitive/array) `value` altına sarılır — iz kaybolmasın.
          const base: Record<string, unknown> =
            p.newData !== null && typeof p.newData === 'object' && !Array.isArray(p.newData)
              ? (p.newData as Record<string, unknown>)
              : p.newData === undefined
                ? {}
                : { value: p.newData }
          await createAuditLog({
            userId: null,
            organizationId,
            request,
            ...p,
            newData: {
              ...base,
              _integration: { apiKeyId: apiKey.id, keyPrefix: apiKey.keyPrefix },
            },
          })
        },
      }

      // ── 9) Idempotency ── yalnız write metodlarında ve header varsa.
      const idemHeader = request.headers.get('idempotency-key')
      if (isWrite && idempotency && idemHeader !== null) {
        if (!IDEMPOTENCY_KEY_PATTERN.test(idemHeader)) {
          return errorResponse('Geçersiz Idempotency-Key başlığı (1-200 görünür ASCII karakter olmalı)', 400)
        }

        // scope = pathname → aynı Idempotency-Key farklı uçta (örn. /staff vs /sync)
        // yanlış yanıtı replay etmesin (uç-bazlı izolasyon).
        const begin = await idempotencyBegin(organizationId, idemHeader, pathname)
        if (begin.state === 'replay') {
          return new Response(begin.body, {
            status: begin.status,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Replayed': 'true',
            },
          })
        }
        if (begin.state === 'pending') {
          return errorResponse('Aynı işlem hâlen sürüyor. Lütfen bekleyip tekrar deneyin.', 409)
        }

        // acquired → handler'ı çalıştır. 2xx ise yanıtı sakla (clone — body
        // tüketilmez); değilse kilidi bırak ki istemci tekrar deneyebilsin.
        let res: Response
        try {
          res = await handler(ctx)
        } catch (err) {
          await idempotencyRelease(organizationId, idemHeader, pathname)
          throw err
        }
        if (res.status >= 200 && res.status < 300) {
          const bodyText = await res.clone().text()
          await idempotencyComplete(organizationId, idemHeader, pathname, res.status, bodyText)
        } else {
          await idempotencyRelease(organizationId, idemHeader, pathname)
        }
        return res
      }

      return await handler(ctx)
    } catch (err) {
      if (err instanceof ApiError) return err.toResponse()

      // Yapılandırılmamış hatalar — Sentry'ye yolla, kullanıcıya jenerik 500.
      try {
        const Sentry = await import('@sentry/nextjs')
        Sentry.captureException(err)
      } catch {
        /* Sentry not configured */
      }

      logger.error('withIntegrationRoute', 'Unhandled error', {
        method: request.method,
        url: request.url,
        error: err instanceof Error ? err.message : String(err),
      })

      return errorResponse('İşlem sırasında beklenmeyen bir hata oluştu', 500)
    }
  }) as IntegrationRouteHandler<P>
}
