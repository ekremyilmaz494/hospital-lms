import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
  parseBody,
} from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { bulkInstallSchema } from '@/lib/validations'
import { CONTENT_LIBRARY_CATEGORIES } from '@/lib/content-library-categories'

/** POST /api/admin/content-library/bulk-install — kategori bazlı toplu kurulum */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
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
      where: { organizationId },
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
          organizationId,
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
          createdById:         dbUser.id,
          examDurationMinutes: 30,
          passingScore:        70,
          maxAttempts:         3,
        },
      })

      // Tekil install ile parite — s3Key varsa trainingVideo, ayrica
      // organizationContentLibrary kayit. Ikisi de training.id'ye bagli ama
      // birbirinden bagimsiz, paralel calistir.
      await Promise.all([
        lib.s3Key
          ? tx.trainingVideo.create({
              data: {
                trainingId:      t.id,
                title:           lib.title,
                description:     lib.description ?? undefined,
                videoUrl:        lib.s3Key,
                videoKey:        lib.s3Key,
                contentType:     lib.contentType ?? 'video',
                durationSeconds: (lib.duration ?? 0) * 60,
                sortOrder:       0,
              },
            })
          : Promise.resolve(),
        tx.organizationContentLibrary.create({
          data: {
            organizationId,
            contentLibraryId: lib.id,
            installedBy:      dbUser.id,
          },
        }),
      ])
    }
  }, { timeout: 30000 })

  await audit({
    action:         'content_library.bulk_install',
    entityType:     'content_library',
    newData:        { category, installed: toInstall.length, skipped: installedSet.size },
  })

  revalidatePath('/admin/trainings')
  revalidatePath('/admin/content-library')

  return jsonResponse({
    installed: toInstall.length,
    skipped: allInCategory.length - toInstall.length,
  }, 201)
}, { requireOrganization: true })
