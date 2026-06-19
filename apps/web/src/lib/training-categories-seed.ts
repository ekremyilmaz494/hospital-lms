import { prisma } from '@/lib/prisma'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'

/**
 * Org için varsayılan eğitim kategorilerini kalıcılaştır (idempotent).
 *
 * Yeni org'lar zaten kuruluş anında (super-admin/organizations) seed edilir.
 * Bu helper, GET artık seed YAPMADIĞI için (CLAUDE.md "GET'te write YASAK")
 * legacy/boş org'lara köprü olur: kategori ekleme (POST) ve ayar sayfasının
 * tetiklediği seed endpoint bu fonksiyonu çağırır. Sadece prisma'ya bağımlı —
 * client bundle'a sızmasın diye `training-categories.ts` sabitinden ayrı tutuldu.
 */
export async function ensureDefaultTrainingCategories(organizationId: string): Promise<void> {
  const count = await prisma.trainingCategory.count({ where: { organizationId } })
  if (count > 0) return

  await prisma.trainingCategory.createMany({
    data: TRAINING_CATEGORIES.map((cat, i) => ({
      organizationId,
      value: cat.value,
      label: cat.label,
      icon: cat.icon,
      order: i,
      isDefault: true,
    })),
    skipDuplicates: true,
  })
}
