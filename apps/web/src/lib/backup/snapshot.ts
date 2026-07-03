/**
 * Organizasyon yedek payload'ı — tek doğruluk kaynağı.
 *
 * Manuel backup (POST /api/super-admin/backups), cron backup (GET /api/cron/backup)
 * ve download fallback (GET /api/super-admin/backups/[id]/download) AYNI assembler'ı
 * çağırır (drift yok).
 *
 * ──────────────────────────────────────────────────────────────────
 * YENİ PRİSMA MODELİ EKLERSEN — OKU
 * ──────────────────────────────────────────────────────────────────
 * schema.prisma'ya yeni model eklediğinde:
 *  1) Per-org veri mi tutuyor? → Aşağıdaki Promise.all + return objesine ekle,
 *     `BACKUP_SCHEMA_VERSION`'ı bir artır, restore route'un `BackupData` interface +
 *     `isValidBackupData` + delete/insert bloklarını + `MAX_SUPPORTED_SCHEMA_VERSION`'ı
 *     güncelle (FK sırası: parent→child insert, child→parent delete; Restrict'liler önce).
 *  2) Global veya kasıtlı dışarıda mı? → `__tests__/snapshot.test.ts` içinde
 *     `INTENTIONALLY_EXCLUDED` listesine ekle ve neden olduğunu yorumla.
 *
 * Eklemeyi UNUTMAK = restore sonrası sessiz veri kaybı. `snapshot.test.ts`
 * drift guard'ı PR'ı bloklar; bu yorumu okuyup geçtiysen testi de okumuşsundur.
 */
import { prisma } from '@/lib/prisma'

/**
 * schemaVersion 5: İK entegrasyon konfigürasyonu eklendi — StaffIntegration (İK/HBYS kanal
 * ayarları; pullCredentialsEncrypted AES-256-GCM şifreli, ENCRYPTION_KEY olmadan açılmaz) +
 * IntegrationApiKey (yalnız SHA-256 hash, düz anahtar yok). Restore sonrası hastanenin
 * entegrasyonu çalışmaya devam etmeli. SyncRun/SyncRowResult KASITLI dışarıda (telemetri +
 * KVKK veri-minimizasyonu — bkz. snapshot.test.ts INTENTIONALLY_EXCLUDED).
 * v4: kapsam genişletildi — 27 org modeli daha eklendi (MediaAsset, ScormAttempt,
 * TrainingFeedback*, Smg*, Accreditation*, Competency*, QuestionBank*, TrainingCategory/Period,
 * DepartmentTrainingRule, ExamAttemptRequest, Daily*, KvkkRequest). Restore'da bunlar yoksa
 * kalıcı kaybediliyordu.
 * v3: authUsers (parola hash'leri). v2: organization/subscription/auditLogs. v1: 9 dizi.
 */
export const BACKUP_SCHEMA_VERSION = 5

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
   * yolları `false` verir (download endpoint zaten `stripSensitiveBackupFields` uygular;
   * hiç çekmemek "defense in depth" — hash dosyaya hiç yazılmaz).
   */
  includeAuthUsers?: boolean
}

export async function buildBackupSnapshot(orgId: string, options: BackupSnapshotOptions = {}) {
  // AuditLog retention: kurumun KENDİ `dataRetentionDays` ayarı (DB ile aynı pencere).
  const orgRetention = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { dataRetentionDays: true },
  })
  const retentionDays = orgRetention?.dataRetentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS
  const auditLogCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const [
    // ── Mevcut çekirdek (schemaVersion ≤ 3) ──
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
    // ── v4 kapsam genişlemesi (27 model) ──
    mediaAssets,
    trainingCategories,
    trainingPeriods,
    scormAttempts,
    trainingFeedbackForms,
    trainingFeedbackCategories,
    trainingFeedbackItems,
    trainingFeedbackResponses,
    trainingFeedbackAnswers,
    smgPeriods,
    smgCategories,
    smgActivities,
    smgTargets,
    accreditationStandards,
    accreditationReports,
    departmentTrainingRules,
    questionBanks,
    questionBankOptions,
    competencyForms,
    competencyCategories,
    competencyItems,
    competencyEvaluations,
    competencyAnswers,
    examAttemptRequests,
    kvkkRequests,
    dailyReviews,
    dailySubmissions,
    // ── v5: İK entegrasyon konfigürasyonu ──
    staffIntegrations,
    integrationApiKeys,
    // ── Opsiyonel: Supabase auth.users (en sonda — koşullu) ──
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
    // ── v4 modelleri (org-scope; transitive olanlar parent relation'ı üzerinden) ──
    prisma.mediaAsset.findMany({ where: { organizationId: orgId } }),
    prisma.trainingCategory.findMany({ where: { organizationId: orgId } }),
    prisma.trainingPeriod.findMany({ where: { organizationId: orgId } }),
    prisma.scormAttempt.findMany({ where: { organizationId: orgId } }),
    prisma.trainingFeedbackForm.findMany({ where: { organizationId: orgId } }),
    prisma.trainingFeedbackCategory.findMany({ where: { form: { organizationId: orgId } } }),
    prisma.trainingFeedbackItem.findMany({ where: { category: { form: { organizationId: orgId } } } }),
    prisma.trainingFeedbackResponse.findMany({ where: { organizationId: orgId } }),
    prisma.trainingFeedbackAnswer.findMany({ where: { response: { organizationId: orgId } } }),
    prisma.smgPeriod.findMany({ where: { organizationId: orgId } }),
    prisma.smgCategory.findMany({ where: { organizationId: orgId } }),
    prisma.smgActivity.findMany({ where: { organizationId: orgId } }),
    prisma.smgTarget.findMany({ where: { organizationId: orgId } }),
    // AccreditationStandard.organizationId NULLABLE → { organizationId: orgId } global (null) olanları HARİÇ tutar (kasıtlı).
    prisma.accreditationStandard.findMany({ where: { organizationId: orgId } }),
    prisma.accreditationReport.findMany({ where: { organizationId: orgId } }),
    prisma.departmentTrainingRule.findMany({ where: { organizationId: orgId } }),
    prisma.questionBank.findMany({ where: { organizationId: orgId } }),
    prisma.questionBankOption.findMany({ where: { question: { organizationId: orgId } } }),
    prisma.competencyForm.findMany({ where: { organizationId: orgId } }),
    prisma.competencyCategory.findMany({ where: { form: { organizationId: orgId } } }),
    prisma.competencyItem.findMany({ where: { category: { form: { organizationId: orgId } } } }),
    prisma.competencyEvaluation.findMany({ where: { form: { organizationId: orgId } } }),
    prisma.competencyAnswer.findMany({ where: { evaluation: { form: { organizationId: orgId } } } }),
    prisma.examAttemptRequest.findMany({ where: { organizationId: orgId } }),
    prisma.kvkkRequest.findMany({ where: { organizationId: orgId } }),
    prisma.dailyReview.findMany({ where: { organizationId: orgId } }),
    prisma.dailySubmission.findMany({ where: { organizationId: orgId } }),
    // ── v5: İK entegrasyon konfigürasyonu (StaffIntegration.pullCredentialsEncrypted AES-256-GCM
    // şifreli taşınır — restore için gerekli; download yolu stripSensitiveBackupFields ile soyar.
    // IntegrationApiKey yalnız SHA-256 hash taşır, düz anahtar hiç DB'ye yazılmaz.) ──
    prisma.staffIntegration.findMany({ where: { organizationId: orgId } }),
    prisma.integrationApiKey.findMany({ where: { organizationId: orgId } }),
    // auth.users — parola hash'leri (encrypted_password) SADECE burada. Restore'da public.users'tan
    // ÖNCE INSERT ... ON CONFLICT (id) DO NOTHING ile geri yüklenir. includeAuthUsers=false ise hiç çekilmez.
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
    // v4 kapsam
    mediaAssets,
    trainingCategories,
    trainingPeriods,
    scormAttempts,
    trainingFeedbackForms,
    trainingFeedbackCategories,
    trainingFeedbackItems,
    trainingFeedbackResponses,
    trainingFeedbackAnswers,
    smgPeriods,
    smgCategories,
    smgActivities,
    smgTargets,
    accreditationStandards,
    accreditationReports,
    departmentTrainingRules,
    questionBanks,
    questionBankOptions,
    competencyForms,
    competencyCategories,
    competencyItems,
    competencyEvaluations,
    competencyAnswers,
    examAttemptRequests,
    kvkkRequests,
    dailyReviews,
    dailySubmissions,
    // v5 — İK entegrasyon konfigürasyonu
    staffIntegrations,
    integrationApiKeys,
    // authUsers yalnız includeAuthUsers=true iken eklenir — aksi halde anahtar hiç çıkmaz.
    ...(authUsers ? { authUsers } : {}),
    exportedAt: (options.exportedAt ?? new Date()).toISOString(),
    organizationId: orgId,
    ...(options.organizationName ? { organizationName: options.organizationName } : {}),
    schemaVersion: BACKUP_SCHEMA_VERSION,
  }
}
