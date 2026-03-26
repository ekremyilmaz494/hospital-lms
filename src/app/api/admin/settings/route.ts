import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'

// GET /api/admin/settings — Hastane ayarlarını getir
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, logoUrl: true, email: true, phone: true, address: true },
  })

  return jsonResponse({
    defaultPassingScore: 70,
    defaultMaxAttempts: 3,
    defaultExamDuration: 30,
    hospitalName: org?.name ?? '',
    logoUrl: org?.logoUrl ?? '',
    email: org?.email ?? '',
    phone: org?.phone ?? '',
    address: org?.address ?? '',
  })
}

// PUT /api/admin/settings — Hastane ayarlarını güncelle
export async function PUT(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  const { hospitalName, logoUrl, email, phone, address } = body

  const oldOrg = await prisma.organization.findUnique({ where: { id: orgId } })

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(hospitalName !== undefined && { name: hospitalName }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'settings.update',
    entityType: 'organization',
    entityId: orgId,
    oldData: { name: oldOrg?.name, email: oldOrg?.email, phone: oldOrg?.phone },
    newData: { name: updated.name, email: updated.email, phone: updated.phone },
  })

  return jsonResponse({
    hospitalName: updated.name,
    logoUrl: updated.logoUrl ?? '',
    email: updated.email ?? '',
    phone: updated.phone ?? '',
    address: updated.address ?? '',
  })
}
