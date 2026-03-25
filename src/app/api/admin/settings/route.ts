import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

// GET /api/admin/settings — Hastane ayarlarını getir
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Organizasyon adını DB'den çek
  let hospitalName = ''
  if (dbUser!.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: dbUser!.organizationId },
      select: { name: true, logoUrl: true },
    })
    hospitalName = org?.name ?? ''
  }

  return jsonResponse({
    defaultPassingScore: 70,
    defaultMaxAttempts: 3,
    defaultExamDuration: 30,
    hospitalName,
    logoUrl: '',
  })
}

// PUT /api/admin/settings — Hastane ayarlarını güncelle
export async function PUT(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  // TODO: DB'ye kaydet
  return jsonResponse({ success: true })
}
