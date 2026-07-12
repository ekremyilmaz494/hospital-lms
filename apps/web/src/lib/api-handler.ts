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
import { licenseApiGate, isReadonlyWriteExempt } from '@/lib/license/enforcement'
import { readActingOrgCookie, verifyActingOrgToken } from '@/lib/auth/acting-org'
import { hasGroupAuthority } from '@/lib/auth/group-authority'
import { orgInOwnerGroup } from '@/lib/auth/group-drill-in'

/** İstek URL'inden pathname çıkarır (parse hatasında boş string). */
function pathOf(request: Request): string {
  try {
    return new URL(request.url).pathname
  } catch {
    return ''
  }
}

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
    /**
     * Ortak personel (çok-hastaneli grup, Faz 2.4): audit'i EFEKTİF org'a yaz (ör. doktorun
     * B hastanesindeki sınav aksiyonu B zincirine düşsün). Verilmezse ctx.organizationId (primary).
     */
    organizationId?: string
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

/**
 * Next.js 16 her route için `.next/types/.../route.ts` altında validator üretiyor:
 *   type RouteContext = { params: Promise<SegmentParams> }
 * Eski sürümlerde `routeCtx?` optional çalışıyordu; Next 16'da context her zaman
 * geçilir ve `| undefined` validator'a takılıyor. SegmentParams ≈
 * Record<string, string | string[] | undefined> olduğu için default P'yi de buna
 * uyumlu tuttuk; explicit generic'ler (örn. `<{ id: string }>`) etkilenmez.
 */
type DefaultParams = Record<string, string | string[] | undefined>
type RouteContext<P extends DefaultParams = DefaultParams> = { params: Promise<P> }

/**
 * Callable interface — iki overload:
 *   1) `(request)` — TEST'lerde 1-arg ile çağırma için (mock'lar route handler'ı doğrudan invoke eder).
 *   2) `(request, routeCtx)` — Next 16 validator'ının gördüğü "asıl" imza.
 *
 * TS'de overload'lı bir function type'da `Parameters<F>` SADECE en son overload'a
 * bakar; Next 16'nın `SecondArg<typeof POST>` çıkarımı bu yüzden `RouteContext<P>`
 * görür ve generated validator geçer. Tests ise ilk overload'a düşer ve 1-arg
 * çağrı tip-uyumlu olur.
 */
type RouteHandler<P extends DefaultParams> = {
  (request: Request): Promise<Response>
  (request: Request, routeCtx: RouteContext<P>): Promise<Response>
}

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
export function withApiHandler<P extends DefaultParams = DefaultParams>(
  handler: (ctx: HandlerContext<P, string>) => Promise<Response>,
  options: WithApiHandlerOptions & { requireOrganization: true },
): RouteHandler<P>
export function withApiHandler<P extends DefaultParams = DefaultParams>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  options?: WithApiHandlerOptions,
): RouteHandler<P>
export function withApiHandler<P extends DefaultParams = DefaultParams>(
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

  return (async (request: Request, routeCtx?: RouteContext<P>): Promise<Response> => {
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

      // ── On-prem lisans kapısı ── LOCKED/NO_LICENSE → herkese 403 (super_admin
      // DAHİL). Bulut modunda no-op. READONLY yazma bloğu aşağıda write-guard'da.
      const pathname = pathOf(request)
      const licenseDecision = await licenseApiGate(pathname)
      if (licenseDecision.blocked) {
        return errorResponse(licenseDecision.message ?? 'Sistem lisansı geçerli değil.', 403)
      }

      // ── O1: First-login (şifre değiştirme) zorunluluğunu API katmanında da zorla ──
      // Middleware /api/*'ı tamamen atlar; mustChangePassword yalnız sayfa middleware'inde +
      // client cookie'sinde (hlms-must-change-pw) enforce ediliyordu → kullanıcı doğrudan API
      // çağırarak (veya sentinel cookie'yi silerek) geçici parolayı değiştirmeden uygulamayı
      // kullanabiliyordu. dbUser.mustChangePassword DB-authoritative'dir (change-password rotası
      // false yapar). /api/auth/* (change-password dahil bu akışı çözen endpoint'ler) ve
      // super_admin hariç.
      //
      // NOT: KVKK onayı ve SMS MFA pending kapıları BİLİNÇLİ olarak burada zorlanmıyor:
      //  • KVKK bir ONAM kaydıdır (güvenlik sınırı değil) ve onay durumu hem JWT user_metadata
      //    hem DB'de tutulur — DB tabanlı API guard'ı, yalnız JWT'de onaylı (DB'de null) eski
      //    kullanıcıları kilitleyip middleware ile tutarsızlık/incident yaratabilirdi. KVKK
      //    sayfa middleware'inde enforce edilmeye devam eder.
      //  • SMS MFA pending cookie/oturum-durumu tabanlıdır; sağlam API enforcement'ı sunucu-tarafı
      //    oturum-MFA bayrağı gerektirir (ayrı iş).
      if (dbUser.role !== 'super_admin' && dbUser.mustChangePassword) {
        const pathname = (() => { try { return new URL(request.url).pathname } catch { return '' } })()
        if (!pathname.startsWith('/api/auth/')) {
          return errorResponse('Devam etmeden önce şifrenizi değiştirmeniz gerekiyor', 403)
        }
      }

      if (roles && roles.length > 0) {
        const roleErr = requireRole(dbUser.role, roles)
        if (roleErr) {
          // Esas Yönetici'nin ek yönetici yetkisi verdiği personel (adminAccessGranted),
          // role'ü 'staff' kalsa da admin-SEVİYESİ route'lara girer (dual-capability).
          // super_admin-only route'lar ('admin' roller listesinde YOKSA) grant'tan ETKİLENMEZ.
          // Middleware + admin layout ile AYNI mantık (bkz. lib/auth/admin-authority.ts).
          const grantAllowsAdmin =
            dbUser.adminAccessGranted && roles.includes('admin' as UserRole)
          if (!grantAllowsAdmin) return roleErr
        }
      }

      // ── Acting-org (drill-in) bağlam çözümü — İKİ MOD ──
      //  super_admin_ro: super_admin bir org'un /admin panelini SALT-OKUNUR görüntüler (destek).
      //  group_rw:       grup yöneticisi (esas yönetici) KENDİ grubundaki bir hastaneye TAM
      //                  KONTROL ile girer (YAZMA açık). Hedef org owner'ın grubuna ait OLMALI.
      // İmzalı klx-acting-org cookie'si isteği hedef org'a scope'lar; Supabase oturumu ASLA
      // değişmez (self-logout yok). PATH-GATE: yalnız /api/admin. Cookie her istekte taze okunur.
      let actingOrgId: string | null = null
      let actingMode: 'super_admin_ro' | 'group_rw' | null = null
      if (pathname.startsWith('/api/admin')) {
        const cookieOrgId = verifyActingOrgToken(readActingOrgCookie(request), dbUser.id, Date.now())
        if (cookieOrgId) {
          if (dbUser.role === 'super_admin') {
            actingOrgId = cookieOrgId
            actingMode = 'super_admin_ro'
          } else if (dbUser.groupId && (await orgInOwnerGroup(cookieOrgId, dbUser.groupId))) {
            // Grup yöneticisi + hedef org gerçekten grubuna ait → tam kontrol drill-in.
            actingOrgId = cookieOrgId
            actingMode = 'group_rw'
          }
        }
      }
      const effectiveOrgId = actingOrgId ?? dbUser.organizationId ?? null

      // Salt-okunur ray — YALNIZ super_admin görüntüleme modunda (GET dışı 403). group_rw
      // yazabilir (TAM KONTROL — kullanıcının onaylı kararı). super_admin normalde write-guard'dan
      // muaftır; bu ray o muafiyeti görüntüleme modunda kapatır.
      if (actingMode === 'super_admin_ro' && WRITE_METHODS.has(request.method.toUpperCase())) {
        return errorResponse('Salt-okunur: kuruluş görüntüleme modunda değişiklik yapılamaz.', 403)
      }

      // requireOrganization — org bağlamı yoksa tenant-scoped route'lara giremez.
      // Cross-tenant write/impersonation hatalarını engeller. Acting-org bağlamı da
      // geçerli bir org sağlar (effectiveOrgId).
      if (requireOrganization && !effectiveOrgId) {
        return errorResponse('Bu işlem için bir kurum bağlamı gerekir', 400)
      }

      // Write guard — super_admin exempt, GET serbest. group_rw'de HEDEF hastanenin
      // (effectiveOrgId) abonelik/seat durumu geçerlidir; normalde dbUser.organizationId.
      // Grup yöneticisinin kendi org'u null olduğundan effectiveOrgId olmasa guard sessizce
      // atlanırdı — bu yüzden acting hedefine bakılır.
      const writeGuardOrgId = actingMode === 'group_rw' ? effectiveOrgId : dbUser.organizationId
      if (writeGuard && WRITE_METHODS.has(request.method.toUpperCase()) && dbUser.role !== 'super_admin' && writeGuardOrgId) {
        const block = await checkWritePermission(writeGuardOrgId, request.method, { pathname })
        if (block) return block
      }

      const ctx: HandlerContext<P, string | null> = {
        request,
        params,
        user,
        dbUser,
        organizationId: effectiveOrgId,
        audit: (p) => createAuditLog({
          userId: dbUser.id,
          request,
          ...p,
          // Ortak personel: p.organizationId verilirse EFEKTİF org'a (B) yaz; yoksa context (primary).
          organizationId: p.organizationId ?? effectiveOrgId,
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
  }) as RouteHandler<P>
}

/** Convenience presets — 90% of routes fall into one of these buckets. */
type PresetExtra = Omit<WithApiHandlerOptions, 'roles'>

export function withAdminRoute<P extends DefaultParams = DefaultParams>(
  handler: (ctx: HandlerContext<P, string>) => Promise<Response>,
  extra: PresetExtra & { requireOrganization: true },
): RouteHandler<P>
export function withAdminRoute<P extends DefaultParams = DefaultParams>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  extra?: PresetExtra,
): RouteHandler<P>
export function withAdminRoute<P extends DefaultParams = DefaultParams>(
  handler: AnyHandler<P>,
  extra: PresetExtra = {},
) {
  return withApiHandler<P>(handler as (ctx: HandlerContext<P, string | null>) => Promise<Response>, { roles: ['admin', 'super_admin'], ...extra })
}

export function withStaffRoute<P extends DefaultParams = DefaultParams>(
  handler: (ctx: HandlerContext<P, string>) => Promise<Response>,
  extra: PresetExtra & { requireOrganization: true },
): RouteHandler<P>
export function withStaffRoute<P extends DefaultParams = DefaultParams>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  extra?: PresetExtra,
): RouteHandler<P>
export function withStaffRoute<P extends DefaultParams = DefaultParams>(
  handler: AnyHandler<P>,
  extra: PresetExtra = {},
) {
  return withApiHandler<P>(handler as (ctx: HandlerContext<P, string | null>) => Promise<Response>, { roles: ['staff', 'admin', 'super_admin'], ...extra })
}

export const withSuperAdminRoute = <P extends DefaultParams = DefaultParams>(
  handler: (ctx: HandlerContext<P, string | null>) => Promise<Response>,
  extra: PresetExtra = {},
) => withApiHandler<P>(handler, { roles: ['super_admin'], strict: true, ...extra })

/**
 * Grup yöneticisi (esas yönetici) route context'i — `groupId` non-null garantili.
 * Çok-hastaneli grubun konsolide/yönetim uçları (`/api/group/*`) için.
 */
export interface GroupHandlerContext<P = unknown> extends HandlerContext<P, string | null> {
  /** Grup yöneticisinin bağlı olduğu hastane grubu (non-null). */
  groupId: string
}

/**
 * `withGroupRoute` — yalnız grup yöneticisi (esas yönetici). Rol gate `admin`/`super_admin`
 * geçirir, ardından TEK kaynak grup-yetkisi kontrolü yapar: `User.groupId` set ⟺ grup yöneticisi
 * (invariant; bkz. `lib/auth/group-authority.ts`). super_admin (groupId yok) 403 alır — grup
 * yönetimi `/super-admin/groups` üzerindendir. Tenant-scoped DEĞİL (grup yöneticisinin org'u null);
 * `requireOrganization` KULLANMA. Belirli bir hastaneye yazma drill-in ile yapılır (/api/admin, Faz 1.5).
 */
export function withGroupRoute<P extends DefaultParams = DefaultParams>(
  handler: (ctx: GroupHandlerContext<P>) => Promise<Response>,
  extra: PresetExtra = {},
): RouteHandler<P> {
  return withApiHandler<P>(
    async (ctx) => {
      const groupId = ctx.dbUser.groupId
      // TEK kaynak grup-yetkisi: User.groupId set ⟺ grup yöneticisi (invariant). Null kontrolü
      // TS'i de string'e daraltır (GroupHandlerContext.groupId non-null).
      if (groupId == null || !hasGroupAuthority({ groupOwner: true, groupId })) {
        return errorResponse('Bu işlem için grup yöneticisi yetkisi gerekir', 403)
      }
      return handler({ ...ctx, groupId })
    },
    { roles: ['admin', 'super_admin'], ...extra },
  )
}
