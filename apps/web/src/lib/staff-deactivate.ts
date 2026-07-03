/**
 * Personel soft-delete (deaktivasyon) primitifi.
 *
 * `admin/staff/[id]` DELETE route'undan davranış korunarak çıkarıldı; İK/HBYS
 * senkron çekirdeği (`src/lib/integration/ingest.ts`) da aynı primitifi kullanır.
 * KVKK purge/anonimleştirme BURADA DEĞİL — o akış route'ta kalır.
 */
import { prisma } from '@/lib/prisma'

export interface DeactivateStaffOptions {
  /** Multi-tenant guard — kullanıcı bu organizasyona ait olmalı (CLAUDE.md) */
  organizationId: string
  /**
   * Çağıran, kullanıcının güncel `isActive` değerini zaten sorguladıysa geçirir
   * (ekstra sorguyu atlar). Verilmezse helper kendisi okur.
   */
  wasActive?: boolean
}

/**
 * Personeli pasifleştirir (soft delete):
 *  - `isActive=false`; `deactivatedAt` YALNIZ aktif→pasif geçişinde damgalanır
 *    (zaten pasifse KVKK saklama saati sıfırlanmasın),
 *  - devam eden sınav denemeleri (`pre_exam`/`watching_videos`/`post_exam`)
 *    `expired` durumuna çekilir.
 * İkisi tek `prisma.$transaction` içinde, org-scope guard'lı çalışır.
 */
export async function deactivateStaff(userId: string, opts: DeactivateStaffOptions): Promise<void> {
  let wasActive = opts.wasActive
  if (wasActive === undefined) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: opts.organizationId },
      select: { isActive: true },
    })
    wasActive = user?.isActive ?? false
  }

  // Soft delete: deactivate + aktif sınavları iptal et (multi-tenant güvenli)
  // deactivatedAt yalnız aktif→pasif geçişinde damgalanır.
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: userId, organizationId: opts.organizationId },
      data: { isActive: false, ...(wasActive ? { deactivatedAt: new Date() } : {}) },
    }),
    prisma.examAttempt.updateMany({
      where: {
        userId,
        // Multi-tenant guard: examAttempt user'ı aynı organizasyonda olmalı (CLAUDE.md)
        user: { organizationId: opts.organizationId },
        status: { in: ['pre_exam', 'watching_videos', 'post_exam'] },
      },
      data: { status: 'expired', isPassed: false, postExamCompletedAt: new Date() },
    }),
  ])
}
