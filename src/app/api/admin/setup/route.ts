import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { setupWizardSchema } from '@/lib/validations'
import { withCache, invalidateCache } from '@/lib/redis'

/** GET /api/admin/setup — Kurulum durumunu döndür */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const data = await withCache(`setup:${organizationId}`, 60, async () => {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { setupCompleted: true, setupStep: true },
    })
    return org ? { setupCompleted: org.setupCompleted, setupStep: org.setupStep } : null
  })

  if (!data) return errorResponse('Kurum bulunamadı', 404)

  return jsonResponse(data, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true })

/** PUT /api/admin/setup — Kurulum adımını kaydet */
export const PUT = withAdminRoute(async ({ request, organizationId }) => {
  const body = await parseBody<unknown>(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = setupWizardSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Doğrulama hatası: ' + parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const data = parsed.data

  try {
    switch (data.step) {
      case 1: {
        // Hastane bilgilerini güncelle
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.code && { code: data.code }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.email !== undefined && { email: data.email }),
            setupStep: 1,
          },
        })
        break
      }

      case 2: {
        // Departmanları oluştur
        if (data.departments && data.departments.length > 0) {
          // Mevcut departmanları temizleme — sadece yenilerini ekle (duplicate koruması)
          const existing = await prisma.department.findMany({
            where: { organizationId },
            select: { name: true },
          })
          const existingNames = new Set(existing.map(d => d.name))
          const newDepts = data.departments.filter(name => !existingNames.has(name))

          if (newDepts.length > 0) {
            await prisma.department.createMany({
              data: newDepts.map((name, idx) => ({
                name,
                organizationId,
                sortOrder: idx,
              })),
            })
          }
        }

        await prisma.organization.update({
          where: { id: organizationId },
          data: { setupStep: 2 },
        })
        break
      }

      case 3: {
        // Eğitim varsayılanlarını güncelle
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            ...(data.defaultPassingScore !== undefined && { defaultPassingScore: data.defaultPassingScore }),
            ...(data.defaultMaxAttempts !== undefined && { defaultMaxAttempts: data.defaultMaxAttempts }),
            ...(data.defaultExamDuration !== undefined && { defaultExamDuration: data.defaultExamDuration }),
            setupStep: 3,
          },
        })
        break
      }

      case 4: {
        // Kurulumu tamamla
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            setupCompleted: true,
            setupStep: 4,
          },
        })
        break
      }
    }

    await invalidateCache(`setup:${organizationId}`)
    const updatedOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        defaultPassingScore: true,
        defaultMaxAttempts: true,
        defaultExamDuration: true,
        setupCompleted: true,
        setupStep: true,
      },
    })

    return jsonResponse(updatedOrg)
  } catch (err) {
    console.error('[Setup API]', err)
    return errorResponse('Kurulum kaydedilirken bir hata oluştu', 500)
  }
}, { requireOrganization: true })
