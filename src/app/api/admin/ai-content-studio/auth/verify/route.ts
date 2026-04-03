// AI İçerik Stüdyosu — Google NotebookLM bağlantı doğrulama
// POST /api/admin/ai-content-studio/auth/verify

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const AI_SERVICE_URL = process.env.AI_CONTENT_SERVICE_URL ?? 'http://localhost:8100'
const INTERNAL_KEY = process.env.AI_CONTENT_INTERNAL_KEY ?? ''

export async function POST(_request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  // Python servisine doğrulama isteği
  const pyRes = await fetch(`${AI_SERVICE_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY },
    body: JSON.stringify({ org_id: dbUser!.organizationId }),
    signal: AbortSignal.timeout(15_000),
  })

  const pyResult = await pyRes.json().catch(() => ({}))

  // DB güncelle
  if (pyResult.connected) {
    await prisma.aiGoogleConnection.updateMany({
      where: { organizationId: dbUser!.organizationId! },
      data: {
        status: 'connected',
        lastVerifiedAt: new Date(),
        errorMessage: null,
      },
    })
  } else {
    await prisma.aiGoogleConnection.updateMany({
      where: { organizationId: dbUser!.organizationId! },
      data: {
        status: 'error',
        errorMessage: pyResult.error ?? 'Doğrulama başarısız.',
      },
    })
  }

  return jsonResponse(pyResult)
}
