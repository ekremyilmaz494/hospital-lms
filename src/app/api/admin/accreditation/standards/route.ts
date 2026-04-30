import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

const VALID_BODIES = ['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA'] as const
const VALID_CATEGORIES = [
  'enfeksiyon', 'is-guvenligi', 'hasta-haklari', 'radyoloji',
  'laboratuvar', 'eczane', 'acil', 'genel',
] as const

const StandardSchema = z.object({
  code: z.string().trim().min(2).max(50),
  title: z.string().trim().min(3).max(500),
  description: z.string().trim().max(2000).optional().nullable(),
  standardBody: z.enum(VALID_BODIES),
  requiredTrainingCategories: z.array(z.enum(VALID_CATEGORIES)).min(1),
  requiredCompletionRate: z.number().int().min(0).max(100),
})

/**
 * GET /api/admin/accreditation/standards?standardBody=JCI
 *
 * Kurum için geçerli standartları döndürür:
 *   - global standartlar (organizationId = NULL)
 *   - kurumun kendi oluşturduğu standartlar (organizationId = currentOrg)
 */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const standardBody = searchParams.get('standardBody') ?? undefined

  try {
    const standards = await prisma.accreditationStandard.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: null },
          { organizationId },
        ],
        ...(standardBody ? { standardBody } : {}),
      },
      orderBy: [{ standardBody: 'asc' }, { code: 'asc' }],
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

    // isCustom flag: UI'da kilit ikonu / düzenleme butonu için
    const items = standards.map(s => ({
      ...s,
      isCustom: s.organizationId !== null,
    }))

    return jsonResponse({ standards: items }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (err) {
    logger.error('accreditation-standards', 'GET failed', { err })
    return errorResponse('Standartlar getirilemedi', 500)
  }
}, { requireOrganization: true })

/**
 * POST /api/admin/accreditation/standards
 *
 * Kuruma özel standart oluşturur. organizationId otomatik atanır.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const orgId = organizationId

  const allowed = await checkRateLimit(`accred-standard-write:${orgId}`, 20, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Bir dakika bekleyin.', 429)

  const raw = await request.json().catch(() => null)
  const parsed = StandardSchema.safeParse(raw)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
  }
  const body = parsed.data

  try {
    // (code, organizationId) unique — aynı kurum içinde aynı kod yasak
    const existing = await prisma.accreditationStandard.findFirst({
      where: { code: body.code, organizationId: orgId },
      select: { id: true },
    })
    if (existing) {
      return errorResponse('Bu kodla kayıtlı bir standartınız zaten var', 409)
    }

    const created = await prisma.accreditationStandard.create({
      data: {
        code: body.code,
        title: body.title,
        description: body.description ?? null,
        standardBody: body.standardBody,
        requiredTrainingCategories: body.requiredTrainingCategories,
        requiredCompletionRate: body.requiredCompletionRate,
        organizationId: orgId,
        createdById: dbUser.id,
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

    await audit({
      action: 'accreditation_standard.create',
      entityType: 'accreditation_standard',
      entityId: created.id,
      newData: created,
    })

    return jsonResponse({ standard: { ...created, isCustom: true } }, 201)
  } catch (err) {
    logger.error('accreditation-standards', 'POST failed', { err, orgId })
    return errorResponse('Standart oluşturulamadı', 500)
  }
}, { requireOrganization: true })
