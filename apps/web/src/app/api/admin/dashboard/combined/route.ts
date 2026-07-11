import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { findActivePeriod } from '@/lib/training-periods'
import { fetchOrgKpis } from '@/lib/dashboard/aggregations'
import type { UserRole } from '@/types/database'

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }

/**
 * GET /api/admin/dashboard/combined
 *
 * Dashboard'un tüm verisini tek HTTP isteğinde döner: stats, charts, compliance,
 * activity, certs. Her section bağımsız (.catch null) — biri patlasa diğerleri
 * render olur. Section başına ayrı Redis cache key (180-300s TTL).
 *
 * Cache key'leri `invalidateDashboardCache(orgId)` ile temizlenir; ilgili
 * mutation route'ları (training/staff/exam-submit/...) bu helper'ı çağırır.
 *
 * Aktif training period varsa atama agregasyonları o döneme scope'lanır;
 * yoksa scope açık kalır (geri uyumluluk).
 */

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
  const normalized = raw.replace(/[._]/g, ' ')
  return `"${normalized}" işlemi gerçekleştirdi`
}

async function fetchStats(orgId: string) {
  const cacheKey = `dashboard:stats:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return cached

  // Çekirdek KPI'lar TEK kaynaktan (lib/dashboard/aggregations) — grup konsolide paneli
  // aynı fonksiyonu hastaneler arası kullanır, rakamlar birebir tutarlı kalır.
  const k = await fetchOrgKpis(orgId)

  const data = {
    stats: [
      { title: 'Toplam Personel', value: k.staffCount, icon: 'Users', accentColor: 'var(--color-primary)', trend: { value: k.activeStaffCount, label: 'aktif', isPositive: true, suffix: '' } },
      { title: 'Aktif Eğitim', value: k.activeTrainingCount, icon: 'GraduationCap', accentColor: 'var(--color-info)', trend: { value: k.publishedTrainingCount, label: 'yayında', isPositive: true, suffix: '' } },
      { title: 'Tamamlanma Oranı', value: `%${k.completionRate}`, icon: 'TrendingUp', accentColor: 'var(--color-success)', trend: { value: k.completedCount, label: 'tamamlanan', isPositive: true, suffix: '' } },
      { title: 'Geciken Eğitim', value: k.overdueCount, icon: 'AlertTriangle', accentColor: 'var(--color-error)', trend: { value: k.failedCount, label: 'başarısız', isPositive: false, suffix: '' } },
      { title: 'Uyum Oranı', value: k.hasCompliance ? `%${k.complianceRate}` : '—', icon: 'ShieldCheck', accentColor: !k.hasCompliance ? 'var(--color-text-muted)' : k.complianceRate >= 80 ? 'var(--color-success)' : k.complianceRate >= 60 ? 'var(--color-warning)' : 'var(--color-error)', trend: { value: k.compulsoryTrainingCount, label: 'zorunlu eğitim', isPositive: k.complianceRate >= 80, suffix: '' } },
    ],
    complianceAlerts: k.complianceAlerts,
    statusDistribution: k.statusDistribution,
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

  const activePeriod = await findActivePeriod(orgId)
  const periodFilter: Record<string, unknown> = activePeriod ? { periodId: activePeriod.id } : {}

  // P1 §2.8 — Trend grafiği: "atanan" assignedAt'a göre, "tamamlanan/başarısız" completedAt'a göre.
  // Eski mantıkta passed olan kayıt assignedAt ayına sayılıyordu → 1 Mart'ta atanıp 5 Nisan'da
  // tamamlanan bir eğitim Mart'a 1 tamamlandı olarak görünüyordu (yanıltıcı).
  //
  // P0 §2.2 — Departman karşılaştırması: groupBy(['userId','status']) ile tam sayım +
  // examAttempt postExamScore üzerinden user-başına AVG. Memory'de N×M scan yok; take limiti yok.
  const [assignedRaw, completedRaw, users, statusByUser, userScoreAggs] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { training: trainingScope, assignedAt: { gte: sixMonthsAgo }, ...periodFilter },
      select: { assignedAt: true },
    }),
    prisma.trainingAssignment.findMany({
      where: {
        training: trainingScope,
        completedAt: { gte: sixMonthsAgo },
        status: { in: ['passed', 'failed'] },
        ...periodFilter,
      },
      select: { status: true, completedAt: true },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
      select: { id: true, departmentRel: { select: { name: true } } },
    }),
    prisma.trainingAssignment.groupBy({
      by: ['userId', 'status'],
      where: { training: trainingScope, ...periodFilter },
      _count: true,
    }),
    prisma.examAttempt.groupBy({
      by: ['userId'],
      where: {
        training: trainingScope,
        isPassed: true,
        ...(activePeriod ? { assignment: { periodId: activePeriod.id } } : {}),
      },
      _avg: { postExamScore: true },
    }),
  ])

  const trendMap = new Map<string, { atanan: number; tamamlanan: number; basarisiz: number; month: string }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    trendMap.set(`${d.getFullYear()}-${d.getMonth()}`, { atanan: 0, tamamlanan: 0, basarisiz: 0, month: d.toLocaleDateString('tr-TR', { month: 'short' }) })
  }
  for (const a of assignedRaw) {
    const d = new Date(a.assignedAt)
    const entry = trendMap.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (entry) entry.atanan++
  }
  for (const a of completedRaw) {
    if (!a.completedAt) continue
    const d = new Date(a.completedAt)
    const entry = trendMap.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (!entry) continue
    if (a.status === 'passed') entry.tamamlanan++
    else if (a.status === 'failed') entry.basarisiz++
  }

  const userDeptMap = new Map(users.map(u => [u.id, u.departmentRel?.name ?? 'Diğer']))
  const deptMap = new Map<string, { total: number; completed: number }>()
  for (const row of statusByUser) {
    const dept = userDeptMap.get(row.userId)
    if (!dept) continue
    const existing = deptMap.get(dept) ?? { total: 0, completed: 0 }
    existing.total += row._count
    if (row.status === 'passed') existing.completed += row._count
    deptMap.set(dept, existing)
  }

  const deptScores = new Map<string, { sum: number; n: number }>()
  for (const row of userScoreAggs) {
    const dept = userDeptMap.get(row.userId)
    if (!dept) continue
    const avg = Number(row._avg.postExamScore ?? 0)
    if (!avg) continue
    const existing = deptScores.get(dept) ?? { sum: 0, n: 0 }
    existing.sum += avg
    existing.n += 1
    deptScores.set(dept, existing)
  }

  const data = {
    trendData: Array.from(trendMap.values()),
    departmentComparison: Array.from(deptMap.entries()).map(([dept, d]) => {
      const scoreAgg = deptScores.get(dept)
      return {
        dept,
        oran: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        puan: scoreAgg && scoreAgg.n > 0 ? Math.round(scoreAgg.sum / scoreAgg.n) : 0,
      }
    }),
  }

  await setCached(cacheKey, data, 300)
  return data
}

async function fetchCompliance(orgId: string) {
  const cacheKey = `dashboard:compliance:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return cached

  const now = new Date()
  const activePeriod = await findActivePeriod(orgId)
  const periodFilter = activePeriod ? { periodId: activePeriod.id } : {}
  // P0 §2.1 — "Geciken" tanımı stats ile aynı: failed (kaldı) overdue değil; sadece henüz
  // tamamlanmamış (passed/failed dışı) ve süresi dolmuş atamalar listelenir.
  const overdueAssignments = await prisma.trainingAssignment.findMany({
    where: {
      ...periodFilter,
      status: { notIn: ['passed', 'failed'] },
      training: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' }, endDate: { lt: now } },
    },
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

  const activePeriod = await findActivePeriod(orgId)

  // P0 §2.3 — "En Başarılı Personel" tüm passed atamalardan AVG(score), top 4.
  // Eski mantık `take: 20` son tamamlamalardan top 4 alıyordu → tutarsız "en başarılı".
  // Raw SQL: user başına AVG(postExamScore), tüm zaman (period scope'lu), top 4.
  const periodIdLiteral = activePeriod?.id ?? null
  const [topPerformersRaw, recentLogs] = await Promise.all([
    prisma.$queryRaw<Array<{ user_id: string; first_name: string | null; last_name: string | null; dept_name: string | null; avg_score: number | null; course_count: bigint }>>`
      SELECT
        u.id AS user_id,
        u.first_name,
        u.last_name,
        d.name AS dept_name,
        AVG(latest.post_exam_score)::float AS avg_score,
        COUNT(DISTINCT ta.id)::bigint AS course_count
      FROM training_assignments ta
      INNER JOIN trainings t ON t.id = ta.training_id
      INNER JOIN users u ON u.id = ta.user_id
      LEFT JOIN departments d ON d.id = u.department_id
      INNER JOIN LATERAL (
        SELECT ea.post_exam_score
        FROM exam_attempts ea
        WHERE ea.assignment_id = ta.id AND ea.post_exam_score IS NOT NULL
        ORDER BY ea.attempt_number DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE t.organization_id = ${orgId}
        AND t.is_active = true
        AND t.publish_status != 'archived'
        AND ta.status = 'passed'
        AND (${periodIdLiteral}::text IS NULL OR ta.period_id = ${periodIdLiteral}::uuid)
      GROUP BY u.id, u.first_name, u.last_name, d.name
      HAVING AVG(latest.post_exam_score) IS NOT NULL
      ORDER BY avg_score DESC NULLS LAST
      LIMIT 4
    `,
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const data = {
    topPerformers: topPerformersRaw.map(p => {
      const fn = p.first_name ?? ''
      const ln = p.last_name ?? ''
      return {
        name: `${fn} ${ln}`.trim(),
        department: p.dept_name ?? '',
        score: p.avg_score != null ? Math.round(p.avg_score) : 0,
        courses: Number(p.course_count),
        initials: `${fn[0] ?? ''}${ln[0] ?? ''}`.toUpperCase(),
        color: 'var(--color-primary)',
      }
    }),
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

  // P1 §2.10 — Arşivlenmiş/pasif eğitimlerin sertifikaları "yaklaşıyor" listesinde çıkmasın.
  const expiringCertsData = await prisma.certificate.findMany({
    where: {
      training: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } },
      expiresAt: { gte: now, lte: sixtyDays },
      revokedAt: null,
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
