import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/types/database'
import { orgStaffWhereByDept } from '@/lib/org-scope'
import type { ResolvedFilters } from './_shared'

/**
 * Rapor dışa aktarma veri katmanı — TEK kaynak.
 *
 * Hem admin per-hastane export'u (`admin/reports/export/route.ts`) hem grup konsolide
 * export'u (`group/reports/export/route.ts`) buradan geçer → "her sheet'in rakamı ilgili
 * hastanenin kendi export'uyla eşleşir" garantisi (drift yok).
 *
 * `fetchReportData(filters)` ham veriyi çeker (org-scope + tarih/dönem/departman filtreleri);
 * `buildReportRows(data)` bunu tablo satırlarına + özet KPI'lara dönüştürür (saf transform).
 */

// Vercel serverless RAM guard — 5000 eğitim + 5000 personel güvenli üst sınır.
export const REPORT_TRAINING_CAP = 5000
export const REPORT_STAFF_CAP = 5000

/**
 * Rapor için ham veriyi çeker. Ekrandaki sekmelerle AYNI popülasyon: tarih + dönem birlikte,
 * aktif eğitim scope'u, departman subtree. Bu sayede export sayıları ekrandakiyle birebir tutar.
 */
export async function fetchReportData(filters: ResolvedFilters) {
  const { orgId, trainingScope, userDeptFilter, assignmentDateFilter, assignmentPeriodFilter, attemptDateFilter, attemptPeriodFilter, departmentId } = filters

  const assignmentWhere = { ...assignmentDateFilter, ...assignmentPeriodFilter }
  const activeTrainingFilter = { isActive: true, publishStatus: { not: 'archived' } as const }

  const [org, staffCount, totalTrainings, totalStaff, trainings, staff, departments, avgScoreResult] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, logoUrl: true } }),
    prisma.user.count({ where: orgStaffWhereByDept(orgId, userDeptFilter, { isActive: true }) }), // ortak personel: ekranla tutar
    prisma.training.count({ where: trainingScope }),
    prisma.user.count({ where: orgStaffWhereByDept(orgId, userDeptFilter) }), // cap göstergesi — staff findMany ile aynı where
    prisma.training.findMany({
      where: trainingScope,
      select: {
        id: true,
        title: true,
        examDurationMinutes: true,
        assignments: {
          where: { user: { ...userDeptFilter }, ...assignmentWhere },
          select: {
            status: true,
            user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
            examAttempts: {
              orderBy: { attemptNumber: 'desc' },
              take: 1,
              select: {
                postExamScore: true,
                preExamScore: true,
                isPassed: true,
                status: true,
                attemptNumber: true,
              },
            },
          },
        },
        videos: { select: { durationSeconds: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: REPORT_TRAINING_CAP,
    }),
    prisma.user.findMany({
      where: orgStaffWhereByDept(orgId, userDeptFilter), // ortak personel: export listesi ekran raporuyla tutar
      select: {
        firstName: true,
        lastName: true,
        assignments: {
          // TENANT: staff kanalize edildiğinden (ortak doktor primary=A) nested atamalar org-filtreli olmalı —
          // aksi halde A'nın (veya dışa-üyelikli B kullanıcının başka org) atamaları export'a sızar (denorm+indexli).
          where: { organizationId: orgId, ...assignmentWhere, training: activeTrainingFilter },
          select: {
            status: true,
            training: { select: { title: true } },
            examAttempts: {
              orderBy: { attemptNumber: 'desc' },
              take: 1,
              select: { postExamScore: true, isPassed: true, status: true, attemptNumber: true },
            },
          },
        },
        departmentRel: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: REPORT_STAFF_CAP,
    }),
    prisma.department.findMany({
      where: { organizationId: orgId, ...(departmentId ? { id: departmentId } : {}) },
      select: {
        name: true,
        users: {
          where: { role: 'staff' satisfies UserRole, isActive: true, ...userDeptFilter },
          select: {
            assignments: {
              // TENANT: dışa-üyelikli (primary=B ama başka org'da da üyelikli) kullanıcının diğer-org
              // atamaları B departman raporuna sızmasın — org-filtreli (denorm+indexli organizationId).
              where: { organizationId: orgId, ...assignmentWhere, training: activeTrainingFilter },
              select: {
                status: true,
                examAttempts: {
                  orderBy: { attemptNumber: 'desc' },
                  take: 1,
                  select: { postExamScore: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.examAttempt.aggregate({
      where: { training: trainingScope, postExamScore: { not: null }, user: { ...userDeptFilter }, ...attemptDateFilter, ...attemptPeriodFilter },
      _avg: { postExamScore: true },
    }),
  ])

  const truncated = {
    trainings: totalTrainings > REPORT_TRAINING_CAP ? { shown: trainings.length, total: totalTrainings } : null,
    staff: totalStaff > REPORT_STAFF_CAP ? { shown: staff.length, total: totalStaff } : null,
  }

  // Seçili departman adı (etiket için) — departmentId verildiğinde liste tek dept döner.
  const selectedDeptName = departmentId ? (departments[0]?.name ?? null) : null

  return { org, staffCount, trainings, staff, departments, avgScoreResult, truncated, selectedDeptName }
}

export type ReportData = Awaited<ReturnType<typeof fetchReportData>>

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/**
 * Ham veriyi rapor tablosu satırlarına + özet KPI'lara dönüştürür. Saf (DB'ye gitmez).
 * Admin export'u section'a göre bunlardan bir alt kümeyi kullanır; grup export'u
 * özet + eğitim/personel satırlarını her hastane için kullanır.
 */
export function buildReportRows(data: ReportData) {
  const { staffCount, trainings, staff, departments, avgScoreResult } = data

  const allAssignments = trainings.flatMap(t => t.assignments)
  const totalAssigned = allAssignments.length
  const passedCount = allAssignments.filter(a => a.status === 'passed').length
  const failedCount = allAssignments.filter(a => a.status === 'failed').length
  const avgScore = avgScoreResult._avg.postExamScore ? Math.round(Number(avgScoreResult._avg.postExamScore)) : 0
  const completionRate = totalAssigned > 0 ? Math.round((passedCount / totalAssigned) * 100) : 0

  const trainingRows = trainings.map(t => {
    const scores = t.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
    const assigned = t.assignments.length
    const completed = t.assignments.filter(a => a.status === 'passed').length
    const failed = t.assignments.filter(a => a.status === 'failed').length
    const avgTrainingScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0
    return { title: t.title, assigned, completed, failed, avgScore: avgTrainingScore, rate }
  })

  const staffRows = staff.map(s => {
    const completed = s.assignments.filter(a => a.status === 'passed').length
    const failed = s.assignments.filter(a => a.status === 'failed').length
    const scores = s.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(sc => sc != null).map(Number)
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const status = avg >= 80 ? 'Yıldız' : avg >= 50 ? 'Normal' : s.assignments.length > 0 ? 'Risk' : 'Yeni'
    return {
      name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
      dept: s.departmentRel?.name ?? '-',
      totalAssigned: s.assignments.length,
      completed,
      failed,
      avgScore: avg,
      status,
    }
  }).sort((a, b) => b.avgScore - a.avgScore)

  const deptRows = departments.map(d => {
    const allDeptAssignments = d.users.flatMap(u => u.assignments)
    const passed = allDeptAssignments.filter(a => a.status === 'passed').length
    const failed = allDeptAssignments.filter(a => a.status === 'failed').length
    const rate = allDeptAssignments.length > 0 ? Math.round((passed / allDeptAssignments.length) * 100) : 0
    const scores = allDeptAssignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
    const avgDept = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    return { name: d.name, personel: d.users.length, totalAssigned: allDeptAssignments.length, passed, failed, rate, avgScore: avgDept }
  }).sort((a, b) => b.rate - a.rate)

  // Ekrandaki Başarısızlık sekmesiyle aynı popülasyon: failed + locked.
  const failureRows = staff.flatMap(s =>
    s.assignments
      .filter(a => a.status === 'failed' || a.status === 'locked')
      .map(a => ({
        name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        dept: s.departmentRel?.name ?? '-',
        training: a.training?.title ?? '-',
        attempts: a.examAttempts[0]?.attemptNumber ?? 0,
        lastScore: a.examAttempts[0]?.postExamScore ? Number(a.examAttempts[0].postExamScore) : 0,
      })),
  ).sort((a, b) => b.attempts - a.attempts)

  const scoreComparison = trainings.map(t => {
    const preScores = t.assignments.map(a => a.examAttempts[0]?.preExamScore).filter(s => s != null).map(Number)
    const postScores = t.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
    const pre = preScores.length > 0 ? Math.round(preScores.reduce((a, b) => a + b, 0) / preScores.length) : 0
    const post = postScores.length > 0 ? Math.round(postScores.reduce((a, b) => a + b, 0) / postScores.length) : 0
    return { title: t.title, preScore: pre, postScore: post, improvement: post - pre, sampleSize: postScores.length }
  }).filter(d => d.sampleSize > 0)
    .sort((a, b) => b.improvement - a.improvement)

  const durationRows = trainings.map(t => {
    const videoSec = t.videos.reduce((sum, v) => sum + v.durationSeconds, 0)
    const videoMin = Math.round(videoSec / 60)
    const examMin = t.examDurationMinutes ?? 30
    return { title: t.title, videoMin, examMin, totalMin: videoMin + examMin }
  }).sort((a, b) => b.totalMin - a.totalMin)

  return {
    staffCount,
    totalAssigned,
    passedCount,
    failedCount,
    avgScore,
    completionRate,
    trainingRows,
    staffRows,
    deptRows,
    failureRows,
    scoreComparison,
    durationRows,
  }
}

export type ReportRows = ReturnType<typeof buildReportRows>

export { truncate }
