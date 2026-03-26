import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function safePagination(params: URLSearchParams) {
  const page = Math.max(Number(params.get('page') || '1'), 1)
  const limit = Math.min(Math.max(Number(params.get('limit') || '20'), 1), 100)
  const search = (params.get('search') ?? '').slice(0, 200)
  return { page, limit, search, skip: (page - 1) * limit }
}

/** Get authenticated user + DB profile. Returns null responses on failure. */
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, dbUser: null, error: errorResponse('Unauthorized', 401) }
  }

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

/** Require specific roles — returns error response if not authorized */
export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    return errorResponse('Forbidden', 403)
  }
  return null
}

/** Parse JSON body safely */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T
  } catch {
    return null
  }
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

  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      organizationId: params.organizationId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldData: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
      newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
      ipAddress,
      userAgent,
    },
  })
}
