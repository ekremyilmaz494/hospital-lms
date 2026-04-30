/**
 * withApiHandler — auth + role + write-guard + error handling tek noktada.
 *
 * Amaç: Her route'ta tekrar eden auth/role/writeGuard/try-catch kalıbını
 * tek HOF altında toplamak. Geliştirici unutsa bile mutation route'larında
 * subscription write guard otomatik çalışır.
 *
 * Tasarım kararları:
 * - Audit otomatik DEĞİL — payload'ı iş mantığına bağlı; ctx.audit() helper'ı ile çağırılır.
 * - writeGuard varsayılan: write metodlarında AÇIK. Login/public route'larda `writeGuard: false`.
 * - `strict: true` → getAuthUserStrict kullanılır (cryptographic JWT, ~150ms maliyet).
 * - Handler `Response | NextResponse` döndürür; ApiError throw edilirse otomatik response'a çevrilir.
 *
 * Eski helper'lar (`getAuthUser`, `requireRole`, `checkWritePermission`) hâlâ public —
 * mevcut route'lar zorla migrate edilmedi. Yeni route'larda wrapper kullan.
 */

import {
  getAuthUser,
  getAuthUserStrict,
  requireRole,
  checkWritePermission,
  errorResponse,
  createAuditLog,
  ApiError,
} from '@/lib/api-helpers'
import type { UserRole } from '@/types/database'
import { logger } from '@/lib/logger'

type DbUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>['dbUser']>

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export interface HandlerContext<P = unknown, OrgId = string | null> {
  request: Request
  params: P
  user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>['user']>
  dbUser: DbUser
  /**
   * Organization ID. Tip değişir:
   * - varsayılan → `string | null` (super_admin null olabilir)
   * - `requireOrganization: true` → `string` (wrapper 400 dönerse buraya gelinmez)
   */
  organizationId: OrgId
  /** Convenience audit logger — dbUser/organizationId/request otomatik doldurulur. */
  audit: (params: {
    action: string
    entityType: string
    entityId?: string | null
    oldData?: unknown
    newData?: unknown
  }) => Promise<void>
}

export interface WithApiHandlerOptions {
  /** İzin verilen roller. Boş/undefined → sadece auth, rol kontrolü yok. */
  roles?: UserRole[]
  /** Cryptographic JWT validation (yavaş ama güvenli). Hassas mutation'lar için. */
  strict?: boolean
  /**
   * Write metodlarında subscription guard. Varsayılan: true.
   * Login/auth/public callback gibi route'larda false.
   */
  writeGuard?: boolean
  /**
   * Auth gereksiz route'lar için (örn. health-check).
   * Default false → her route auth ister.
   */
  public?: boolean
  /**
   * Tenant-scoped route'larda organizationId zorunlu. super_admin null orgId
   * ile gelirse 400 ile reddedilir. Set edildiğinde ctx.organizationId tipi
   * `string` olur (non-null garantili).
   *
   * Niçin önemli: super_admin için tüm role/write guard'lar geçilebilir, ama
   * tenant'a ait bir kayıt yaratıyor/güncelliyorsak "hangi org?" belirsiz olur.
   * Bu opsiyon impersonation/cross-tenant write hatalarını compile-time +
   * runtime düzeyinde engeller.
   */
  requireOrganization?: boolean
}

type RouteContext<P> = { params: Promise<P> } | undefined

/**
 * Wrap a Next.js App Router route handler with centralized auth/role/writeGuard.
 *
 * @example
 * export const POST = withApiHandler(
 *   async ({ request, dbUser, organizationId, audit }) => {
 *     const body = await parseBody<MySchema>(request)
 *     const created = await prisma.foo.create({ data: { ...body, organizationId } })
 *     await audit({ action: 'create', entityType: 'foo', entityId: created.id, newData: created })
 *     return jsonResponse(created, 201)
 *   },
 *   { roles: ['admin'] },
 * )
 */
// Implementation imzasında union — overload'lar (string | string|null) iki yönden de assign'lansın.
type AnyHandler<P> =
  | ((ctx: HandlerContext<P, string>) => Promise<Response>)
  | ((ctx: HandlerContext<P, string | null>) => Promise<Response>)

// Type overloads — `requireOrganization: true` set'lendiğinde ctx.organizationId tipi `string`.
export function withApiHandler<P = Record<string, string>>(
  handler: (ctx: HandlerContext<P, string>) => Promise<Response>,
  options: WithApiHandlerOptions & { requireOrganization: true },
): (request: Request, routeCtx?: RouteContext<P>) => Promise<Response>
export function withApiHandler<P = Record<string, string>>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  options?: WithApiHandlerOptions,
): (request: Request, routeCtx?: RouteContext<P>) => Promise<Response>
export function withApiHandler<P = Record<string, string>>(
  handler: AnyHandler<P>,
  options: WithApiHandlerOptions = {},
) {
  const {
    roles,
    strict = false,
    writeGuard = true,
    public: isPublic = false,
    requireOrganization = false,
  } = options

  return async (request: Request, routeCtx?: RouteContext<P>): Promise<Response> => {
    try {
      const params = (routeCtx?.params ? await routeCtx.params : ({} as P))

      if (isPublic) {
        const ctx: HandlerContext<P, string | null> = {
          request,
          params,
          // Public route'larda user/dbUser yok — handler bunlara dokunmamalı.
          user: null as never,
          dbUser: null as never,
          organizationId: null,
          audit: async () => { /* no-op for public */ },
        }
        return await (handler as (ctx: HandlerContext<P, string | null>) => Promise<Response>)(ctx)
      }

      const auth = strict ? await getAuthUserStrict() : await getAuthUser()
      if (auth.error) return auth.error
      const { user, dbUser } = auth
      if (!user || !dbUser) return errorResponse('Unauthorized', 401)

      if (roles && roles.length > 0) {
        const roleErr = requireRole(dbUser.role, roles)
        if (roleErr) return roleErr
      }

      // requireOrganization — super_admin null orgId ile gelirse tenant-scoped
      // route'lara giremez. Cross-tenant write/impersonation hatalarını engeller.
      if (requireOrganization && !dbUser.organizationId) {
        return errorResponse('Bu işlem için bir kurum bağlamı gerekir', 400)
      }

      // Write guard — super_admin exempt, GET serbest
      if (writeGuard && WRITE_METHODS.has(request.method.toUpperCase()) && dbUser.role !== 'super_admin' && dbUser.organizationId) {
        const block = await checkWritePermission(dbUser.organizationId, request.method)
        if (block) return block
      }

      const ctx: HandlerContext<P, string | null> = {
        request,
        params,
        user,
        dbUser,
        organizationId: dbUser.organizationId ?? null,
        audit: (p) => createAuditLog({
          userId: dbUser.id,
          organizationId: dbUser.organizationId,
          request,
          ...p,
        }),
      }

      return await (handler as (ctx: HandlerContext<P, string | null>) => Promise<Response>)(ctx)
    } catch (err) {
      if (err instanceof ApiError) return err.toResponse()

      // Yapılandırılmamış hatalar — Sentry'ye yolla, kullanıcıya generic 500
      try {
        const Sentry = await import('@sentry/nextjs')
        Sentry.captureException(err)
      } catch { /* Sentry not configured */ }

      logger.error('withApiHandler', 'Unhandled error', {
        method: request.method,
        url: request.url,
        error: err instanceof Error ? err.message : String(err),
      })

      return errorResponse('İşlem sırasında beklenmeyen bir hata oluştu', 500)
    }
  }
}

/** Convenience presets — 90% of routes fall into one of these buckets. */
type PresetExtra = Omit<WithApiHandlerOptions, 'roles'>

export function withAdminRoute<P = Record<string, string>>(
  handler: (ctx: HandlerContext<P, string>) => Promise<Response>,
  extra: PresetExtra & { requireOrganization: true },
): (request: Request, routeCtx?: RouteContext<P>) => Promise<Response>
export function withAdminRoute<P = Record<string, string>>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  extra?: PresetExtra,
): (request: Request, routeCtx?: RouteContext<P>) => Promise<Response>
export function withAdminRoute<P = Record<string, string>>(
  handler: AnyHandler<P>,
  extra: PresetExtra = {},
) {
  return withApiHandler<P>(handler as (ctx: HandlerContext<P, string | null>) => Promise<Response>, { roles: ['admin', 'super_admin'], ...extra })
}

export function withStaffRoute<P = Record<string, string>>(
  handler: (ctx: HandlerContext<P, string>) => Promise<Response>,
  extra: PresetExtra & { requireOrganization: true },
): (request: Request, routeCtx?: RouteContext<P>) => Promise<Response>
export function withStaffRoute<P = Record<string, string>>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  extra?: PresetExtra,
): (request: Request, routeCtx?: RouteContext<P>) => Promise<Response>
export function withStaffRoute<P = Record<string, string>>(
  handler: AnyHandler<P>,
  extra: PresetExtra = {},
) {
  return withApiHandler<P>(handler as (ctx: HandlerContext<P, string | null>) => Promise<Response>, { roles: ['staff', 'admin', 'super_admin'], ...extra })
}

export const withSuperAdminRoute = <P = Record<string, string>>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  extra: PresetExtra = {},
) => withApiHandler<P>(handler, { roles: ['super_admin'], strict: true, ...extra })
