import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function safePagination(params: URLSearchParams, maxLimit = 100) {
  const page = Math.max(Number(params.get('page') || '1'), 1)
  const limit = Math.min(Math.max(Number(params.get('limit') || '20'), 1), maxLimit)
  const search = (params.get('search') ?? '').slice(0, 200)
  return { page, limit, search, skip: (page - 1) * limit }
}

/** Get authenticated user + DB profile. Returns null responses on failure.
 *
 * Uses getSession() (local JWT parse) instead of getUser() (HTTP round-trip)
 * because middleware already validates the token with getUser() on every request.
 * This eliminates a redundant Supabase Auth HTTP call per API route (~50-150ms).
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return { user: null, dbUser: null, error: errorResponse('Unauthorized', 401) }
  }

  const user = session.user

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })

  if (!dbUser || !dbUser.isActive) {
    return { user: null, dbUser: null, error: errorResponse('User not found or inactive', 403) }
  }

  // Organization active check — super_admin is exempt
  if (dbUser.role !== 'super_admin' && dbUser.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: dbUser.organizationId },
      select: { isActive: true, isSuspended: true },
    })
    if (!org || !org.isActive || org.isSuspended) {
      return { user: null, dbUser: null, error: errorResponse('Kurumunuzun erişimi askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.', 403) }
    }
  }

  return { user, dbUser, error: null }
}

/**
 * @deprecated Dönüş değerinin kontrol edilmesi unutulabilir — yeni kodda `assertRole` kullanın.
 * Mevcut kullanımlar çalışmaya devam eder, ancak yeni route'lara eklemeyin.
 *
 * Require specific roles — returns error response if not authorized.
 * IMPORTANT: Caller MUST check return value: `if (roleError) return roleError`
 */
export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    return errorResponse('Forbidden', 403)
  }
  return null
}

/**
 * Role guard that throws instead of returning — use in new code.
 * No need to check return value.
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

/** Audit log helper */
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
      },
    })
  } catch (err) {
    // Audit log hatasi ana is akisini durdurmasin — log'la ve devam et
    if (process.env.NODE_ENV === 'development') {
      console.error('[AuditLog] Failed to create audit log:', err)
    } else {
      const entry = { level: 'error', tag: 'AuditLog', msg: 'Failed to create audit log', ts: new Date().toISOString(), extra: err instanceof Error ? err.message : err }
      console.error(JSON.stringify(entry))
    }
  }
}
