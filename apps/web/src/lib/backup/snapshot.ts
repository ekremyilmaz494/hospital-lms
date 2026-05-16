/**
 * Organizasyon yedek payload'ı — tek doğruluk kaynağı.
 *
 * Manuel backup (POST /api/admin/backups), cron backup
 * ve download fallback artık aynı assembler'ı çağırır. Daha önce
 * üç ayrı yerde yazılıyordu; download fallback'te `organization`,
 * `subscription`, `auditLogs`, `organizationId`, `schemaVersion`
 * alanları eksikti — bu da local fallback'ten alınan yedeklerin
 * restore sırasında bozulmasına yol açıyordu.
 *
 * ──────────────────────────────────────────────────────────────────
 * YENİ PRİSMA MODELİ EKLERSEN — OKU
 * ──────────────────────────────────────────────────────────────────
 * Bu dosya 12 üst-düzey alan + Training içinde 3 nested alan yedekler.
 * schema.prisma'ya yeni model eklediğinde:
 *
 *  1) Per-org veri mi tutuyor? → Aşağıdaki Promise.all + return objesine ekle,
 *     `BACKUP_SCHEMA_VERSION`'ı bir artır, restore route'un
 *     `BackupData` interface + `isValidBackupData` + delete-then-create
 *     bloklarını güncelle.
 *  2) Global veya kasıtlı dışarıda mı? → `__tests__/snapshot.test.ts` içinde
 *     `INTENTIONALLY_EXCLUDED` listesine ekle ve neden olduğunu yorumla.
 *
 * Eklemeyi UNUTMAK = restore sonrası sessiz veri kaybı. `snapshot.test.ts`
 * drift guard'ı PR'ı bloklar; bu yorumu okuyup geçtiysen testi de okumuşsundur.
 */
import { prisma } from '@/lib/prisma'

export const BACKUP_SCHEMA_VERSION = 2
const AUDIT_LOG_RETENTION_DAYS = 90

export interface BackupSnapshotOptions {
  /** Cron job hangi organizasyon için yedek aldığını işaretlemek için. */
  organizationName?: string
  /** Sadece belirli bir zaman damgası üretmek için (test/ download fallback). */
  exportedAt?: Date
}

export async function buildBackupSnapshot(orgId: string, options: BackupSnapshotOptions = {}) {
  const auditLogCutoff = new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const [
    organization,
    subscription,
    users,
    departments,
    trainings,
    assignments,
    attempts,
    examAnswers,
    videoProgress,
    notifications,
    certificates,
    auditLogs,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.organizationSubscription.findUnique({ where: { organizationId: orgId } }),
    prisma.user.findMany({ where: { organizationId: orgId } }),
    prisma.department.findMany({ where: { organizationId: orgId } }),
    prisma.training.findMany({
      where: { organizationId: orgId },
      include: { videos: true, questions: { include: { options: true } } },
    }),
    prisma.trainingAssignment.findMany({ where: { training: { organizationId: orgId } } }),
    prisma.examAttempt.findMany({ where: { training: { organizationId: orgId } } }),
    prisma.examAnswer.findMany({ where: { attempt: { training: { organizationId: orgId } } } }),
    prisma.videoProgress.findMany({ where: { attempt: { training: { organizationId: orgId } } } }),
    prisma.notification.findMany({ where: { organizationId: orgId } }),
    prisma.certificate.findMany({ where: { training: { organizationId: orgId } } }),
    prisma.auditLog.findMany({ where: { organizationId: orgId, createdAt: { gte: auditLogCutoff } } }),
  ])

  return {
    organization,
    subscription,
    users,
    departments,
    trainings,
    assignments,
    attempts,
    examAnswers,
    videoProgress,
    notifications,
    certificates,
    auditLogs,
    exportedAt: (options.exportedAt ?? new Date()).toISOString(),
    organizationId: orgId,
    ...(options.organizationName ? { organizationName: options.organizationName } : {}),
    schemaVersion: BACKUP_SCHEMA_VERSION,
  }
}
