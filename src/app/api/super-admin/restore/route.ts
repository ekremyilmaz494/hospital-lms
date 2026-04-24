import { prisma } from '@/lib/prisma'
import {
  getAuthUserStrict,
  assertRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
  ApiError,
} from '@/lib/api-helpers'
import { downloadBuffer } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { decryptBackup } from '@/lib/backup-crypto'

// Vercel Pro max: 300s. Restore tx timeout 120s, buna ek olarak S3 download + parse süresi var.
export const maxDuration = 300

/**
 * Expected shape of a backup JSON file (mirrors backup cron output).
 * schemaVersion 1: v1 (9 arrays). schemaVersion 2+: organization, subscription, auditLogs eklendi.
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
  schemaVersion?: number
}

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
export async function POST(request: Request) {
  try {
    // ── Auth ──
    const { dbUser, error } = await getAuthUserStrict()
    if (error) return error
    assertRole(dbUser!.role, ['super_admin'])

    // ── Parse body ──
    const body = await parseBody<RestoreRequestBody>(request)
    if (!body || !body.backupId || typeof body.confirm !== 'boolean') {
      return errorResponse('Geçersiz istek gövdesi. backupId (string) ve confirm (boolean) gereklidir.', 400)
    }

    const { backupId, confirm } = body

    // ── Rate limit (1 actual restore per hour) ──
    if (confirm) {
      const allowed = await checkRateLimit(`restore:${dbUser!.id}`, 1, 3600)
      if (!allowed) {
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
      console.error('[Restore] S3 download failed:', msg)
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
      backupData = parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      console.error('[Restore] Decrypt/parse failed:', msg)
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
      hasOrganization: backupData.organization ? 1 : 0,
      hasSubscription: backupData.subscription ? 1 : 0,
    }

    // ── Preview mode ──
    if (!confirm) {
      await createAuditLog({
        userId: dbUser!.id,
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
      // Delete existing data in dependency order (children first)
      // AuditLog'ları sil — restore edilecekler ile çakışmamalı
      if (backupData.auditLogs && backupData.auditLogs.length > 0) {
        await tx.auditLog.deleteMany({ where: { organizationId: orgId } })
      }
      await tx.certificate.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.videoProgress.deleteMany({ where: { attempt: { training: { organizationId: orgId } } } })
      await tx.examAnswer.deleteMany({ where: { attempt: { training: { organizationId: orgId } } } })
      await tx.examAttempt.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.trainingAssignment.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.notification.deleteMany({ where: { organizationId: orgId } })

      // Delete training children then trainings (children first: options → questions → videos)
      await tx.questionOption.deleteMany({ where: { question: { training: { organizationId: orgId } } } })
      await tx.question.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.trainingVideo.deleteMany({ where: { training: { organizationId: orgId } } })
      await tx.training.deleteMany({ where: { organizationId: orgId } })

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

      // Departments
      if (backupData.departments.length > 0) {
        for (const dept of backupData.departments) {
          const d = dept as Record<string, unknown>
          await tx.department.upsert({
            where: { id: d.id as string },
            create: d as Parameters<typeof tx.department.create>[0]['data'],
            update: d as Parameters<typeof tx.department.update>[0]['data'],
          })
        }
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

      // Trainings + nested children. Parent per-row (nested relation sayısı değişken),
      // çocuklar `createMany` ile toplu insert. Tek-satır yerine N-satır round-trip.
      const allVideos: Record<string, unknown>[] = []
      const allQuestions: Record<string, unknown>[] = []
      const allOptions: Record<string, unknown>[] = []

      for (const trn of backupData.trainings) {
        const t = trn as Record<string, unknown>
        const videos = (t.videos ?? []) as Record<string, unknown>[]
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
    }, { timeout: 120_000 }) // 2 minute timeout for large restores

    // ── Audit log ──
    await createAuditLog({
      userId: dbUser!.id,
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

    console.error('[Restore] Unexpected error:', err instanceof Error ? err.message : err)
    return errorResponse('Geri yükleme sırasında beklenmeyen bir hata oluştu.', 500)
  }
}
