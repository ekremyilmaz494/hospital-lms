import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  assertRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
  ApiError,
} from '@/lib/api-helpers'
import { downloadBuffer } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'

/** Expected shape of a backup JSON file (mirrors backup cron output) */
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
  organizationName: string
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
  if (typeof d.organizationName !== 'string') return false

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
    const { dbUser, error } = await getAuthUser()
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

    // ── Parse JSON ──
    let backupData: BackupData
    try {
      const jsonString = rawBuffer.toString('utf-8')
      const parsed: unknown = JSON.parse(jsonString)
      if (!isValidBackupData(parsed)) {
        return errorResponse('Yedek dosyasının yapısı geçersiz veya bozuk.', 400)
      }
      backupData = parsed
    } catch {
      return errorResponse('Yedek dosyası JSON olarak ayrıştırılamadı.', 400)
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

      // Trainings with nested videos and questions
      for (const trn of backupData.trainings) {
        const t = trn as Record<string, unknown>
        const videos = (t.videos ?? []) as Record<string, unknown>[]
        const questions = (t.questions ?? []) as Record<string, unknown>[]

        // Create training without nested relations
        const { videos: _v, questions: _q, ...trainingData } = t
        await tx.training.create({
          data: trainingData as Parameters<typeof tx.training.create>[0]['data'],
        })

        // Insert videos
        for (const video of videos) {
          await tx.trainingVideo.create({
            data: video as Parameters<typeof tx.trainingVideo.create>[0]['data'],
          })
        }

        // Insert questions and options
        for (const question of questions) {
          const opts = ((question as Record<string, unknown>).options ?? []) as Record<string, unknown>[]
          const { options: _opts, ...questionData } = question as Record<string, unknown>
          await tx.question.create({
            data: questionData as Parameters<typeof tx.question.create>[0]['data'],
          })
          for (const opt of opts) {
            await tx.questionOption.create({
              data: opt as Parameters<typeof tx.questionOption.create>[0]['data'],
            })
          }
        }
      }

      // Assignments
      for (const a of backupData.assignments) {
        await tx.trainingAssignment.create({
          data: a as Parameters<typeof tx.trainingAssignment.create>[0]['data'],
        })
      }

      // Attempts
      for (const a of backupData.attempts) {
        await tx.examAttempt.create({
          data: a as Parameters<typeof tx.examAttempt.create>[0]['data'],
        })
      }

      // Exam answers
      for (const a of backupData.examAnswers) {
        await tx.examAnswer.create({
          data: a as Parameters<typeof tx.examAnswer.create>[0]['data'],
        })
      }

      // Video progress
      for (const vp of backupData.videoProgress) {
        await tx.videoProgress.create({
          data: vp as Parameters<typeof tx.videoProgress.create>[0]['data'],
        })
      }

      // Notifications
      for (const n of backupData.notifications) {
        await tx.notification.create({
          data: n as Parameters<typeof tx.notification.create>[0]['data'],
        })
      }

      // Certificates
      for (const c of backupData.certificates) {
        await tx.certificate.create({
          data: c as Parameters<typeof tx.certificate.create>[0]['data'],
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
