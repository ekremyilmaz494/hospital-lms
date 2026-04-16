import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  try {
    const now = new Date()

    const [certificates, trainingsWithoutRenewal] = await Promise.all([
      prisma.certificate.findMany({
        where: { training: { organizationId: orgId } },
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
          training: { select: { id: true, title: true, category: true } },
          attempt: { select: { postExamScore: true, attemptNumber: true, preExamScore: true } },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.training.findMany({
        where: { organizationId: orgId, renewalPeriodMonths: null, isActive: true },
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
          },
          score: c.attempt.postExamScore ? Number(c.attempt.postExamScore) : 0,
          attemptNumber: c.attempt.attemptNumber,
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
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  const { userId, trainingId, attemptId, expiresAt } = body
  if (!userId || !trainingId || !attemptId) {
    return errorResponse('userId, trainingId ve attemptId zorunludur')
  }

  if (expiresAt && new Date(expiresAt) < new Date()) {
    return errorResponse('Sertifika son kullanma tarihi geçmişte olamaz', 400)
  }

  const organizationId = dbUser!.organizationId!

  try {
    const [targetUser, targetTraining] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, organizationId } }),
      prisma.training.findFirst({ where: { id: trainingId, organizationId } }),
    ])
    if (!targetUser || !targetTraining) {
      return errorResponse('Geçersiz kullanıcı veya eğitim', 403)
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, training: { organizationId } },
    })
    if (!attempt) return errorResponse('Sınav denemesi bulunamadı', 404)

    const code = `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    let cert
    try {
      cert = await prisma.certificate.create({
        data: {
          userId,
          trainingId,
          attemptId,
          certificateCode: code,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      })
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
        return errorResponse('Bu deneme için zaten sertifika mevcut', 409)
      }
      throw e
    }

    await createAuditLog({
      userId: dbUser!.id,
      organizationId,
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
}
