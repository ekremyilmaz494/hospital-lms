import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
} from '@/lib/api-helpers'
import { bulkInstallSchema } from '@/lib/validations'
import { CONTENT_LIBRARY_CATEGORIES } from '@/lib/content-library-categories'

/** POST /api/admin/content-library/bulk-install — kategori bazlı toplu kurulum */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = bulkInstallSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(`Hatalı kategori: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400)
  }

  const { category } = parsed.data

  const [allInCategory, existingInstalls] = await Promise.all([
    prisma.contentLibrary.findMany({
      where: { category, isActive: true },
    }),
    prisma.organizationContentLibrary.findMany({
      where: { organizationId: orgId },
      select: { contentLibraryId: true },
    }),
  ])

  if (allInCategory.length === 0) {
    return errorResponse('Bu kategoride aktif içerik bulunamadı', 404)
  }

  const installedSet = new Set(existingInstalls.map(i => i.contentLibraryId))
  const toInstall = allInCategory.filter(lib => !installedSet.has(lib.id))

  if (toInstall.length === 0) {
    return jsonResponse({ installed: 0, skipped: allInCategory.length })
  }

  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  const categoryLabel =
    CONTENT_LIBRARY_CATEGORIES[category as keyof typeof CONTENT_LIBRARY_CATEGORIES]?.label ??
    category

  await prisma.$transaction(async (tx) => {
    for (const lib of toInstall) {
      const t = await tx.training.create({
        data: {
          organizationId:      orgId,
          title:               lib.title,
          description:         lib.description ?? undefined,
          category:            categoryLabel,
          thumbnailUrl:        lib.thumbnailUrl ?? undefined,
          isFromLibrary:       true,
          sourceLibraryId:     lib.id,
          publishStatus:       'published',
          startDate:           now,
          endDate:             oneYearLater,
          isCompulsory:        false,
          createdById:         dbUser!.id,
          examDurationMinutes: 30,
          passingScore:        70,
          maxAttempts:         3,
        },
      })

      await tx.organizationContentLibrary.create({
        data: {
          organizationId:   orgId,
          contentLibraryId: lib.id,
          installedBy:      dbUser!.id,
        },
      })

      void t // suppress unused warning
    }
  }, { timeout: 30000 })

  await createAuditLog({
    userId:         dbUser!.id,
    organizationId: orgId,
    action:         'content_library.bulk_install',
    entityType:     'content_library',
    newData:        { category, installed: toInstall.length, skipped: installedSet.size },
    request,
  })

  revalidatePath('/admin/trainings')
  revalidatePath('/admin/content-library')

  return jsonResponse({
    installed: toInstall.length,
    skipped: allInCategory.length - toInstall.length,
  }, 201)
}
