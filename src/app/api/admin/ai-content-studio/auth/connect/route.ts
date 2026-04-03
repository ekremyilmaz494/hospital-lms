// AI İçerik Stüdyosu — Google NotebookLM bağlantısı kurma
// POST /api/admin/ai-content-studio/auth/connect

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { encrypt } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'

const AI_SERVICE_URL = process.env.AI_CONTENT_SERVICE_URL ?? 'http://localhost:8100'
const INTERNAL_KEY = process.env.AI_CONTENT_INTERNAL_KEY ?? ''

export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Geçersiz istek.')

  const { email, method, cookieData } = body
  if (!email) return errorResponse('email zorunludur.')
  if (!method || !['browser', 'cookie'].includes(method)) {
    return errorResponse('method "browser" veya "cookie" olmalıdır.')
  }
  if (method === 'cookie' && !cookieData) {
    return errorResponse('Cookie method için cookieData zorunludur.')
  }

  // Python servisine bağlantı isteği gönder
  const pyRes = await fetch(`${AI_SERVICE_URL}/api/auth/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY },
    body: JSON.stringify({
      org_id: dbUser!.organizationId,
      email,
      method,
      cookie_data: cookieData ?? undefined,
    }),
    signal: AbortSignal.timeout(150_000), // Browser login 120sn sürebilir
  })

  if (!pyRes.ok) {
    const pyBody = await pyRes.json().catch(() => ({}))
    return errorResponse(pyBody.detail ?? 'Bağlantı başarısız.', pyRes.status)
  }

  const pyResult = await pyRes.json()

  // Cookie verisini şifrele
  const encryptedCookie = cookieData ? encrypt(JSON.stringify(cookieData)) : null

  // DB'ye kaydet (upsert — organizasyon başına tek bağlantı)
  await prisma.aiGoogleConnection.upsert({
    where: { organizationId: dbUser!.organizationId! },
    create: {
      organizationId: dbUser!.organizationId!,
      userId: dbUser!.id,
      email,
      method,
      status: 'connected',
      encryptedCookie,
      lastVerifiedAt: new Date(),
    },
    update: {
      userId: dbUser!.id,
      email,
      method,
      status: 'connected',
      encryptedCookie,
      lastVerifiedAt: new Date(),
      errorMessage: null,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'ai_google.connect',
    entityType: 'ai_google_connection',
    entityId: dbUser!.organizationId,
    newData: { email, method },
  })

  return jsonResponse({
    connected: true,
    email,
    method,
    connectedAt: new Date().toISOString(),
  })
}
