/**
 * Organizasyon yedek payload'ı — tek doğruluk kaynağı.
 *
 * Manuel backup (POST /api/admin/backups), cron backup (GET /api/cron/backup)
 * ve download fallback (GET /api/admin/backups/[id]/download) artık AYNI
 * assembler'ı çağırır. Daha önce üç ayrı yerde inline yazılıyordu (drift);
 * download fallback'te `organization`, `subscription`, `auditLogs`,
 * `organizationId`, `schemaVersion` eksikti + BigInt serialize crash'i vardı —
 * bu da local fallback'ten alınan yedeklerin restore'da bozulmasına yol açıyordu.
 *
 * ──────────────────────────────────────────────────────────────────
 * YENİ PRİSMA MODELİ EKLERSEN — OKU
 * ──────────────────────────────────────────────────────────────────
 * Bu dosya 12 üst-düzey alan + Training içinde 3 nested alan + (opsiyonel)
 * Supabase `authUsers` yedekler. schema.prisma'ya yeni model eklediğinde:
 *
 *  1) Per-org veri mi tutuyor? → Aşağıdaki Promise.all + return objesine ekle,
 *     `BACKUP_SCHEMA_VERSION`'ı bir artır, restore route'un
 *     `BackupData` interface + `isValidBackupData` + delete-then-create
 *     bloklarını + `MAX_SUPPORTED_SCHEMA_VERSION`'ı güncelle.
 *  2) Global veya kasıtlı dışarıda mı? → `__tests__/snapshot.test.ts` içinde
 *     `INTENTIONALLY_EXCLUDED` listesine ekle ve neden olduğunu yorumla.
 *
 * Eklemeyi UNUTMAK = restore sonrası sessiz veri kaybı. `snapshot.test.ts`
 * drift guard'ı PR'ı bloklar; bu yorumu okuyup geçtiysen testi de okumuşsundur.
 */
import { prisma } from '@/lib/prisma'

/**
 * schemaVersion 3: `authUsers` (Supabase auth.users — parola hash'leri dahil) eklendi.
 * Restore'un DR'de personel parolalarını geri yükleyebilmesi için kritik (2026-05-20
 * incident: yedek auth.users içermiyordu → wipe+restore sonrası tüm personel kilitlendi).
 * v2: organization/subscription/auditLogs. v1: yalnız 9 dizi.
 */
export const BACKUP_SCHEMA_VERSION = 3

/** Org `dataRetentionDays` okunamazsa kullanılacak audit-log saklama süresi (DB default'u ile aynı). */
const DEFAULT_AUDIT_RETENTION_DAYS = 365

export interface BackupSnapshotOptions {
  /** Cron job hangi organizasyon için yedek aldığını işaretlemek için. */
  organizationName?: string
  /** Sadece belirli bir zaman damgası üretmek için (test/ download fallback). */
  exportedAt?: Date
  /**
   * Supabase `auth.users` (parola hash'leri dahil) yedeğe eklensin mi?
   * Restore için ZORUNLU → cron + manuel yedek `true` verir. İndirme/export
   * yolları `false` verir: download endpoint zaten `stripSensitiveBackupFields`
   * uygular ama hiç çekmemek "defense in depth"tir (hash dosyaya hiç yazılmaz).
   */
  includeAuthUsers?: boolean
}

export async function buildBackupSnapshot(orgId: string, options: BackupSnapshotOptions = {}) {
  // AuditLog retention: kurumun KENDİ `dataRetentionDays` ayarı (DB ile aynı pencere).
  // Eskiden 90g sabitti → DB 365g tutarken yedek 90g alıyordu, restore'da 90–365 günlük
  // audit geçmişi kalıcı kayboluyordu (uyum/forensics açığı, Bulgu ORTA).
  const orgRetention = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { dataRetentionDays: true },
  })
  const retentionDays = orgRetention?.dataRetentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS
  const auditLogCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

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
    authUsers,
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
    // auth.users — parola hash'leri (encrypted_password) SADECE burada saklanır; public
    // şemasında parola yoktur. Restore'da public.users'tan ÖNCE
    // `INSERT INTO auth.users (...) ON CONFLICT (id) DO NOTHING` ile geri yüklenir.
    // includeAuthUsers=false ise (download/export) hiç çekilmez → hash sızıntısı yok.
    options.includeAuthUsers
      ? prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT au.id, au.email, au.encrypted_password, au.email_confirmed_at,
                 au.phone, au.created_at, au.updated_at,
                 au.raw_user_meta_data, au.raw_app_meta_data
          FROM auth.users au
          JOIN public.users pu ON pu.id = au.id
          WHERE pu.organization_id = ${orgId}::uuid
        `
      : Promise.resolve(undefined),
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
    // authUsers yalnız includeAuthUsers=true iken eklenir — aksi halde anahtar hiç çıkmaz.
    ...(authUsers ? { authUsers } : {}),
    exportedAt: (options.exportedAt ?? new Date()).toISOString(),
    organizationId: orgId,
    ...(options.organizationName ? { organizationName: options.organizationName } : {}),
    schemaVersion: BACKUP_SCHEMA_VERSION,
  }
}
