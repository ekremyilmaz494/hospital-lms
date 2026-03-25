import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createDepartmentSchema } from '@/lib/validations'

// GET /api/admin/departments — Departman listesi
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const departments = await prisma.department.findMany({
    where: { organizationId: dbUser!.organizationId! },
    include: {
      _count: { select: { users: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return jsonResponse(departments)
}

// POST /api/admin/departments — Yeni departman oluştur
export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid request body')

  const parsed = createDepartmentSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '))
  }

  const { name, description, color, sortOrder } = parsed.data

  // Aynı isimde departman var mı kontrol et
  const existing = await prisma.department.findUnique({
    where: {
      organizationId_name: {
        organizationId: dbUser!.organizationId!,
        name,
      },
    },
  })

  if (existing) {
    return errorResponse('Bu isimde bir departman zaten mevcut', 409)
  }

  const department = await prisma.department.create({
    data: {
      organizationId: dbUser!.organizationId!,
      name,
      description: description || null,
      color: color || '#0d9668',
      sortOrder: sortOrder ?? 0,
    },
    include: {
      _count: { select: { users: true } },
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'department.create',
    entityType: 'department',
    entityId: department.id,
    newData: { name, color },
  })

  return jsonResponse(department, 201)
}
