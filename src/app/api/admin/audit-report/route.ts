import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/types/database'

/**
 * GET /api/admin/audit-report
 * Akreditasyon/denetim hazırlık PDF raporu verisi.
 * Sağlık Bakanlığı ve JCI denetimleri için tasarlanmıştır.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  try {
    const now = new Date()

    const [organization, staff, trainings, certificates] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, code: true, address: true, phone: true, email: true },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
        include: {
          assignments: {
            include: {
              training: { select: { title: true, category: true, isCompulsory: true, regulatoryBody: true } },
              examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, isPassed: true, postExamCompletedAt: true } },
            },
          },
          departmentRel: { select: { name: true } },
        },
        orderBy: [{ lastName: 'asc' }],
      }),
      prisma.training.findMany({
        where: { organizationId: orgId },
        select: {
          id: true, title: true, category: true, isCompulsory: true, regulatoryBody: true,
          complianceDeadline: true, renewalPeriodMonths: true,
          _count: { select: { assignments: true } },
          assignments: { select: { status: true } },
        },
      }),
      prisma.certificate.findMany({
        where: { training: { organizationId: orgId } },
        include: {
          user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
          training: { select: { title: true, isCompulsory: true } },
        },
        orderBy: { issuedAt: 'desc' },
      }),
    ])

    // Genel istatistikler
    const totalStaff = staff.length
    const totalAssignments = staff.flatMap(s => s.assignments).length
    const totalPassed = staff.flatMap(s => s.assignments).filter(a => a.status === 'passed').length
    const overallCompletionRate = totalAssignments > 0 ? Math.round((totalPassed / totalAssignments) * 100) : 0

    // Zorunlu eğitim uyum özeti
    const compulsoryTrainings = trainings.filter(t => t.isCompulsory)
    const compulsoryCompliance = compulsoryTrainings.map(t => {
      const passed = t.assignments.filter(a => a.status === 'passed').length
      const total = t.assignments.length
      return {
        title: t.title,
        regulatoryBody: t.regulatoryBody ?? '',
        complianceDeadline: t.complianceDeadline?.toISOString() ?? null,
        totalAssigned: total,
        passed,
        rate: total > 0 ? Math.round((passed / total) * 100) : 0,
        status: total > 0 && passed === total ? 'compliant' : total > 0 && passed / total >= 0.8 ? 'partial' : 'non-compliant',
      }
    })

    // Personel uyum durumu
    const staffCompliance = staff.map(s => {
      const compulsoryAssignments = s.assignments.filter(a => a.training.isCompulsory)
      const passedCompulsory = compulsoryAssignments.filter(a => a.status === 'passed').length
      return {
        name: `${s.firstName} ${s.lastName}`,
        title: s.title ?? '',
        department: s.departmentRel?.name ?? '',
        totalAssigned: s.assignments.length,
        totalPassed: s.assignments.filter(a => a.status === 'passed').length,
        compulsoryTotal: compulsoryAssignments.length,
        compulsoryPassed: passedCompulsory,
        complianceRate: compulsoryAssignments.length > 0 ? Math.round((passedCompulsory / compulsoryAssignments.length) * 100) : 100,
      }
    })

    // Sertifika özeti
    const activeCerts = certificates.filter(c => !c.expiresAt || new Date(c.expiresAt) > now)
    const expiredCerts = certificates.filter(c => c.expiresAt && new Date(c.expiresAt) <= now)
    const expiringSoon = certificates.filter(c => c.expiresAt && new Date(c.expiresAt) > now && new Date(c.expiresAt) <= new Date(now.getTime() + 30 * 86400000))

    const reportData = {
      generatedAt: now.toISOString(),
      organization,
      summary: {
        totalStaff,
        totalAssignments,
        totalPassed,
        overallCompletionRate,
        compulsoryTrainingCount: compulsoryTrainings.length,
        fullyCompliantCount: compulsoryCompliance.filter(c => c.status === 'compliant').length,
        activeCertificates: activeCerts.length,
        expiredCertificates: expiredCerts.length,
        expiringSoonCertificates: expiringSoon.length,
      },
      compulsoryCompliance,
      staffCompliance,
      certificates: {
        active: activeCerts.slice(0, 50).map(c => ({
          staff: `${c.user.firstName} ${c.user.lastName}`,
          department: c.user.departmentRel?.name ?? '',
          training: c.training.title,
          issuedAt: c.issuedAt.toISOString(),
          expiresAt: c.expiresAt?.toISOString() ?? null,
          isCompulsory: c.training.isCompulsory,
        })),
        expiringSoon: expiringSoon.slice(0, 20).map(c => ({
          staff: `${c.user.firstName} ${c.user.lastName}`,
          training: c.training.title,
          expiresAt: c.expiresAt!.toISOString(),
          daysLeft: Math.ceil((new Date(c.expiresAt!).getTime() - now.getTime()) / 86400000),
        })),
      },
    }

    return NextResponse.json(reportData, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } })
  } catch (err) {
    logger.error('AuditReport', 'Denetim raporu alınamadı', err)
    return errorResponse('Denetim raporu alınamadı', 503)
  }
}
