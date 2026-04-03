// AI İçerik Stüdyosu — Google NotebookLM bağlantı kesme
// POST /api/admin/ai-content-studio/auth/disconnect

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const AI_SERVICE_URL = process.env.AI_CONTENT_SERVICE_URL ?? 'http://localhost:8100'
const INTERNAL_KEY = process.env.AI_CONTENT_INTERNAL_KEY ?? ''

export async function POST(_request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  // Python servisindeki cookie'yi sil
  try {
    await fetch(`${AI_SERVICE_URL}/api/auth/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY },
      body: JSON.stringify({ org_id: dbUser!.organizationId }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch { /* best-effort */ }

  // DB'den bağlantı kaydını sil
  await prisma.aiGoogleConnection.deleteMany({
    where: { organizationId: dbUser!.organizationId! },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'ai_google.disconnect',
    entityType: 'ai_google_connection',
    entityId: dbUser!.organizationId,
  })

  return jsonResponse({ disconnected: true })
}
