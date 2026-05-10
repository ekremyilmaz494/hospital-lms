import { randomBytes } from 'crypto'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { certificateIssuedEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

/**
 * EY.FR.40 — Sertifika üretimini idempotent şekilde yapan tek nokta.
 *
 * İki çağrı yerinden tetiklenir:
 *   1) /api/exam/[id]/submit — feedbackMandatory=false eğitimlerde post-exam başarısı sonrası
 *   2) /api/feedback/submit  — feedbackMandatory=true eğitimlerde feedback verildikten sonra
 *
 * `Certificate.attemptId` unique → DB seviyesinde de race-safe; existingCert check
 * normal koşulda yeterli, paralel istek olursa P2002 yutulur.
 *
 * Email gönderimi fire-and-forget — sertifika kaydı atılır, mail başarısızlığı akışı bozmaz.
 */
export async function issueCertificateForAttempt(input: {
  attemptId: string
  userId: string
  trainingId: string
  organizationId: string
  trainingTitle: string
  renewalPeriodMonths: number | null
  recipientEmail: string
  recipientFullName: string
}): Promise<{ created: boolean; code?: string }> {
  const existing = await prisma.certificate.findUnique({
    where: { attemptId: input.attemptId },
    select: { id: true },
  })
  if (existing) return { created: false }

  const code = `CERT-${randomBytes(16).toString('hex').toUpperCase()}`
  const expiresAt = input.renewalPeriodMonths ? addMonths(new Date(), input.renewalPeriodMonths) : null

  try {
    await prisma.certificate.create({
      data: {
        userId: input.userId,
        trainingId: input.trainingId,
        attemptId: input.attemptId,
        organizationId: input.organizationId,
        certificateCode: code,
        expiresAt,
      },
    })
  } catch (err) {
    // Paralel çağrı yarışı — diğeri zaten oluşturmuş.
    if ((err as { code?: string })?.code === 'P2002') return { created: false }
    throw err
  }

  certificateIssuedEmail(input.recipientEmail, input.recipientFullName, input.trainingTitle, code).catch(
    e => logger.warn('CertEmail', 'Sertifika emaili gonderilemedi', (e as Error).message),
  )

  return { created: true, code }
}
