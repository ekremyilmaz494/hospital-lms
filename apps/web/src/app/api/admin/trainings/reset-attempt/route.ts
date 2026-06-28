import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { grantAttempts, AttemptGrantError } from '@/lib/attempt-grants'

export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const body = await parseBody<{ assignmentId: string }>(request)
  if (!body?.assignmentId) return errorResponse('assignmentId zorunludur')
  const assignmentId = body.assignmentId

  const allowed = await checkRateLimit(`reset-attempt:${dbUser.id}`, 30, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  try {
    // Ortak helper: state-machine ile validate (passed/locked terminal reddedilir),
    // maxAttempts'i artır, personele bildir, bekleyen ek-hak talebini de kapat.
    // "Sıfırla" semantiği: `currentAttempt: 0` YAPMA — eski examAttempt satırları
    // (attemptNumber 1..N) dururken start route `newAttemptNumber = currentAttempt+1` → 1
    // üretir ve `@@unique([assignmentId, attemptNumber])` ihlal edilir; start transaction'ı
    // 500 döner, personel sınava HİÇ giremez. Çözüm: mevcut denemenin üstüne taze bir set
    // (orijinal hak kadar) ekle; currentAttempt ve eski geçmiş korunur (denetim/raporlama).
    const result = await prisma.$transaction((tx) =>
      grantAttempts(tx, {
        organizationId,
        reviewerId: dbUser.id,
        target: { assignmentId },
        computeNewMax: (a) => a.currentAttempt + (a.originalMaxAttempts ?? a.maxAttempts ?? 3),
        notify: {
          title: 'Yeni deneme hakkı verildi',
          message: (title) => `"${title}" eğitimi için yeni deneme hakkı tanımlandı.`,
        },
        reconcilePendingRequest: true,
      }),
    )

    await audit({
      action: 'reset_attempt',
      entityType: 'training_assignment',
      entityId: result.assignmentId,
      oldData: { status: result.previousStatus, maxAttempts: result.previousMaxAttempts },
      newData: { status: 'assigned', maxAttempts: result.newMaxAttempts },
    })

    logger.info('Admin Trainings', 'Deneme hakkı yenilendi', {
      assignmentId: result.assignmentId,
      staff: result.userName,
      training: result.trainingTitle,
      newMaxAttempts: result.newMaxAttempts,
    })

    return jsonResponse({
      success: true,
      message: `${result.userName} için yeni deneme hakkı verildi`,
    })
  } catch (err) {
    if (err instanceof AttemptGrantError) {
      return errorResponse(err.message, err.code === 'ASSIGNMENT_NOT_FOUND' ? 404 : 400)
    }
    logger.error('Admin Trainings', 'Deneme hakkı sıfırlama başarısız', err)
    return errorResponse('Deneme hakkı sıfırlanamadı', 500)
  }
}, { requireOrganization: true })
