import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
  parseBody,
  ApiError,
  createAuditLog,
} from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { downloadBuffer } from '@/lib/s3'
import { getRateLimitCount, incrementRateLimit } from '@/lib/redis'
import { decryptBackup } from '@/lib/backup-crypto'
import { logger } from '@/lib/logger'

// Vercel Pro max: 300s. Restore tx timeout 120s, buna ek olarak S3 download + parse süresi var.
export const maxDuration = 300

/**
 * Restore kodunun desteklediği EN YÜKSEK yedek şema sürümü. Daha yeni bir yedek
 * (örn. ileride v4 + ek modeller) bu kodla restore edilirse yeni alanlar SESSİZCE
 * düşerdi → veri kaybı. Guard bunu 400 hatasına çevirir: "önce kodu güncelle".
 * Yeni model eklerken snapshot.ts BACKUP_SCHEMA_VERSION ile birlikte BURAYI da artır.
 */
const MAX_SUPPORTED_SCHEMA_VERSION = 6

/**
 * Expected shape of a backup JSON file (mirrors backup cron output).
 * schemaVersion 1: v1 (9 arrays). v2: organization, subscription, auditLogs eklendi.
 * v3: authUsers (Supabase parola hash'leri). v4: 27 org modeli daha (aşağıdaki v4 bloğu).
 * v5: İK entegrasyon konfigürasyonu (staffIntegrations + integrationApiKeys).
 * v6: OrganizationMembership (ortak personel üyelikleri, çok-hastaneli grup).
 */
interface BackupData {
  users: unknown[]
  departments: unknown[]
  trainings: unknown[]
  assignments: unknown[]
  attempts: unknown[]
  examAnswers: unknown[]
  videoProgress: unknown[]
  notifications: unknown[]
  certificates: unknown[]
  exportedAt: string
  organizationId: string
  organizationName?: string
  // v2+ alanları — v1 yedeklerde yok, undefined geçebilir
  organization?: Record<string, unknown> | null
  subscription?: Record<string, unknown> | null
  auditLogs?: unknown[]
  // v3+ — Supabase auth.users satırları (parola hash'i dahil). Eski yedeklerde yok.
  authUsers?: unknown[]
  // v4+ — kapsam genişlemesi (27 model). Eski yedeklerde undefined → restore dokunmaz (mevcut korunur).
  mediaAssets?: unknown[]
  trainingCategories?: unknown[]
  trainingPeriods?: unknown[]
  scormAttempts?: unknown[]
  trainingFeedbackForms?: unknown[]
  trainingFeedbackCategories?: unknown[]
  trainingFeedbackItems?: unknown[]
  trainingFeedbackResponses?: unknown[]
  trainingFeedbackAnswers?: unknown[]
  smgPeriods?: unknown[]
  smgCategories?: unknown[]
  smgActivities?: unknown[]
  smgTargets?: unknown[]
  accreditationStandards?: unknown[]
  accreditationReports?: unknown[]
  departmentTrainingRules?: unknown[]
  questionBanks?: unknown[]
  questionBankOptions?: unknown[]
  competencyForms?: unknown[]
  competencyCategories?: unknown[]
  competencyItems?: unknown[]
  competencyEvaluations?: unknown[]
  competencyAnswers?: unknown[]
  examAttemptRequests?: unknown[]
  kvkkRequests?: unknown[]
  dailyReviews?: unknown[]
  dailySubmissions?: unknown[]
  // v5+ — İK entegrasyon konfigürasyonu. v4 ve öncesi yedeklerde undefined → restore dokunmaz.
  staffIntegrations?: unknown[]
  integrationApiKeys?: unknown[]
  // v6+ — ortak personel üyelikleri (çok-hastaneli grup). v5 ve öncesi yedeklerde undefined → dokunma.
  organizationMemberships?: unknown[]
  schemaVersion?: number
}

/** v4 opsiyonel model anahtarları — isValidBackupData + counts + delete/insert tek listeden döner. */
const V4_MODEL_KEYS = [
  'mediaAssets', 'trainingCategories', 'trainingPeriods', 'scormAttempts',
  'trainingFeedbackForms', 'trainingFeedbackCategories', 'trainingFeedbackItems',
  'trainingFeedbackResponses', 'trainingFeedbackAnswers',
  'smgPeriods', 'smgCategories', 'smgActivities', 'smgTargets',
  'accreditationStandards', 'accreditationReports', 'departmentTrainingRules',
  'questionBanks', 'questionBankOptions',
  'competencyForms', 'competencyCategories', 'competencyItems', 'competencyEvaluations', 'competencyAnswers',
  'examAttemptRequests', 'kvkkRequests', 'dailyReviews', 'dailySubmissions',
] as const

/** v5 opsiyonel model anahtarları — İK entegrasyon konfigürasyonu (v4 desenini izler). */
const V5_MODEL_KEYS = ['staffIntegrations', 'integrationApiKeys'] as const

/** v6 opsiyonel model anahtarları — ortak personel üyelikleri (çok-hastaneli grup). */
const V6_MODEL_KEYS = ['organizationMemberships'] as const

/** Validate that parsed JSON has the expected backup structure */
function isValidBackupData(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  const requiredArrays = [
    'users',
    'departments',
    'trainings',
    'assignments',
    'attempts',
    'examAnswers',
    'videoProgress',
    'notifications',
    'certificates',
  ]

  for (const key of requiredArrays) {
    if (!Array.isArray(d[key])) return false
  }

  if (typeof d.exportedAt !== 'string') return false
  if (typeof d.organizationId !== 'string') return false

  // v2+ opsiyonel alanlar — varsa tip kontrol
  if (d.auditLogs !== undefined && !Array.isArray(d.auditLogs)) return false
  if (d.authUsers !== undefined && !Array.isArray(d.authUsers)) return false
  // v4/v5/v6 opsiyonel modeller — varsa array olmalı
  for (const key of [...V4_MODEL_KEYS, ...V5_MODEL_KEYS, ...V6_MODEL_KEYS]) {
    if (d[key] !== undefined && !Array.isArray(d[key])) return false
  }

  return true
}

interface RestoreRequestBody {
  backupId: string
  confirm: boolean
}

/**
 * POST /api/super-admin/restore
 *
 * Two-step database restore from S3 backup:
 *   - confirm=false → preview (backup metadata + record counts)
 *   - confirm=true  → execute restore within a transaction
 *
 * Rate limited: 1 restore per hour per user.
 */
export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  try {
    // ── Parse body ──
    const body = await parseBody<RestoreRequestBody>(request)
    if (!body || !body.backupId || typeof body.confirm !== 'boolean') {
      return errorResponse('Geçersiz istek gövdesi. backupId (string) ve confirm (boolean) gereklidir.', 400)
    }

    const { backupId, confirm } = body

    // ── Rate limit (1 actual restore per hour) — yalnız PEEK (tüketmeden oku) ──
    // Budget SADECE başarılı restore'da tüketilir (aşağıda incrementRateLimit). Başarısız
    // bir DR denemesi (S3 hatası, bozuk yedek, tx rollback) operatörü 1 saat KİLİTLEMEMELİ —
    // gerçek felakette tekrar denemek hayati. Eskiden checkRateLimit baştan tüketiyordu.
    const restoreRateKey = `restore:${dbUser.id}`
    if (confirm) {
      const used = await getRateLimitCount(restoreRateKey)
      if (used >= 1) {
        return errorResponse('Saatte yalnızca 1 geri yükleme yapılabilir. Lütfen daha sonra tekrar deneyin.', 429)
      }
    }

    // ── Find backup record ──
    const backup = await prisma.dbBackup.findUnique({ where: { id: backupId } })
    if (!backup) {
      return errorResponse('Yedek kaydı bulunamadı.', 404)
    }
    if (backup.status !== 'completed') {
      return errorResponse('Bu yedek başarıyla tamamlanmamış. Geri yükleme yapılamaz.', 400)
    }
    if (!backup.fileUrl) {
      return errorResponse('Yedek dosyasının S3 anahtarı bulunamadı.', 400)
    }

    // ── Download from S3 ──
    let rawBuffer: Buffer
    try {
      rawBuffer = await downloadBuffer(backup.fileUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      logger.error('Restore', 'S3 download failed', { msg })
      return errorResponse('Yedek dosyası S3\'den indirilemedi.', 500)
    }

    // ── Decrypt + Parse JSON ──
    // Cron/manual backup BACKUP_ENCRYPTION_KEY varsa AES-256-GCM ile şifrelenir.
    // decryptBackup şifrelenmemiş veriyi olduğu gibi döner; şifreli + auth tag
    // başarısız olursa Error atar, bozuk veriyi sessizce geçirmeyiz.
    let backupData: BackupData
    try {
      const rawString = rawBuffer.toString('utf-8')
      const jsonString = decryptBackup(rawString)
      const parsed: unknown = JSON.parse(jsonString)
      if (!isValidBackupData(parsed)) {
        return errorResponse('Yedek dosyasının yapısı geçersiz veya bozuk.', 400)
      }
      // schemaVersion guard: yedek restore kodundan YENİ ise (yeni modeller) restore onları
      // sessizce düşürürdü → veri kaybı. Açık 400 hatasına çevir ("önce kodu güncelle").
      if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > MAX_SUPPORTED_SCHEMA_VERSION) {
        return errorResponse(
          `Bu yedek şema sürümü (v${parsed.schemaVersion}) bu geri yükleme kodundan daha yeni (desteklenen en yüksek: v${MAX_SUPPORTED_SCHEMA_VERSION}). Veri kaybını önlemek için lütfen önce uygulamayı güncelleyin.`,
          400,
        )
      }
      backupData = parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      logger.error('Restore', 'Decrypt/parse failed', { msg })
      return errorResponse('Yedek dosyası çözülemedi veya ayrıştırılamadı (şifreleme anahtarı uyuşmuyor olabilir).', 400)
    }

    // ── Record counts for preview / summary ──
    const counts = {
      users: backupData.users.length,
      departments: backupData.departments.length,
      trainings: backupData.trainings.length,
      assignments: backupData.assignments.length,
      attempts: backupData.attempts.length,
      examAnswers: backupData.examAnswers.length,
      videoProgress: backupData.videoProgress.length,
      notifications: backupData.notifications.length,
      certificates: backupData.certificates.length,
      auditLogs: backupData.auditLogs?.length ?? 0,
      authUsers: backupData.authUsers?.length ?? 0,
      hasOrganization: backupData.organization ? 1 : 0,
      hasSubscription: backupData.subscription ? 1 : 0,
      // v4/v5/v6 modelleri (yedekte yoksa 0)
      ...Object.fromEntries(
        [...V4_MODEL_KEYS, ...V5_MODEL_KEYS, ...V6_MODEL_KEYS].map((k) => [k, (backupData[k] as unknown[] | undefined)?.length ?? 0]),
      ),
    }

    // ── Preview mode ──
    if (!confirm) {
      await createAuditLog({
        userId: dbUser.id,
        organizationId: backup.organizationId,
        action: 'restore_preview',
        entityType: 'DbBackup',
        entityId: backupId,
        newData: { counts, exportedAt: backupData.exportedAt },
        request,
      })

      return jsonResponse({
        preview: true,
        backupId,
        organizationId: backupData.organizationId,
        organizationName: backupData.organizationName,
        exportedAt: backupData.exportedAt,
        fileSizeMb: backup.fileSizeMb,
        counts,
      })
    }

    // ── Confirm mode — execute restore ──
    const orgId = backupData.organizationId

    // Verify the target organization still exists
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } })
    if (!org) {
      return errorResponse('Hedef organizasyon bulunamadı. Geri yükleme iptal edildi.', 400)
    }

    await prisma.$transaction(async (tx) => {
      // ── DELETE: child → parent (Restrict kenarları parent'tan ÖNCE) ──
      // v4 modelleri YALNIZ yedek o modeli taşıyorsa silinir: eski v2/v3 yedekte alan
      // `undefined` → dokunma (mevcut veri korunur). Aksi halde eski yedekten restore,
      // o modelin mevcut verisini siler ama geri yazamazdı → sessiz kayıp.
      if (backupData.auditLogs && backupData.auditLogs.length > 0) {
        await tx.auditLog.deleteMany({ where: { organizationId: orgId } })
      }

      // v4 — Eğitim geri bildirim (answer → response[Restrict→form] → item → category → form)
      if (backupData.trainingFeedbackAnswers) await tx.trainingFeedbackAnswer.deleteMany({ where: { response: { organizationId: orgId } } })
      if (backupData.trainingFeedbackResponses) await tx.trainingFeedbackResponse.deleteMany({ where: { organizationId: orgId } })
      if (backupData.trainingFeedbackItems) await tx.trainingFeedbackItem.deleteMany({ where: { category: { form: { organizationId: orgId } } } })
      if (backupData.trainingFeedbackCategories) await tx.trainingFeedbackCategory.deleteMany({ where: { form: { organizationId: orgId } } })
      if (backupData.trainingFeedbackForms) await tx.trainingFeedbackForm.deleteMany({ where: { organizationId: orgId } })

      // v4 — Yetkinlik (answer → item → evaluation → category → form)
      if (backupData.competencyAnswers) await tx.competencyAnswer.deleteMany({ where: { evaluation: { form: { organizationId: orgId } } } })
      if (backupData.competencyItems) await tx.competencyItem.deleteMany({ where: { category: { form: { organizationId: orgId } } } })
      if (backupData.competencyEvaluations) await tx.competencyEvaluation.deleteMany({ where: { form: { organizationId: orgId } } })
      if (backupData.competencyCategories) await tx.competencyCategory.deleteMany({ where: { form: { organizationId: orgId } } })
      if (backupData.competencyForms) await tx.competencyForm.deleteMany({ where: { organizationId: orgId } })

      // v4 — SMG (activity/target → category/period)
      if (backupData.smgActivities) await tx.smgActivity.deleteMany({ where: { organizationId: orgId } })
      if (backupData.smgTargets) await tx.smgTarget.deleteMany({ where: { organizationId: orgId } })
      if (backupData.smgCategories) await tx.smgCategory.deleteMany({ where: { organizationId: orgId } })
      if (backupData.smgPeriods) await tx.smgPeriod.deleteMany({ where: { organizationId: orgId } })

      // v4 — Akreditasyon (report[Restrict→user] → standard). Report user'dan ÖNCE silinir.
      if (backupData.accreditationReports) await tx.accreditationReport.deleteMany({ where: { organizationId: orgId } })
      if (backupData.accreditationStandards) await tx.accreditationStandard.deleteMany({ where: { organizationId: orgId } })

      // v4 — Soru bankası (option → bank)
      if (backupData.questionBankOptions) await tx.questionBankOption.deleteMany({ where: { question: { organizationId: orgId } } })
      if (backupData.questionBanks) await tx.questionBank.deleteMany({ where: { organizationId: orgId } })

      // v4 — Günlük / diğer org-çocukları
      if (backupData.dailyReviews) await tx.dailyReview.deleteMany({ where: { organizationId: orgId } })
      if (backupData.dailySubmissions) await tx.dailySubmission.deleteMany({ where: { organizationId: orgId } })
      if (backupData.departmentTrainingRules) await tx.departmentTrainingRule.deleteMany({ where: { organizationId: orgId } })
      if (backupData.examAttemptRequests) await tx.examAttemptRequest.deleteMany({ where: { organizationId: orgId } })
      if (backupData.kvkkRequests) await tx.kvkkRequest.deleteMany({ where: { organizationId: orgId } })

      // v5 — İK entegrasyon konfigürasyonu. SyncRun.integrationId/apiKeyId FK'ları SetNull →
      // org'daki mevcut sync_runs satırları (yedekte YOK, kasıtlı: telemetri) silinmez,
      // yalnız referansları NULL'a düşer; FK ihlali oluşmaz.
      if (backupData.staffIntegrations) await tx.staffIntegration.deleteMany({ where: { organizationId: orgId } })
      if (backupData.integrationApiKeys) await tx.integrationApiKey.deleteMany({ where: { organizationId: orgId } })

      // v6 — Ortak personel üyelikleri. User (Cascade) + Department (SetNull) parent'larından
      // ÖNCE sil (user/dept silinmeden temiz kaldır; unique [user,org] re-insert çakışmasını önle).
      if (backupData.organizationMemberships) await tx.organizationMembership.deleteMany({ where: { organizationId: orgId } })

      // ── Mevcut çekirdek (child → parent) ──
      await tx.certificate.deleteMany({ where: { training: { organizationId: orgId } } })
      // ScormAttempt, Certificate'in Restrict parent'ı → certificate'ten SONRA silinir.
      if (backupData.scormAttempts) await tx.scormAttempt.deleteMany({ where: { organizationId: orgId } })
      await tx.videoProgress.deleteMany({ where: { attempt: { training: { organizationId: orgId } } } })
      await tx.examAnswer.deleteMany({ where: { attempt: { training: { organizationId: orgId } } } })
      await tx.examAttempt.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.trainingAssignment.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.notification.deleteMany({ where: { organizationId: orgId } })

      // Delete training children then trainings (children first: options → questions → videos)
      await tx.questionOption.deleteMany({ where: { question: { training: { organizationId: orgId } } } })
      await tx.question.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.trainingVideo.deleteMany({ where: { training: { organizationId: orgId } } })
      // MediaAsset, TrainingVideo'nun parent'ı (mediaAssetId SetNull) → video'lardan SONRA sil.
      if (backupData.mediaAssets) await tx.mediaAsset.deleteMany({ where: { organizationId: orgId } })
      await tx.training.deleteMany({ where: { organizationId: orgId } })
      // TrainingCategory/Period, Training/Assignment/Certificate'in parent'ı → onlardan SONRA sil.
      if (backupData.trainingCategories) await tx.trainingCategory.deleteMany({ where: { organizationId: orgId } })
      if (backupData.trainingPeriods) await tx.trainingPeriod.deleteMany({ where: { organizationId: orgId } })

      await tx.department.deleteMany({ where: { organizationId: orgId } })

      // Don't delete users — upsert them to preserve auth references
      // But delete staff users that no longer exist in backup
      const backupUserIds = backupData.users
        .filter((u): u is { id: string } => typeof u === 'object' && u !== null && 'id' in u)
        .map((u) => u.id)

      if (backupUserIds.length > 0) {
        await tx.user.deleteMany({
          where: {
            organizationId: orgId,
            id: { notIn: backupUserIds },
            role: { not: 'super_admin' },
          },
        })
      }

      // ── Re-insert data ──

      // Organization metadata (v2+). Mevcut kaydı güncelle — id aynı, relation'lar etkilenmez.
      if (backupData.organization) {
        const o = backupData.organization as Record<string, unknown>
        // id ve ilişki alanlarını ayır
        const { id: _id, createdAt: _ca, updatedAt: _ua, ...orgUpdate } = o
        await tx.organization.update({
          where: { id: orgId },
          data: orgUpdate as Parameters<typeof tx.organization.update>[0]['data'],
        })
      }

      // Subscription (v2+). Plan'a referans verir — planId'nin hâlâ mevcut olması beklenir.
      if (backupData.subscription) {
        const s = backupData.subscription as Record<string, unknown>
        await tx.organizationSubscription.upsert({
          where: { organizationId: orgId },
          create: s as Parameters<typeof tx.organizationSubscription.create>[0]['data'],
          update: s as Parameters<typeof tx.organizationSubscription.update>[0]['data'],
        })
      }

      // Departments — self-FK (parentId). İKİ GEÇİŞ: önce parentId=null ile hepsini ekle,
      // sonra parentId'leri set et. Aksi halde alt-departman parent'ından önce gelirse
      // FK ihlali tüm restore'u rollback eder (tek-geçiş upsert sırası garanti değil).
      if (backupData.departments.length > 0) {
        const deptParents: Array<{ id: string; parentId: string }> = []
        for (const dept of backupData.departments) {
          const d = dept as Record<string, unknown>
          if (d.parentId) deptParents.push({ id: d.id as string, parentId: d.parentId as string })
          const createData = { ...d, parentId: null }
          await tx.department.upsert({
            where: { id: d.id as string },
            create: createData as Parameters<typeof tx.department.create>[0]['data'],
            update: createData as Parameters<typeof tx.department.update>[0]['data'],
          })
        }
        for (const { id, parentId } of deptParents) {
          await tx.department.update({ where: { id }, data: { parentId } })
        }
      }

      // ── v4 Tier-A: yalnız org'a bağlı parent modeller (Training/Assignment/User'dan ÖNCE) ──
      // NOT: TrainingPeriod burada DEĞİL — closedById→User FK'sı var, User'dan SONRA (Tier-B) eklenir.
      if (backupData.trainingCategories?.length) {
        await tx.trainingCategory.createMany({ data: backupData.trainingCategories as NonNullable<Parameters<typeof tx.trainingCategory.createMany>[0]>['data'] })
      }
      if (backupData.smgPeriods?.length) {
        await tx.smgPeriod.createMany({ data: backupData.smgPeriods as NonNullable<Parameters<typeof tx.smgPeriod.createMany>[0]>['data'] })
      }
      if (backupData.smgCategories?.length) {
        await tx.smgCategory.createMany({ data: backupData.smgCategories as NonNullable<Parameters<typeof tx.smgCategory.createMany>[0]>['data'] })
      }
      if (backupData.questionBanks?.length) {
        await tx.questionBank.createMany({ data: backupData.questionBanks as NonNullable<Parameters<typeof tx.questionBank.createMany>[0]>['data'] })
      }
      if (backupData.competencyForms?.length) {
        await tx.competencyForm.createMany({ data: backupData.competencyForms as NonNullable<Parameters<typeof tx.competencyForm.createMany>[0]>['data'] })
      }
      if (backupData.trainingFeedbackForms?.length) {
        await tx.trainingFeedbackForm.createMany({ data: backupData.trainingFeedbackForms as NonNullable<Parameters<typeof tx.trainingFeedbackForm.createMany>[0]>['data'] })
      }
      // v5 — İK entegrasyon konfigürasyonu: yalnız Organization'a bağlı (IntegrationApiKey.createdById
      // FK relation'ı YOK, düz uuid kolonu) → Tier-A'da güvenle eklenir.
      if (backupData.staffIntegrations?.length) {
        await tx.staffIntegration.createMany({ data: backupData.staffIntegrations as NonNullable<Parameters<typeof tx.staffIntegration.createMany>[0]>['data'] })
      }
      if (backupData.integrationApiKeys?.length) {
        await tx.integrationApiKey.createMany({ data: backupData.integrationApiKeys as NonNullable<Parameters<typeof tx.integrationApiKey.createMany>[0]>['data'] })
      }

      // ── auth.users (Supabase parola hash'leri) — public.users'tan ÖNCE geri yükle ──
      // KRİTİK #1: 2026-05-20 incident'inde restore parolaları geri yüklemiyordu →
      // wipe+restore sonrası TÜM personel kilitleniyordu. v3 yedek auth.users'ı taşır.
      //
      // ON CONFLICT (id) DO NOTHING semantiği:
      //  • Tam-wipe DR'de auth.users boş → tüm hash'ler yazılır.
      //  • Kısmi restore'da mevcut canlı parola KORUNUR (clobber yok) — DELETE/UPDATE
      //    zaten supabase-least-privilege.sql ile REVOKE'lu; DO NOTHING tek güvenli yol.
      // jsonb_to_recordset: tek-statement toplu insert (büyük org'da tx marjını korur).
      // raw_*_meta_data jsonb → ::jsonb cast şart (raw SQL; param text gelir).
      // public.users → auth.users arasında DB-seviyesi FK YOK (yerelde doğrulandı) ama
      // kimlik tablosunu önce yazmak DR'de en güvenli sıra.
      if (backupData.authUsers && backupData.authUsers.length > 0) {
        await tx.$executeRaw`
          INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, phone, created_at, updated_at, raw_user_meta_data, raw_app_meta_data)
          SELECT id, email, encrypted_password, email_confirmed_at, phone, created_at, updated_at, raw_user_meta_data, raw_app_meta_data
          FROM jsonb_to_recordset(${JSON.stringify(backupData.authUsers)}::jsonb)
            AS x(id uuid, email text, encrypted_password text, email_confirmed_at timestamptz, phone text,
                 created_at timestamptz, updated_at timestamptz, raw_user_meta_data jsonb, raw_app_meta_data jsonb)
          ON CONFLICT (id) DO NOTHING
        `
      }

      // Users (upsert to handle existing auth users)
      for (const usr of backupData.users) {
        const u = usr as Record<string, unknown>
        await tx.user.upsert({
          where: { id: u.id as string },
          create: u as Parameters<typeof tx.user.create>[0]['data'],
          update: u as Parameters<typeof tx.user.update>[0]['data'],
        })
      }

      // v6 — Ortak personel üyelikleri: User (yukarıda upsert) + Department (yukarıda upsert)
      // gerektirir → ikisinden SONRA. createMany tek round-trip (unique [user,org] yeniden kurulur).
      if (backupData.organizationMemberships?.length) {
        await tx.organizationMembership.createMany({ data: backupData.organizationMemberships as NonNullable<Parameters<typeof tx.organizationMembership.createMany>[0]>['data'] })
      }

      // ── v4 Tier-B: User / Tier-A parent gerektiren modeller (Training'den ÖNCE) ──
      // MediaAsset.fileSizeBytes BigInt — yedekte string; createMany için BigInt'e çevir
      // (TrainingVideo ile aynı). MediaAsset, TrainingVideo.mediaAssetId'nin parent'ı → video'lardan ÖNCE.
      if (backupData.mediaAssets?.length) {
        const assets = (backupData.mediaAssets as Record<string, unknown>[]).map((a) => ({
          ...a,
          fileSizeBytes: a.fileSizeBytes == null ? null : BigInt(a.fileSizeBytes as string | number),
        }))
        await tx.mediaAsset.createMany({ data: assets as NonNullable<Parameters<typeof tx.mediaAsset.createMany>[0]>['data'] })
      }
      // TrainingPeriod — closedById→User FK; User'dan SONRA. Assignment/Certificate'ten ÖNCE.
      if (backupData.trainingPeriods?.length) {
        await tx.trainingPeriod.createMany({ data: backupData.trainingPeriods as NonNullable<Parameters<typeof tx.trainingPeriod.createMany>[0]>['data'] })
      }
      if (backupData.accreditationStandards?.length) {
        await tx.accreditationStandard.createMany({ data: backupData.accreditationStandards as NonNullable<Parameters<typeof tx.accreditationStandard.createMany>[0]>['data'] })
      }
      if (backupData.accreditationReports?.length) {
        await tx.accreditationReport.createMany({ data: backupData.accreditationReports as NonNullable<Parameters<typeof tx.accreditationReport.createMany>[0]>['data'] })
      }
      if (backupData.kvkkRequests?.length) {
        await tx.kvkkRequest.createMany({ data: backupData.kvkkRequests as NonNullable<Parameters<typeof tx.kvkkRequest.createMany>[0]>['data'] })
      }
      if (backupData.dailySubmissions?.length) {
        await tx.dailySubmission.createMany({ data: backupData.dailySubmissions as NonNullable<Parameters<typeof tx.dailySubmission.createMany>[0]>['data'] })
      }
      if (backupData.questionBankOptions?.length) {
        await tx.questionBankOption.createMany({ data: backupData.questionBankOptions as NonNullable<Parameters<typeof tx.questionBankOption.createMany>[0]>['data'] })
      }
      // Feedback: category → item (form Tier-A'da). Response/answer attempt'lerden sonra (aşağıda).
      if (backupData.trainingFeedbackCategories?.length) {
        await tx.trainingFeedbackCategory.createMany({ data: backupData.trainingFeedbackCategories as NonNullable<Parameters<typeof tx.trainingFeedbackCategory.createMany>[0]>['data'] })
      }
      if (backupData.trainingFeedbackItems?.length) {
        await tx.trainingFeedbackItem.createMany({ data: backupData.trainingFeedbackItems as NonNullable<Parameters<typeof tx.trainingFeedbackItem.createMany>[0]>['data'] })
      }
      // Competency: category → item → evaluation → answer (form Tier-A'da).
      if (backupData.competencyCategories?.length) {
        await tx.competencyCategory.createMany({ data: backupData.competencyCategories as NonNullable<Parameters<typeof tx.competencyCategory.createMany>[0]>['data'] })
      }
      if (backupData.competencyItems?.length) {
        await tx.competencyItem.createMany({ data: backupData.competencyItems as NonNullable<Parameters<typeof tx.competencyItem.createMany>[0]>['data'] })
      }
      if (backupData.competencyEvaluations?.length) {
        await tx.competencyEvaluation.createMany({ data: backupData.competencyEvaluations as NonNullable<Parameters<typeof tx.competencyEvaluation.createMany>[0]>['data'] })
      }
      if (backupData.competencyAnswers?.length) {
        await tx.competencyAnswer.createMany({ data: backupData.competencyAnswers as NonNullable<Parameters<typeof tx.competencyAnswer.createMany>[0]>['data'] })
      }
      // SMG: activity (category Tier-A) + target (period Tier-A), ikisi de User gerektirir.
      if (backupData.smgActivities?.length) {
        await tx.smgActivity.createMany({ data: backupData.smgActivities as NonNullable<Parameters<typeof tx.smgActivity.createMany>[0]>['data'] })
      }
      if (backupData.smgTargets?.length) {
        await tx.smgTarget.createMany({ data: backupData.smgTargets as NonNullable<Parameters<typeof tx.smgTarget.createMany>[0]>['data'] })
      }

      // Trainings + nested children. Parent per-row (nested relation sayısı değişken),
      // çocuklar `createMany` ile toplu insert. Tek-satır yerine N-satır round-trip.
      const allVideos: Record<string, unknown>[] = []
      const allQuestions: Record<string, unknown>[] = []
      const allOptions: Record<string, unknown>[] = []

      for (const trn of backupData.trainings) {
        const t = trn as Record<string, unknown>
        // fileSizeBytes (BigInt) yedekte string olarak saklanır (stringifyBackup) —
        // createMany için BigInt'e geri çevir. Eski (null fileSizeBytes) yedekler null kalır.
        const videos = ((t.videos ?? []) as Record<string, unknown>[]).map((v) => ({
          ...v,
          fileSizeBytes: v.fileSizeBytes == null ? null : BigInt(v.fileSizeBytes as string | number),
        }))
        const questions = (t.questions ?? []) as Record<string, unknown>[]
        const { videos: _v, questions: _q, ...trainingData } = t
        await tx.training.create({
          data: trainingData as Parameters<typeof tx.training.create>[0]['data'],
        })
        allVideos.push(...videos)
        for (const q of questions) {
          const opts = ((q.options ?? []) as Record<string, unknown>[])
          const { options: _opts, ...questionData } = q
          allQuestions.push(questionData)
          allOptions.push(...opts)
        }
      }

      // createMany: tek round-trip toplu insert. Büyük kurumlarda transaction
      // timeout marjını ciddi şekilde rahatlatır.
      if (allVideos.length > 0) {
        await tx.trainingVideo.createMany({
          data: allVideos as NonNullable<Parameters<typeof tx.trainingVideo.createMany>[0]>['data'],
        })
      }
      if (allQuestions.length > 0) {
        await tx.question.createMany({
          data: allQuestions as NonNullable<Parameters<typeof tx.question.createMany>[0]>['data'],
        })
      }
      if (allOptions.length > 0) {
        await tx.questionOption.createMany({
          data: allOptions as NonNullable<Parameters<typeof tx.questionOption.createMany>[0]>['data'],
        })
      }

      // v4 — DepartmentTrainingRule: Department + Training gerektirir.
      if (backupData.departmentTrainingRules?.length) {
        await tx.departmentTrainingRule.createMany({ data: backupData.departmentTrainingRules as NonNullable<Parameters<typeof tx.departmentTrainingRule.createMany>[0]>['data'] })
      }

      if (backupData.assignments.length > 0) {
        await tx.trainingAssignment.createMany({
          data: backupData.assignments as NonNullable<Parameters<typeof tx.trainingAssignment.createMany>[0]>['data'],
        })
      }
      if (backupData.attempts.length > 0) {
        await tx.examAttempt.createMany({
          data: backupData.attempts as NonNullable<Parameters<typeof tx.examAttempt.createMany>[0]>['data'],
        })
      }
      // v4 — ScormAttempt: Training + User gerektirir; Certificate'in Restrict parent'ı → certificate'ten ÖNCE.
      if (backupData.scormAttempts?.length) {
        await tx.scormAttempt.createMany({ data: backupData.scormAttempts as NonNullable<Parameters<typeof tx.scormAttempt.createMany>[0]>['data'] })
      }
      if (backupData.examAnswers.length > 0) {
        await tx.examAnswer.createMany({
          data: backupData.examAnswers as NonNullable<Parameters<typeof tx.examAnswer.createMany>[0]>['data'],
        })
      }
      if (backupData.videoProgress.length > 0) {
        await tx.videoProgress.createMany({
          data: backupData.videoProgress as NonNullable<Parameters<typeof tx.videoProgress.createMany>[0]>['data'],
        })
      }

      // v4 — ExamAttemptRequest (Training+User), Feedback yanıtları (response→answer), DailyReview (User+Question).
      if (backupData.examAttemptRequests?.length) {
        await tx.examAttemptRequest.createMany({ data: backupData.examAttemptRequests as NonNullable<Parameters<typeof tx.examAttemptRequest.createMany>[0]>['data'] })
      }
      if (backupData.trainingFeedbackResponses?.length) {
        await tx.trainingFeedbackResponse.createMany({ data: backupData.trainingFeedbackResponses as NonNullable<Parameters<typeof tx.trainingFeedbackResponse.createMany>[0]>['data'] })
      }
      if (backupData.trainingFeedbackAnswers?.length) {
        await tx.trainingFeedbackAnswer.createMany({ data: backupData.trainingFeedbackAnswers as NonNullable<Parameters<typeof tx.trainingFeedbackAnswer.createMany>[0]>['data'] })
      }
      if (backupData.dailyReviews?.length) {
        await tx.dailyReview.createMany({ data: backupData.dailyReviews as NonNullable<Parameters<typeof tx.dailyReview.createMany>[0]>['data'] })
      }

      if (backupData.notifications.length > 0) {
        await tx.notification.createMany({
          data: backupData.notifications as NonNullable<Parameters<typeof tx.notification.createMany>[0]>['data'],
        })
      }
      if (backupData.certificates.length > 0) {
        await tx.certificate.createMany({
          data: backupData.certificates as NonNullable<Parameters<typeof tx.certificate.createMany>[0]>['data'],
        })
      }

      // AuditLog (v2+). Hash zinciri yedekteki sırayı korur; createMany sırayı
      // ekleme sırasıyla korur (Postgres'te aynı batch'te order preserved).
      if (backupData.auditLogs && backupData.auditLogs.length > 0) {
        await tx.auditLog.createMany({
          data: backupData.auditLogs as NonNullable<Parameters<typeof tx.auditLog.createMany>[0]>['data'],
        })
      }
    }, {
      timeout: 120_000, // 2 minute tx body — büyük kurumlarda delete+createMany akışı için
      maxWait: 10_000,  // 10s connection wait — prod'da pool tıkalıysa hızlı patlayıp 503 dön
    })

    // Restore BAŞARIYLA tamamlandı — rate-limit budget'i ŞİMDİ tüket. Başarısız bir denemede
    // (yukarıdaki return/throw yolları) tüketilmedi → operatör felakette tekrar deneyebilir.
    await incrementRateLimit(restoreRateKey, 3600)

    // ── Audit log ──
    await createAuditLog({
      userId: dbUser.id,
      organizationId: orgId,
      action: 'restore_executed',
      entityType: 'DbBackup',
      entityId: backupId,
      newData: {
        counts,
        exportedAt: backupData.exportedAt,
        organizationName: backupData.organizationName,
      },
      request,
    })

    return jsonResponse({
      success: true,
      message: 'Veritabanı geri yükleme başarıyla tamamlandı.',
      backupId,
      organizationId: orgId,
      organizationName: backupData.organizationName,
      exportedAt: backupData.exportedAt,
      counts,
    })
  } catch (err) {
    if (err instanceof ApiError) {
      return err.toResponse()
    }

    logger.error('Restore', 'Unexpected error', err)
    return errorResponse('Geri yükleme sırasında beklenmeyen bir hata oluştu.', 500)
  }
})
