import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/staff/[id]/export
 * KVKK / GDPR Art.20 — tek bir personelin tüm verisini (profil + eğitim atamaları +
 * sınav denemeleri + sertifikalar + denetim izi) taşınabilir JSON olarak indirir.
 * org-scoped: başka kurumun personeli export edilemez. İşlem audit'lenir.
 */
export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const { id } = params
  if (!UUID_RE.test(id)) return errorResponse('Geçersiz personel kimliği', 400)

  const user = await prisma.user.findFirst({
    where: { id, organizationId },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      title: true, role: true, isActive: true, createdAt: true,
    },
  })
  if (!user) return errorResponse('Personel bulunamadı', 404)

  const [assignments, attempts, certificates, auditLogs] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { userId: id, organizationId },
      select: { id: true, trainingId: true, status: true, currentAttempt: true, maxAttempts: true, assignedAt: true, completedAt: true, dueDate: true, round: true },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.examAttempt.findMany({
      where: { userId: id, organizationId },
      select: { id: true, trainingId: true, attemptNumber: true, preExamScore: true, postExamScore: true, isPassed: true, status: true, createdAt: true, postExamCompletedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.certificate.findMany({
      where: { userId: id, organizationId },
      select: { id: true, trainingId: true, certificateCode: true, issuedAt: true, expiresAt: true, revokedAt: true },
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { userId: id, organizationId },
      select: { id: true, action: true, entityType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  ])

  await audit({ action: 'kvkk.data_export', entityType: 'user', entityId: id })

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    assignments,
    attempts: attempts.map((a) => ({
      ...a,
      preExamScore: a.preExamScore != null ? Number(a.preExamScore) : null,
      postExamScore: a.postExamScore != null ? Number(a.postExamScore) : null,
    })),
    certificates,
    auditLogs,
  }

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="kvkk-export-${id}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}, { requireOrganization: true })
