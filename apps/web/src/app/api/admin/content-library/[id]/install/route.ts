import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
} from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { CONTENT_LIBRARY_CATEGORIES } from '@/lib/content-library-categories'

/** POST /api/admin/content-library/[id]/install — içeriği kurumun Training tablosuna kopyala */
export const POST = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const { id: contentLibraryId } = params

  const lib = await prisma.contentLibrary.findFirst({
    where: {
      id: contentLibraryId,
      isActive: true,
      OR: [{ organizationId: null }, { organizationId }],
    },
  })
  if (!lib) return errorResponse('İçerik bulunamadı veya aktif değil', 404)

  // Zaten kurulu mu?
  const alreadyInstalled = await prisma.organizationContentLibrary.findUnique({
    where: { organizationId_contentLibraryId: { organizationId, contentLibraryId } },
  })
  if (alreadyInstalled) {
    return errorResponse('Bu içerik kurumunuza zaten eklenmiş', 409)
  }

  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  // Türkçe kategori label'ı
  const categoryLabel =
    CONTENT_LIBRARY_CATEGORIES[lib.category as keyof typeof CONTENT_LIBRARY_CATEGORIES]?.label ??
    lib.category

  const training = await prisma.$transaction(async (tx) => {
    const t = await tx.training.create({
      data: {
        organizationId,
        title:            lib.title,
        description:      lib.description ?? undefined,
        category:         categoryLabel,
        thumbnailUrl:     lib.thumbnailUrl ?? undefined,
        isFromLibrary:    true,
        sourceLibraryId:  lib.id,
        publishStatus:    'published',
        startDate:        now,
        endDate:          oneYearLater,
        isCompulsory:     false,
        createdById:      dbUser.id,
        examDurationMinutes: 30,
        passingScore:     70,
        maxAttempts:      3,
      },
    })

    // S3'te dosyası olan içerik ise tek videolu Training oluştur
    if (lib.s3Key) {
      await tx.trainingVideo.create({
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
    }

    await tx.organizationContentLibrary.create({
      data: {
        organizationId,
        contentLibraryId: lib.id,
        installedBy:      dbUser.id,
      },
    })

    return t
  })

  await audit({
    action:         'content_library.install',
    entityType:     'training',
    entityId:       training.id,
    newData: {
      contentLibraryId: lib.id,
      title:            lib.title,
      trainingId:       training.id,
    },
  })

  revalidatePath('/admin/trainings')
  revalidatePath('/admin/content-library')

  return jsonResponse({ trainingId: training.id, message: `"${lib.title}" kurumunuza eklendi` }, 201)
}, { requireOrganization: true })
