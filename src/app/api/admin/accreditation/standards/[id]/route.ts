import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  createAuditLog,
} from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

const VALID_BODIES = ['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA'] as const
const VALID_CATEGORIES = [
  'enfeksiyon', 'is-guvenligi', 'hasta-haklari', 'radyoloji',
  'laboratuvar', 'eczane', 'acil', 'genel',
] as const

const UpdateSchema = z.object({
  code: z.string().trim().min(2).max(50),
  title: z.string().trim().min(3).max(500),
  description: z.string().trim().max(2000).optional().nullable(),
  standardBody: z.enum(VALID_BODIES),
  requiredTrainingCategories: z.array(z.enum(VALID_CATEGORIES)).min(1),
  requiredCompletionRate: z.number().int().min(0).max(100),
})

/**
 * PUT /api/admin/accreditation/standards/:id
 *
 * Sadece kuruma ait standartlar düzenlenebilir. Global standartlar readonly.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params
  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`accred-standard-write:${orgId}`, 20, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Bir dakika bekleyin.', 429)

  const raw = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
  }
  const body = parsed.data

  try {
    const existing = await prisma.accreditationStandard.findUnique({
      where: { id },
      select: { id: true, organizationId: true, code: true },
    })
    if (!existing) return errorResponse('Standart bulunamadı', 404)
    if (existing.organizationId !== orgId) {
      return errorResponse('Bu standart düzenlenemez', 403)
    }

    // Code değişirse (code, org) unique çakışmasına bak
    if (body.code !== existing.code) {
      const dup = await prisma.accreditationStandard.findFirst({
        where: { code: body.code, organizationId: orgId, NOT: { id } },
        select: { id: true },
      })
      if (dup) return errorResponse('Bu kodla kayıtlı başka bir standart var', 409)
    }

    const updated = await prisma.accreditationStandard.update({
      where: { id },
      data: {
        code: body.code,
        title: body.title,
        description: body.description ?? null,
        standardBody: body.standardBody,
        requiredTrainingCategories: body.requiredTrainingCategories,
        requiredCompletionRate: body.requiredCompletionRate,
      },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        standardBody: true,
        requiredTrainingCategories: true,
        requiredCompletionRate: true,
        organizationId: true,
        createdAt: true,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'accreditation_standard.update',
      entityType: 'accreditation_standard',
      entityId: id,
      newData: updated,
      request,
    })

    return jsonResponse({ standard: { ...updated, isCustom: true } })
  } catch (err) {
    logger.error('accreditation-standards', 'PUT failed', { err, id })
    return errorResponse('Standart güncellenemedi', 500)
  }
}

/**
 * DELETE /api/admin/accreditation/standards/:id
 *
 * Soft-delete: isActive = false. Sadece kuruma ait standartlar silinebilir.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params
  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`accred-standard-write:${orgId}`, 20, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Bir dakika bekleyin.', 429)

  try {
    const existing = await prisma.accreditationStandard.findUnique({
      where: { id },
      select: { id: true, organizationId: true, code: true },
    })
    if (!existing) return errorResponse('Standart bulunamadı', 404)
    if (existing.organizationId !== orgId) {
      return errorResponse('Bu standart silinemez', 403)
    }

    await prisma.accreditationStandard.update({
      where: { id },
      data: { isActive: false },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'accreditation_standard.delete',
      entityType: 'accreditation_standard',
      entityId: id,
      oldData: existing,
      request,
    })

    return jsonResponse({ ok: true })
  } catch (err) {
    logger.error('accreditation-standards', 'DELETE failed', { err, id })
    return errorResponse('Standart silinemedi', 500)
  }
}
