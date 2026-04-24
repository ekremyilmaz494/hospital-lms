import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { checkSubscriptionStatus } from '@/lib/subscription-guard'

/**
 * Returns the application base URL. Throws in production if NEXT_PUBLIC_APP_URL
 * is not set — falling back to localhost in production is a security risk.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL environment variable is required in production.'
    )
  }
  return url || 'http://localhost:3000'
}

/** Generate a random UUID v4 for request tracing */
export function generateRequestId(): string {
  return crypto.randomUUID()
}

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  const requestId = generateRequestId()
  return NextResponse.json(data, {
    status,
    headers: { 'X-Request-Id': requestId, ...headers },
  })
}

export function errorResponse(message: string, status = 400) {
  const requestId = generateRequestId()
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'X-Request-Id': requestId },
  })
}

export function safePagination(params: URLSearchParams, maxLimit = 100) {
  const page = Math.max(Number(params.get('page') || '1'), 1)
  const limit = Math.min(Math.max(Number(params.get('limit') || '20'), 1), maxLimit)
  const search = (params.get('search') ?? '').slice(0, 200)
  return { page, limit, search, skip: (page - 1) * limit }
}

/** Get authenticated user + DB profile. Returns null responses on failure.
 *
 * Uses getSession() (local JWT parse) for performance (~50-150ms savings).
 * NOTE: Middleware skips /api/* routes entirely, so getSession() is the
 * only auth check for API calls. This means revoked/expired JWT cookies
 * won't be detected until Supabase's own JWT expiry kicks in.
 * For write operations where stronger validation is needed, use
 * getAuthUserStrict() instead.
 *
 * DB user + org status are cached in-memory for 30s to avoid repeated DB hits
 * on rapid page navigations (sidebar triggers setup + in-progress-exams + page API).
 */

// In-memory auth cache — keyed by user ID, 30s TTL
const authCache = new Map<string, { dbUser: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>; orgOk: boolean; expiresAt: number }>()

export async function getAuthUser() {
  // Fast-path: auth cookie yoksa Supabase client oluşturmadan anında 401 dön.
  // ⚠️ CRITICAL: `includes` kullan, `endsWith` DEĞİL!
  // Supabase SSR büyük JWT'leri chunked cookie'lere böler:
  //   sb-xxx-auth-token.0, sb-xxx-auth-token.1, ...
  // `endsWith('-auth-token')` chunked cookie'leri KAÇIRIR → 401 döngüsü!
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  if (!hasAuthCookie) {
    return { user: null, dbUser: null, error: errorResponse('Unauthorized', 401) }
  }

  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return { user: null, dbUser: null, error: errorResponse('Unauthorized', 401) }
  }

  const user = session.user

  // Check in-memory cache first (0ms vs ~200-500ms DB)
  const cached = authCache.get(user.id)
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.orgOk) {
      return { user: null, dbUser: null, error: errorResponse('Kurumunuzun erişimi askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.', 403) }
    }
    return { user, dbUser: cached.dbUser, error: null, organizationId: cached.dbUser.organizationId }
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })

  if (!dbUser || !dbUser.isActive) {
    return { user: null, dbUser: null, error: errorResponse('User not found or inactive', 403) }
  }

  // Organization active check — super_admin is exempt
  let orgOk = true
  if (dbUser.role !== 'super_admin' && dbUser.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: dbUser.organizationId },
      select: { isActive: true, isSuspended: true },
    })
    if (!org || !org.isActive || org.isSuspended) {
      orgOk = false
    }
  }

  // Cache for 30s — LRU eviction
  if (authCache.size > 50) {
    const firstKey = authCache.keys().next().value
    if (firstKey) authCache.delete(firstKey)
  }
  authCache.set(user.id, { dbUser, orgOk, expiresAt: Date.now() + 30_000 })

  if (!orgOk) {
    return { user: null, dbUser: null, error: errorResponse('Kurumunuzun erişimi askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.', 403) }
  }

  return { user, dbUser, error: null, organizationId: dbUser.organizationId }
}

/**
 * Strict auth check — uses getUser() (Supabase HTTP call) for cryptographic
 * JWT validation. Use this for security-critical write operations:
 * password changes, user CRUD, admin operations, role changes.
 *
 * ~100-150ms slower than getAuthUser() but catches revoked/expired tokens.
 */
export async function getAuthUserStrict() {
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  if (!hasAuthCookie) {
    return { user: null, dbUser: null, error: errorResponse('Unauthorized', 401) }
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, dbUser: null, error: errorResponse('Unauthorized', 401) }
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !dbUser.isActive) {
    return { user: null, dbUser: null, error: errorResponse('User not found or inactive', 403) }
  }

  let orgOk = true
  if (dbUser.role !== 'super_admin' && dbUser.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: dbUser.organizationId },
      select: { isActive: true, isSuspended: true },
    })
    if (!org || !org.isActive || org.isSuspended) orgOk = false
  }

  if (!orgOk) {
    return { user: null, dbUser: null, error: errorResponse('Kurumunuzun erişimi askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.', 403) }
  }

  return { user, dbUser, error: null, organizationId: dbUser.organizationId }
}

/**
 * getAuthUser + otomatik subscription write guard.
 * Write isteklerinde (POST/PUT/PATCH/DELETE) subscription durumunu kontrol eder.
 * Expired/suspended ise 403 döner. GET istekleri her zaman serbest.
 * Super admin exempt.
 */
export async function getAuthUserWithWriteGuard(request: Request) {
  const result = await getAuthUser()
  if (result.error) return result

  const { dbUser } = result
  if (!dbUser) return result

  // Super admin exempt
  if (dbUser.role === 'super_admin') return result

  // Write method kontrolü
  const method = request.method.toUpperCase()
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
  if (!writeMethods.includes(method)) return result

  // Subscription check
  if (dbUser.organizationId) {
    const writeBlock = await checkWritePermission(dbUser.organizationId, method)
    if (writeBlock) return { ...result, error: writeBlock }
  }

  return result
}

/**
 * Standart auth role guard. Pattern: `const err = requireRole(role, [...]); if (err) return err;`
 *
 * Returns a 403 error response if the user's role is not in `allowed`, else null.
 * Caller MUST check return value and early-return. De facto standart; yeni route'larda da kullanılabilir.
 * Alternatif: `assertRole` (try/catch içinde throw eder).
 */
export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    return errorResponse('Forbidden', 403)
  }
  return null
}

/**
 * Throwing variant of `requireRole`. Throws `ApiError(403)` if role is not allowed.
 * Kullanım: try/catch bloğu içinde, böylece dönüş değerini kontrol etmeye gerek kalmaz.
 * `requireRole` ile eşdeğer ve her ikisi de geçerli — route'un hata akışına göre seçin.
 */
export function assertRole(role: string, allowed: string[]): void {
  if (!allowed.includes(role)) {
    throw new ApiError('Forbidden', 403)
  }
}

/** Structured API error that can be caught in route handlers */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  toResponse(): Response {
    return errorResponse(this.message, this.status)
  }
}

/**
 * Aboneliği sona ermiş veya askıya alınmış organizasyonların yazma işlemlerini engeller.
 * Sadece POST, PUT, PATCH, DELETE metodlarını bloklar (GET serbest).
 * Redis-cached subscription check kullanır (2 dk TTL).
 *
 * @returns null — yazma izni var, devam et
 * @returns Response — 403 hata yanıtı, yazma engellendi
 */
export async function checkWritePermission(
  organizationId: string,
  method: string,
): Promise<Response | null> {
  // GET istekleri her zaman serbest
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
  if (!writeMethods.includes(method.toUpperCase())) {
    return null
  }

  const subStatus = await checkSubscriptionStatus(organizationId)

  if (subStatus.isExpired) {
    return NextResponse.json(
      {
        error: 'Aboneliğiniz sona ermiştir. Yeni kayıt oluşturma kısıtlanmıştır. Lütfen aboneliğinizi yenileyin.',
        subscriptionStatus: subStatus.status,
      },
      { status: 403 },
    )
  }

  if (subStatus.isGracePeriod) {
    // Grace period — yazmaya izin ver ama uyarı header'ı ekle
    return null
  }

  // trial veya active — serbest
  return null
}

/**
 * checkWritePermission ile aynı kontrol, ancak grace period durumunda
 * response'a uyarı header'ı eklemek isteyen route'lar için yardımcı.
 * Grace period uyarı header key'i: X-Subscription-Warning
 */
export async function getSubscriptionWarningHeaders(
  organizationId: string,
): Promise<Record<string, string>> {
  const subStatus = await checkSubscriptionStatus(organizationId)
  if (subStatus.isGracePeriod) {
    return {
      'X-Subscription-Warning': `Aboneliğinizin süresi dolmuştur. ${subStatus.daysLeft} gün içinde yenilenmezse erişiminiz kısıtlanacaktır.`,
    }
  }
  return {}
}

/** Parse JSON body safely */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T
  } catch {
    return null
  }
}

/** Sanitize sensitive PII from audit log data */
function sanitizeAuditData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  // KVKK: Kişisel veriler audit log'da redact edilmeli
  const sensitiveKeys = ['tcNo', 'password', 'passwordHash', 'phone', 'email', 'firstName', 'lastName', 'address'];
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Compute SHA-256 hash for audit log chain integrity.
 * Includes enough fields to make tampering evident.
 */
export function computeAuditHash(fields: {
  prevHash: string | null
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  createdAt: string
}): string {
  const payload = [
    fields.prevHash ?? '',
    fields.action,
    fields.entityType,
    fields.entityId ?? '',
    fields.userId ?? '',
    fields.createdAt,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

/** Audit log helper — creates a hash-chained record for JCI/SKS compliance */
export async function createAuditLog(params: {
  userId?: string | null
  organizationId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldData?: unknown
  newData?: unknown
  request?: Request
}) {
  const ipAddress = params.request?.headers.get('x-forwarded-for') ?? null
  const userAgent = params.request?.headers.get('user-agent') ?? null

  try {
    // Fetch the last audit log for this organization to get its hash (chain link)
    const lastLog = params.organizationId
      ? await prisma.auditLog.findFirst({
          where: { organizationId: params.organizationId },
          orderBy: { createdAt: 'desc' },
          select: { hash: true },
        })
      : null

    const prevHash = lastLog?.hash ?? null
    const now = new Date()

    const hash = computeAuditHash({
      prevHash,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      userId: params.userId ?? null,
      createdAt: now.toISOString(),
    })

    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        organizationId: params.organizationId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        oldData: params.oldData ? sanitizeAuditData(JSON.parse(JSON.stringify(params.oldData))) as object : undefined,
        newData: params.newData ? sanitizeAuditData(JSON.parse(JSON.stringify(params.newData))) as object : undefined,
        ipAddress,
        userAgent,
        hash,
        prevHash,
        createdAt: now,
      },
    })
  } catch (err) {
    // Audit log hatasi ana is akisini durdurmasin — log'la ve devam et
    try { const Sentry = await import('@sentry/nextjs'); Sentry.captureException(err); } catch { /* Sentry not configured */ }
    if (process.env.NODE_ENV === 'development') {
      console.error('[AuditLog] Failed to create audit log:', err)
    } else {
      const entry = { level: 'error', tag: 'AuditLog', msg: 'Failed to create audit log', ts: new Date().toISOString(), extra: err instanceof Error ? err.message : err }
      console.error(JSON.stringify(entry))
    }
  }
}
