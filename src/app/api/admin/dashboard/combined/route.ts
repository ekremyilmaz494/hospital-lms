import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { AssignmentStatus } from '@/lib/exam-state-machine'
import type { UserRole } from '@/types/database'

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }

// Audit log action → Türkçe etiket. Bilinmeyenler için action'ı okunur hale getir.
const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'giriş yaptı',
  logout: 'çıkış yaptı',
  self_register: 'kendini kaydetti',
  password_changed: 'şifresini değiştirdi',
  'password.changed': 'şifresini değiştirdi',
  profile_update: 'profilini güncelledi',
  'profile.updated': 'profilini güncelledi',
  'training.create.full': 'yeni eğitim oluşturdu',
  'training.update': 'bir eğitimi güncelledi',
  'training.delete': 'bir eğitimi sildi',
  bulk_assign: 'toplu eğitim ataması yaptı',
  send_reminder: 'hatırlatma gönderdi',
  'certificate.created_manual': 'manuel sertifika oluşturdu',
  'certificate.revoked': 'bir sertifikayı iptal etti',
  'certificate.restored': 'bir sertifikayı yeniden aktif etti',
  certificate_download: 'sertifika indirdi',
  'report.export': 'rapor dışa aktardı',
  'data.export': 'veri dışa aktardı',
  'standalone_exam.create': 'bağımsız sınav oluşturdu',
  'standalone_exam.export': 'bağımsız sınav sonuçlarını dışa aktardı',
  'feedback.submitted': 'geri bildirim gönderdi',
  'feedback_form.updated': 'geri bildirim formunu güncelledi',
  reset_attempt: 'sınav denemesini sıfırladı',
  scorm_upload: 'SCORM paketi yükledi',
  scorm_certificate_created: 'SCORM sertifikası oluşturdu',
  'department.members.add': 'departmana üye ekledi',
  'department.members.remove': 'departmandan üye çıkardı',
  duplicate: 'kopyaladı',
  create: 'oluşturdu',
  delete: 'sildi',
  accreditation_report_generated: 'akreditasyon raporu oluşturdu',
  accreditation_action_plan_created: 'akreditasyon aksiyon planı oluşturdu',
  'invoice.sent': 'fatura gönderdi',
  'payment.checkout.start': 'ödeme başlattı',
  question_bank_import: 'soru bankası içe aktardı',
  'question_bank.import': 'soru bankası içe aktardı',
  ai_generation_start: 'AI içerik üretimi başlattı',
  ai_generation_save_to_library: 'AI içeriği kütüphaneye kaydetti',
  restore_preview: 'yedek önizlemesi yaptı',
  restore_executed: 'yedekten geri yükledi',
}

function translateAuditAction(raw: string): string {
  const direct = AUDIT_ACTION_LABELS[raw]
  if (direct) return direct
  // Fallback: snake_case/dot.notation → "işlem gerçekleştirdi" yerine anlaşılır etiket
  const normalized = raw.replace(/[._]/g, ' ')
  return `"${normalized}" işlemi gerçekleştirdi`
}

async function fetchStats(orgId: string) {
  const cacheKey = `dashboard:stats:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return cached

  // Archived/inactive training'ler dashboard sayımlarından dışarı
  const trainingScope = { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } }

  const [staffCount, activeStaffCount, publishedTrainingCount, activeTrainingCount, statusCounts, compulsoryTrainings, overdueCount] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true } }),
    // "Toplam yayındaki" — draft hariç, archived hariç, active
    prisma.training.count({ where: { ...trainingScope, publishStatus: 'published' } }),
    prisma.training.count({ where: trainingScope }),
    prisma.trainingAssignment.groupBy({ by: ['status'], where: { training: trainingScope }, _count: true }),
    prisma.training.findMany({
      where: { ...trainingScope, isCompulsory: true },
      select: { id: true, title: true, complianceDeadline: true, regulatoryBody: true, assignments: { select: { status: true } } },
    }),
    // Geciken eğitim: süresi dolmuş, henüz tamamlanmamış. Failed = tamamlandı (kaldı), overdue değil.
    prisma.trainingAssignment.count({
      where: {
        training: { ...trainingScope, endDate: { lt: new Date() } },
        status: { notIn: ['passed', 'failed'] },
      },
    }),
  ])

  const now = new Date()
  const statusMap = new Map(statusCounts.map(s => [s.status, s._count]))
  const completedCount = statusMap.get('passed') ?? 0
  const failedCount = statusMap.get('failed') ?? 0
  const inProgressCount = statusMap.get('in_progress') ?? 0
  const totalAssignments = statusCounts.reduce((sum, s) => sum + s._count, 0)
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0

  const compulsoryAssignments = compulsoryTrainings.flatMap(t => t.assignments)
  const compulsoryCompleted = compulsoryAssignments.filter(a => a.status === 'passed').length
  // Hiç zorunlu eğitim ataması yoksa "—" göster (yanıltıcı %100 yerine)
  const hasCompliance = compulsoryAssignments.length > 0
  const complianceRate = hasCompliance ? Math.round((compulsoryCompleted / compulsoryAssignments.length) * 100) : 0
  const complianceValue: number | string = hasCompliance ? `%${complianceRate}` : '—'

  const complianceAlerts = compulsoryTrainings
    .filter(t => t.complianceDeadline && new Date(t.complianceDeadline) > now)
    .map(t => {
      const daysLeft = Math.ceil((new Date(t.complianceDeadline!).getTime() - now.getTime()) / 86400000)
      const totalAssigned = t.assignments.length
      const passed = t.assignments.filter((a: { status: string }) => a.status === 'passed').length
      return {
        training: t.title, regulatoryBody: t.regulatoryBody ?? '', daysLeft,
        complianceRate: totalAssigned > 0 ? Math.round((passed / totalAssigned) * 100) : 0,
        status: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5)

  const statusDistribution = [
    { name: 'Tamamlanan', value: completedCount, color: 'var(--color-success)' },
    { name: 'Devam Eden', value: inProgressCount, color: 'var(--color-info)' },
    { name: 'Basarisiz', value: failedCount, color: 'var(--color-error)' },
    { name: 'Bekleyen', value: totalAssignments - completedCount - inProgressCount - failedCount, color: 'var(--color-warning)' },
  ]

  const data = {
    stats: [
      { title: 'Toplam Personel', value: staffCount, icon: 'Users', accentColor: 'var(--color-primary)', trend: { value: activeStaffCount, label: 'aktif', isPositive: true } },
      { title: 'Aktif Egitim', value: activeTrainingCount, icon: 'GraduationCap', accentColor: 'var(--color-info)', trend: { value: publishedTrainingCount, label: 'yayında', isPositive: true } },
      { title: 'Tamamlanma Orani', value: `%${completionRate}`, icon: 'TrendingUp', accentColor: 'var(--color-success)', trend: { value: completedCount, label: 'tamamlanan', isPositive: true } },
      { title: 'Geciken Egitim', value: overdueCount, icon: 'AlertTriangle', accentColor: 'var(--color-error)', trend: { value: failedCount, label: 'basarisiz', isPositive: false } },
      { title: 'Uyum Orani', value: complianceValue, icon: 'ShieldCheck', accentColor: !hasCompliance ? 'var(--color-text-muted)' : complianceRate >= 80 ? 'var(--color-success)' : complianceRate >= 60 ? 'var(--color-warning)' : 'var(--color-error)', trend: { value: compulsoryTrainings.length, label: 'zorunlu egitim', isPositive: complianceRate >= 80 } },
    ],
    complianceAlerts,
    statusDistribution,
  }

  await setCached(cacheKey, data, 300)
  return data
}

async function fetchCharts(orgId: string) {
  const cacheKey = `dashboard:charts:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return cached

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const trainingScope = { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } }

  const [trendRaw, deptAssignments] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { training: trainingScope, assignedAt: { gte: sixMonthsAgo } },
      select: { status: true, assignedAt: true },
    }),
    prisma.trainingAssignment.findMany({
      where: { training: trainingScope },
      select: {
        status: true,
        user: { select: { departmentRel: { select: { name: true } } } },
        examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, preExamScore: true } },
      },
      take: 500,
    }),
  ])

  const trendMap = new Map<string, { atanan: number; tamamlanan: number; basarisiz: number; month: string }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    trendMap.set(`${d.getFullYear()}-${d.getMonth()}`, { atanan: 0, tamamlanan: 0, basarisiz: 0, month: d.toLocaleDateString('tr-TR', { month: 'short' }) })
  }
  for (const a of trendRaw) {
    const d = new Date(a.assignedAt)
    const entry = trendMap.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (!entry) continue
    entry.atanan++
    if (a.status === 'passed') entry.tamamlanan++
    if (a.status === 'failed') entry.basarisiz++
  }

  const deptMap = new Map<string, { total: number; completed: number; scores: number[] }>()
  for (const a of deptAssignments) {
    const dept = a.user.departmentRel?.name ?? 'Diger'
    const existing = deptMap.get(dept) ?? { total: 0, completed: 0, scores: [] }
    existing.total++
    if (a.status === 'passed') {
      existing.completed++
      existing.scores.push(Number(a.examAttempts[0]?.postExamScore ?? a.examAttempts[0]?.preExamScore ?? 0))
    }
    deptMap.set(dept, existing)
  }

  const data = {
    trendData: Array.from(trendMap.values()),
    departmentComparison: Array.from(deptMap.entries()).map(([dept, d]) => ({
      dept,
      oran: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
      puan: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
    })),
  }

  await setCached(cacheKey, data, 300)
  return data
}

async function fetchCompliance(orgId: string) {
  const cacheKey = `dashboard:compliance:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return cached

  const now = new Date()
  const overdueAssignments = await prisma.trainingAssignment.findMany({
    where: { status: { not: 'passed' }, training: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' }, endDate: { lt: now } } },
    include: {
      user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
      training: { select: { title: true, endDate: true } },
    },
    orderBy: { training: { endDate: 'desc' } },
    take: 5,
  })

  const data = {
    overdueTrainings: overdueAssignments.map(a => ({
      assignmentId: a.id, trainingId: a.trainingId,
      name: `${a.user.firstName} ${a.user.lastName}`,
      dept: a.user.departmentRel?.name ?? '',
      training: a.training.title,
      dueDate: new Date(a.training.endDate).toISOString().split('T')[0],
      daysOverdue: Math.floor((now.getTime() - new Date(a.training.endDate).getTime()) / 86400000),
      color: 'var(--color-error)',
    })),
  }

  await setCached(cacheKey, data, 180)
  return data
}

async function fetchActivity(orgId: string) {
  const cacheKey = `dashboard:activity:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return cached

  const [topPerformerData, recentLogs] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { status: 'passed' satisfies AssignmentStatus, training: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
        examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, preExamScore: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const performerMap = new Map<string, { name: string; department: string; scores: number[]; courses: number; initials: string }>()
  for (const a of topPerformerData) {
    // status='passed' olduğundan postExamScore olmalı — yoksa skoru sayma, ama course count'ı artır
    const rawScore = a.examAttempts[0]?.postExamScore
    const score = rawScore != null ? Number(rawScore) : null
    const existing = performerMap.get(a.userId)
    if (existing) {
      if (score != null) existing.scores.push(score)
      existing.courses++
    } else {
      const fn = a.user.firstName ?? '', ln = a.user.lastName ?? ''
      performerMap.set(a.userId, {
        name: `${fn} ${ln}`,
        department: a.user.departmentRel?.name ?? '',
        scores: score != null ? [score] : [],
        courses: 1,
        initials: `${fn[0] ?? ''}${ln[0] ?? ''}`.toUpperCase(),
      })
    }
  }

  const data = {
    topPerformers: Array.from(performerMap.values())
      .filter(p => p.scores.length > 0)
      .map(p => ({ ...p, score: Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length), color: 'var(--color-primary)' }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4),
    recentActivity: recentLogs.map(log => ({
      action: translateAuditAction(log.action),
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistem',
      time: log.createdAt.toISOString(),
      type: log.action.includes('delete') || log.action.includes('revoke') ? 'error'
        : log.action.includes('create') || log.action.includes('passed') ? 'success'
        : log.action.includes('fail') ? 'warning'
        : 'info',
    })),
  }

  await setCached(cacheKey, data, 300)
  return data
}

async function fetchCerts(orgId: string) {
  const cacheKey = `dashboard:certs:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return cached

  const now = new Date()
  const sixtyDays = new Date(now.getTime() + 60 * 86400000)

  const expiringCertsData = await prisma.certificate.findMany({
    where: {
      training: { organizationId: orgId },
      expiresAt: { gte: now, lte: sixtyDays },
      revokedAt: null, // iptal edilmiş sertifikalar "yaklaşıyor" listesinde çıkmasın
    },
    include: { user: { select: { firstName: true, lastName: true } }, training: { select: { title: true } } },
    orderBy: { expiresAt: 'asc' },
    take: 10,
  })

  const data = {
    expiringCerts: expiringCertsData.map(c => {
      const daysLeft = Math.ceil((new Date(c.expiresAt!).getTime() - now.getTime()) / 86400000)
      return {
        name: `${c.user.firstName} ${c.user.lastName}`,
        cert: c.training.title,
        expiryDate: new Date(c.expiresAt!).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        daysLeft,
        status: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
      }
    }),
  }

  await setCached(cacheKey, data, 300)
  return data
}

export const GET = withAdminRoute(async ({ organizationId: orgId }) => {
  // Her section bağımsız — biri hata verse diğerleri çalışır
  const [stats, charts, compliance, activity, certs] = await Promise.all([
    fetchStats(orgId).catch(err => { logger.error('Dashboard Combined', 'Stats hatası', err); return null }),
    fetchCharts(orgId).catch(err => { logger.error('Dashboard Combined', 'Charts hatası', err); return null }),
    fetchCompliance(orgId).catch(err => { logger.error('Dashboard Combined', 'Compliance hatası', err); return null }),
    fetchActivity(orgId).catch(err => { logger.error('Dashboard Combined', 'Activity hatası', err); return null }),
    fetchCerts(orgId).catch(err => { logger.error('Dashboard Combined', 'Certs hatası', err); return null }),
  ])

  return jsonResponse({ stats, charts, compliance, activity, certs }, 200, CACHE_HEADERS)
}, { requireOrganization: true })
