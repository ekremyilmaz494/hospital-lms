import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const trainingId = searchParams.get('trainingId')
  const status = searchParams.get('status') // active | expired | all

  try {
    const now = new Date()

    const certificates = await prisma.certificate.findMany({
      where: {
        training: { organizationId: orgId },
        ...(trainingId && { trainingId }),
        ...(search && {
          OR: [
            { certificateCode: { contains: search, mode: 'insensitive' as const } },
            { user: { firstName: { contains: search, mode: 'insensitive' as const } } },
            { user: { lastName: { contains: search, mode: 'insensitive' as const } } },
            { user: { email: { contains: search, mode: 'insensitive' as const } } },
          ],
        }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, department: true, title: true } },
        training: { select: { id: true, title: true, category: true } },
        attempt: { select: { postExamScore: true, attemptNumber: true, preExamScore: true } },
      },
      orderBy: { issuedAt: 'desc' },
    })

    // Filter by status after fetch (expired check needs JS)
    const filtered = certificates.filter(c => {
      if (status === 'expired') return c.expiresAt && new Date(c.expiresAt) < now
      if (status === 'active') return !c.expiresAt || new Date(c.expiresAt) >= now
      return true
    })

    // Stats
    const totalCerts = certificates.length
    const activeCerts = certificates.filter(c => !c.expiresAt || new Date(c.expiresAt) >= now).length
    const expiredCerts = certificates.filter(c => c.expiresAt && new Date(c.expiresAt) < now).length
    const expiringSoon = certificates.filter(c => {
      if (!c.expiresAt) return false
      const exp = new Date(c.expiresAt)
      const daysLeft = (exp.getTime() - now.getTime()) / 86400000
      return daysLeft > 0 && daysLeft <= 30
    }).length

    // Unique trainings for filter dropdown
    const trainings = [...new Map(certificates.map(c => [c.trainingId, { id: c.training.id, title: c.training.title }])).values()]

    return jsonResponse({
      certificates: filtered.map(c => ({
        id: c.id,
        certificateCode: c.certificateCode,
        issuedAt: c.issuedAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString() ?? null,
        isExpired: c.expiresAt ? new Date(c.expiresAt) < now : false,
        user: {
          id: c.user.id,
          name: `${c.user.firstName} ${c.user.lastName}`,
          email: c.user.email,
          department: c.user.department ?? '',
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
      stats: { totalCerts, activeCerts, expiredCerts, expiringSoon },
      trainings,
    })
  } catch (err) {
    logger.error('Admin Certificates', 'Sertifikalar yüklenemedi', err)
    return errorResponse('Sertifikalar yüklenemedi', 503)
  }
}

// POST — Manuel sertifika oluştur
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

  const organizationId = dbUser!.organizationId!

  try {
    // Cross-tenant validation
    const [targetUser, targetTraining] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, organizationId } }),
      prisma.training.findFirst({ where: { id: trainingId, organizationId } }),
    ])
    if (!targetUser || !targetTraining) {
      return errorResponse('Geçersiz kullanıcı veya eğitim', 403)
    }

    // Verify attempt belongs to org
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, training: { organizationId } },
    })
    if (!attempt) return errorResponse('Sınav denemesi bulunamadı', 404)

    // Check if certificate already exists for this attempt
    const existing = await prisma.certificate.findUnique({ where: { attemptId } })
    if (existing) return errorResponse('Bu deneme için zaten sertifika mevcut', 409)

    const code = `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const cert = await prisma.certificate.create({
      data: {
        userId,
        trainingId,
        attemptId,
        certificateCode: code,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

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
