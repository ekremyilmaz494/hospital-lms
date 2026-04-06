import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { setupWizardSchema } from '@/lib/validations'

/** GET /api/admin/setup — Kurulum durumunu döndür */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const org = await prisma.organization.findUnique({
    where: { id: dbUser!.organizationId! },
    select: { setupCompleted: true, setupStep: true },
  })

  if (!org) return errorResponse('Kurum bulunamadı', 404)

  return jsonResponse({ setupCompleted: org.setupCompleted, setupStep: org.setupStep })
}

/** PUT /api/admin/setup — Kurulum adımını kaydet */
export async function PUT(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody<unknown>(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = setupWizardSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Doğrulama hatası: ' + parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const data = parsed.data
  const orgId = dbUser!.organizationId!

  try {
    switch (data.step) {
      case 1: {
        // Hastane bilgilerini güncelle
        await prisma.organization.update({
          where: { id: orgId },
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
            where: { organizationId: orgId },
            select: { name: true },
          })
          const existingNames = new Set(existing.map(d => d.name))
          const newDepts = data.departments.filter(name => !existingNames.has(name))

          if (newDepts.length > 0) {
            await prisma.department.createMany({
              data: newDepts.map((name, idx) => ({
                name,
                organizationId: orgId,
                sortOrder: idx,
              })),
            })
          }
        }

        await prisma.organization.update({
          where: { id: orgId },
          data: { setupStep: 2 },
        })
        break
      }

      case 3: {
        // Eğitim varsayılanlarını güncelle
        await prisma.organization.update({
          where: { id: orgId },
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
          where: { id: orgId },
          data: {
            setupCompleted: true,
            setupStep: 4,
          },
        })
        break
      }
    }

    const updatedOrg = await prisma.organization.findUnique({
      where: { id: orgId },
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
}
