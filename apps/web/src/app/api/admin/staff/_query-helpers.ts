import type { Prisma } from '@/generated/prisma/client'

/** Dönem (periodId) query param doğrulaması — sadece UUID kabul, gerisi "tüm dönemler". */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * İzin verilen sıralama alanları → Prisma orderBy.
 * Hesaplanmış kolonlar (Eğitim tamamlanma, Ort. Puan) BİLİNÇLİ olarak yok — onlar wave-2'de
 * sayfa-bazlı türetiliyor, tüm veri seti üzerinde DB-sıralaması yapılamaz; UI'da da sıralama
 * okları kapalı (yanıltıcı söz vermemek için). Geçersiz/boş sort → createdAt desc (varsayılan).
 */
export function buildStaffOrderBy(
  sort: string | null,
  order: 'asc' | 'desc',
): Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[] {
  switch (sort) {
    case 'name': return [{ lastName: order }, { firstName: order }]
    case 'department': return { departmentRel: { name: order } }
    case 'title': return { title: order }
    case 'status': return { isActive: order }
    default: return { createdAt: 'desc' }
  }
}
