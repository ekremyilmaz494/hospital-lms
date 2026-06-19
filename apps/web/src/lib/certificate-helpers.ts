import { randomBytes } from 'crypto'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { certificateIssuedEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

/**
 * Kanonik sertifika kodu üreticisi — tek kaynak.
 *
 * 16 byte kriptografik rastgelelik → 128-bit entropi (`CERT-` + 32 hex char, uppercase).
 * Hem otomatik (sınav geçişi) hem manuel (admin POST) sertifika üretimi BU fonksiyonu çağırır.
 * `Math.random()` ASLA kullanılmaz — CSPRNG değildir, public doğrulama endpoint'inde tahmin
 * edilebilir kod sızdırır.
 */
export function generateCertificateCode(): string {
  return `CERT-${randomBytes(16).toString('hex').toUpperCase()}`
}

/**
 * EY.FR.40 — Sertifika üretimini idempotent şekilde yapan tek nokta.
 *
 * Tek çağrı noktası: /api/exam/[id]/submit — post-exam başarısı sonrası her eğitimde.
 * Feedback formu cert üretiminden bağımsız — form gösterilir ama cert'i engellemez.
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
  /**
   * Attempt'in bağlı olduğu atamanın periodId'si. Dönem bazlı sertifika raporları
   * için zorunlu; null geçilirse sertifika döneme bağlanmaz. Caller bunu
   * `assignment.periodId` üzerinden taşır.
   */
  periodId: string | null
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

  const code = generateCertificateCode()
  const expiresAt = input.renewalPeriodMonths ? addMonths(new Date(), input.renewalPeriodMonths) : null

  try {
    await prisma.certificate.create({
      data: {
        userId: input.userId,
        trainingId: input.trainingId,
        attemptId: input.attemptId,
        organizationId: input.organizationId,
        periodId: input.periodId,
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
