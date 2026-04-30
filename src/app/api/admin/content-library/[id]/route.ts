import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
} from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { deleteObject } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/admin/content-library/[id]
 *
 * Kurumun kendi yüklediği içeriği siler. Platform içerikleri (organizationId=null)
 * veya başka kurumların içerikleri silinemez — sadece super-admin o içerikleri
 * yönetebilir.
 *
 * Kural: Bu içerik bir eğitimde (Training.sourceLibraryId) hâlâ kullanılıyorsa
 * silme reddedilir — aksi halde kullanılan video S3 nesnesi orphan olur ve
 * eğitim çalışmaz. Kullanıcı önce eğitimi arşivlemeli/silmeli.
 */
export const DELETE = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const allowed = await checkRateLimit(`content-library:delete:${dbUser.id}`, 20, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const { id } = params

  try {
    const item = await prisma.contentLibrary.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        organizationId: true,
        s3Key: true,
        thumbnailUrl: true,
      },
    })
    if (!item) return errorResponse('İçerik bulunamadı', 404)

    // Sadece kendi kurumunun yüklediği içeriği silebilir
    if (item.organizationId !== organizationId) {
      return errorResponse(
        'Bu içerik kurumunuza ait değil — platform içerikleri yalnızca sistem yöneticisi tarafından silinebilir.',
        403,
      )
    }

    // Eğitim bağımlılığı kontrolü
    const [dependentTrainings, installCount] = await Promise.all([
      prisma.training.findMany({
        where: { sourceLibraryId: id, organizationId },
        select: { id: true, title: true },
        take: 5,
      }),
      prisma.organizationContentLibrary.count({
        where: { contentLibraryId: id },
      }),
    ])

    if (dependentTrainings.length > 0 || installCount > 0) {
      const titles = dependentTrainings.map((t) => `"${t.title}"`).join(', ')
      return errorResponse(
        `Bu içerik ${dependentTrainings.length > 0 ? titles + ' eğitim(ler)inde' : 'kurumunuzda'} hâlâ kullanılıyor. Önce ilgili eğitimi silin, ardından içeriği kaldırabilirsiniz.`,
        409,
      )
    }

    // Önce DB — başarılı olursa S3 temizliği (fire-and-forget, orphan olsa log)
    await prisma.contentLibrary.delete({ where: { id } })

    // S3 temizliği — deleteObject hata fırlatmaz, orphan'ı loglar
    const s3KeysToDelete: string[] = []
    if (item.s3Key) s3KeysToDelete.push(item.s3Key)
    if (item.thumbnailUrl && !item.thumbnailUrl.startsWith('http')) {
      s3KeysToDelete.push(item.thumbnailUrl)
    }
    await Promise.all(s3KeysToDelete.map((key) => deleteObject(key)))

    await audit({
      action:         'content_library.delete',
      entityType:     'content_library',
      entityId:       item.id,
      oldData: {
        title:  item.title,
        s3Key:  item.s3Key,
      },
    })

    revalidatePath('/admin/content-library')

    return jsonResponse({ success: true, message: `"${item.title}" silindi` })
  } catch (err) {
    logger.error('ContentLibraryDelete', 'İçerik silinemedi', err)
    return errorResponse('İçerik silinirken hata oluştu', 500)
  }
}, { requireOrganization: true })
