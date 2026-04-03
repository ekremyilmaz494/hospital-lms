// AI İçerik Stüdyosu — Google NotebookLM bağlantı testi
// POST /api/admin/ai-content-studio/auth/test

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

const AI_SERVICE_URL = process.env.AI_CONTENT_SERVICE_URL ?? 'http://localhost:8100'
const INTERNAL_KEY = process.env.AI_CONTENT_INTERNAL_KEY ?? ''

export async function POST(_request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  try {
    const pyRes = await fetch(`${AI_SERVICE_URL}/api/auth/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY },
      body: JSON.stringify({ org_id: dbUser!.organizationId }),
      signal: AbortSignal.timeout(30_000),
    })

    const pyResult = await pyRes.json().catch(() => ({}))
    return jsonResponse(pyResult, pyRes.ok ? 200 : 502)
  } catch {
    return errorResponse('Python servisine ulaşılamadı.', 503)
  }
}
