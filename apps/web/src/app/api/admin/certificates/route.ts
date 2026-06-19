import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { generateCertificateCode } from '@/lib/certificate-helpers'

/** Manuel sertifika oluşturma — body doğrulaması (CLAUDE.md: tüm input zod ile). */
const issueCertSchema = z.object({
  userId: z.string().uuid('Geçersiz kullanıcı'),
  trainingId: z.string().uuid('Geçersiz eğitim'),
  attemptId: z.string().uuid('Geçersiz sınav denemesi'),
  // ISO datetime veya null (süresiz). Geçmiş tarih kontrolü handler'da yapılır.
  expiresAt: z.union([z.string().datetime({ message: 'Geçersiz tarih formatı' }), z.null()]).optional(),
})

export const GET = withAdminRoute(async ({ organizationId }) => {
  try {
    const now = new Date()

    const [certificates, trainingsWithoutRenewal] = await Promise.all([
      prisma.certificate.findMany({
        where: { training: { organizationId } },
        select: {
          id: true,
          certificateCode: true,
          issuedAt: true,
          expiresAt: true,
          revokedAt: true,
          revocationReason: true,
          trainingId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              title: true,
              departmentRel: { select: { name: true } },
            },
          },
          training: { select: { id: true, title: true, category: true, isActive: true, publishStatus: true } },
          attempt: { select: { postExamScore: true, attemptNumber: true, preExamScore: true } },
          // D1b — saf SCORM sertifikalarında ExamAttempt yok; skor ScormAttempt'ten gelir.
          scormAttempt: { select: { score: true } },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.training.findMany({
        where: { organizationId, renewalPeriodMonths: null, isActive: true },
        select: { id: true, title: true },
      }),
    ])

    const totalCerts = certificates.length
    const activeCerts = certificates.filter(c => !c.revokedAt && (!c.expiresAt || c.expiresAt >= now)).length
    const expiredCerts = certificates.filter(c => !c.revokedAt && c.expiresAt && c.expiresAt < now).length
    const revokedCerts = certificates.filter(c => !!c.revokedAt).length
    const expiringSoon = certificates.filter(c => {
      if (c.revokedAt || !c.expiresAt) return false
      const daysLeft = (c.expiresAt.getTime() - now.getTime()) / 86400000
      return daysLeft > 0 && daysLeft <= 30
    }).length

    const trainingCountMap = new Map<string, number>()
    for (const c of certificates) {
      trainingCountMap.set(c.trainingId, (trainingCountMap.get(c.trainingId) ?? 0) + 1)
    }
    const trainings = [
      ...new Map(
        certificates.map(c => [
          c.trainingId,
          {
            id: c.training.id,
            title: c.training.title,
            category: c.training.category ?? '',
            count: trainingCountMap.get(c.trainingId) ?? 0,
          },
        ]),
      ).values(),
    ]

    const categorySet = new Set<string>()
    for (const c of certificates) {
      if (c.training.category) categorySet.add(c.training.category)
    }
    const categories = [...categorySet].sort((a, b) => a.localeCompare(b, 'tr'))

    return jsonResponse(
      {
        certificates: certificates.map(c => ({
          id: c.id,
          certificateCode: c.certificateCode,
          issuedAt: c.issuedAt.toISOString(),
          expiresAt: c.expiresAt?.toISOString() ?? null,
          isExpired: !c.revokedAt && !!c.expiresAt && c.expiresAt < now,
          isRevoked: !!c.revokedAt,
          revokedAt: c.revokedAt?.toISOString() ?? null,
          revocationReason: c.revocationReason ?? null,
          user: {
            id: c.user.id,
            name: `${c.user.firstName} ${c.user.lastName}`,
            email: c.user.email,
            department: c.user.departmentRel?.name ?? '',
            title: c.user.title ?? '',
            initials: `${c.user.firstName[0] ?? ''}${c.user.lastName[0] ?? ''}`.toUpperCase(),
          },
          training: {
            id: c.training.id,
            title: c.training.title,
            category: c.training.category ?? '',
            isArchived: !c.training.isActive || c.training.publishStatus === 'archived',
          },
          // attempt (sınavlı) yoksa saf SCORM → skoru ScormAttempt'ten al.
          score: c.attempt ? (c.attempt.postExamScore ? Number(c.attempt.postExamScore) : 0) : (c.scormAttempt?.score ?? 0),
          attemptNumber: c.attempt?.attemptNumber ?? 1,
        })),
        stats: { totalCerts, activeCerts, expiredCerts, revokedCerts, expiringSoon },
        trainings,
        categories,
        trainingsWithoutRenewal,
      },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('Admin Certificates', 'Sertifikalar yüklenemedi', err)
    return errorResponse('Sertifikalar yüklenemedi', 503)
  }
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi', 400)

  const parsed = issueCertSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Doğrulama hatası', 400)
  }
  const { userId, trainingId, attemptId, expiresAt } = parsed.data

  if (expiresAt && new Date(expiresAt) < new Date()) {
    return errorResponse('Sertifika son kullanma tarihi geçmişte olamaz', 400)
  }

  try {
    const [targetUser, targetTraining] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, organizationId } }),
      prisma.training.findFirst({ where: { id: trainingId, organizationId } }),
    ])
    if (!targetUser || !targetTraining) {
      return errorResponse('Geçersiz kullanıcı veya eğitim', 403)
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, organizationId },
      select: {
        id: true,
        userId: true,
        trainingId: true,
        isPassed: true,
        assignment: { select: { periodId: true } },
      },
    })
    if (!attempt) return errorResponse('Sınav denemesi bulunamadı', 404)

    // Defansif tutarlılık: payload'taki userId/trainingId attempt ile eşleşmeli,
    // attempt başarılı olmalı. Aksi halde admin yanlış sertifika basabilir veya
    // başkasının attempt'i üzerinden hedef kullanıcıya sertifika atfedilebilir.
    if (attempt.userId !== userId) {
      return errorResponse('Sınav denemesi seçili kullanıcıya ait değil', 400)
    }
    if (attempt.trainingId !== trainingId) {
      return errorResponse('Sınav denemesi seçili eğitime ait değil', 400)
    }
    if (!attempt.isPassed) {
      return errorResponse('Bu deneme başarılı değil — manuel sertifika oluşturulamaz', 409)
    }

    // Kanonik kriptografik kod üreticisi (otomatik üretimle aynı kaynak) — Math.random() YOK.
    const code = generateCertificateCode()

    let cert
    try {
      cert = await prisma.certificate.create({
        data: {
          userId,
          trainingId,
          attemptId,
          certificateCode: code,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          // Tenant + dönem izolasyonu — rapor/agregasyon sorguları için zorunlu
          organizationId,
          periodId: attempt.assignment?.periodId ?? null,
        },
      })
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
        return errorResponse('Bu deneme için zaten sertifika mevcut', 409)
      }
      throw e
    }

    await audit({
      action: 'certificate.created_manual',
      entityType: 'certificate',
      entityId: cert.id,
      newData: { userId, trainingId },
    })

    return jsonResponse(cert, 201)
  } catch (err) {
    logger.error('Admin Certificates', 'Sertifika oluşturulamadı', err)
    return errorResponse('Sertifika oluşturulamadı', 500)
  }
}, { requireOrganization: true })
