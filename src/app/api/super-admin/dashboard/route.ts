import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { getCached, setCached } from '@/lib/redis'
import type { AssignmentStatus } from '@/lib/exam-state-machine'
import type { UserRole } from '@/types/database'

const CACHE_KEY = 'super-admin:dashboard'
const CACHE_TTL = 300

export async function GET() {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  try {
    const cached = await getCached<Record<string, unknown>>(CACHE_KEY)
    if (cached) return jsonResponse(cached, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })

    const [
      hospitalCount,
      activeHospitalCount,
      totalUsers,
      totalStaff,
      totalTrainings,
      totalAssignments,
      passedAssignments,
      subscriptions,
      recentHospitals,
      recentLogs,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { isActive: true, isSuspended: false } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'staff' satisfies UserRole } }),
      // Platform sayımları: archived/inactive training'ler "aktif değil" — tutarlılık için hariç
      prisma.training.count({ where: { isActive: true, publishStatus: { not: 'archived' } } }),
      prisma.trainingAssignment.count({ where: { training: { isActive: true, publishStatus: { not: 'archived' } } } }),
      prisma.trainingAssignment.count({ where: { status: 'passed' satisfies AssignmentStatus, training: { isActive: true, publishStatus: { not: 'archived' } } } }),
      prisma.organizationSubscription.findMany({
        include: { plan: { select: { name: true } }, organization: { select: { name: true, code: true, isActive: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, trainings: { where: { isActive: true, publishStatus: { not: 'archived' } } } } },
          subscription: { include: { plan: { select: { name: true } } } },
        },
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
      }),
    ])

    // Subscription stats
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length
    const trialSubscriptions = subscriptions.filter(s => s.status === 'trial').length
    const expiredSubscriptions = subscriptions.filter(s => s.status === 'expired' || s.status === 'cancelled').length

    // Completion rate
    const completionRate = totalAssignments > 0 ? Math.round((passedAssignments / totalAssignments) * 100) : 0

    // Stats cards
    const stats = [
      { title: 'Toplam Hastane', value: hospitalCount, icon: 'Building2', accentColor: 'var(--color-primary)', trend: { value: activeHospitalCount, label: 'aktif', isPositive: true } },
      { title: 'Toplam Kullanıcı', value: totalUsers, icon: 'Users', accentColor: 'var(--color-info)', trend: { value: totalStaff, label: 'personel', isPositive: true } },
      { title: 'Aktif Abonelik', value: activeSubscriptions, icon: 'CreditCard', accentColor: 'var(--color-success)', trend: { value: trialSubscriptions, label: 'deneme', isPositive: true } },
      { title: 'Toplam Eğitim', value: totalTrainings, icon: 'GraduationCap', accentColor: 'var(--color-accent)', trend: { value: completionRate, label: '% başarı', isPositive: completionRate >= 50 } },
    ]

    // Subscription distribution by plan
    const planCounts = new Map<string, { aktif: number; trial: number; suresiDoldu: number }>()
    for (const sub of subscriptions) {
      const planName = sub.plan.name
      const existing = planCounts.get(planName) ?? { aktif: 0, trial: 0, suresiDoldu: 0 }
      if (sub.status === 'active') existing.aktif++
      else if (sub.status === 'trial') existing.trial++
      else existing.suresiDoldu++
      planCounts.set(planName, existing)
    }
    const subscriptionData = Array.from(planCounts.entries()).map(([plan, counts]) => ({ plan, ...counts }))

    // Monthly registration trend (last 6 months) — tek sorguda
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const monthlyRaw = await prisma.$queryRaw<
      { month_name: string; hastane: bigint; personel: bigint }[]
    >`
      SELECT
        to_char(gs.month, 'Mon') AS month_name,
        COALESCE(o.cnt, 0)::bigint AS hastane,
        COALESCE(u.cnt, 0)::bigint AS personel
      FROM generate_series(
        date_trunc('month', ${sixMonthsAgo}::timestamptz),
        date_trunc('month', now()),
        interval '1 month'
      ) AS gs(month)
      LEFT JOIN (
        SELECT date_trunc('month', created_at) AS m, COUNT(*) AS cnt
        FROM organizations
        WHERE created_at >= ${sixMonthsAgo}
        GROUP BY m
      ) o ON o.m = gs.month
      LEFT JOIN (
        SELECT date_trunc('month', created_at) AS m, COUNT(*) AS cnt
        FROM users
        WHERE created_at >= ${sixMonthsAgo}
        GROUP BY m
      ) u ON u.m = gs.month
      ORDER BY gs.month
    `

    const monthlyData = monthlyRaw.map((row) => ({
      month: row.month_name,
      hastane: Number(row.hastane),
      personel: Number(row.personel),
    }))

    // Recent hospitals formatted
    const formattedHospitals = recentHospitals.map(h => ({
      id: h.id,
      name: h.name,
      code: h.code,
      registeredAt: h.createdAt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      staffCount: h._count.users,
      trainingCount: h._count.trainings,
      plan: h.subscription?.plan?.name ?? 'Yok',
    }))

    // Expiring subscriptions (next 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000)
    const expiringSubscriptions = subscriptions
      .filter(s => s.expiresAt && new Date(s.expiresAt) <= thirtyDaysFromNow && new Date(s.expiresAt) > now)
      .map(s => {
        const daysLeft = Math.ceil((new Date(s.expiresAt!).getTime() - now.getTime()) / 86400000)
        return {
          id: s.id,
          name: s.organization.name,
          code: s.organization.code,
          plan: s.plan.name,
          expiresAt: new Date(s.expiresAt!).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          daysLeft,
          status: daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'info',
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)

    // Recent activity
    const recentActivity = recentLogs.map(log => ({
      action: log.action,
      entityType: log.entityType,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistem',
      role: log.user?.role ?? '',
      time: formatRelativeTime(log.createdAt),
      type: log.action.includes('delete') ? 'error' : log.action.includes('create') ? 'success' : 'info',
    }))

    // Platform health
    const suspendedCount = await prisma.organization.count({ where: { isSuspended: true } })
    const alert = suspendedCount > 0 ? {
      message: `${suspendedCount} hastane askıya alındı`,
      actionLabel: 'Görüntüle',
      actionHref: '/super-admin/hospitals',
      variant: 'warning',
    } : expiredSubscriptions > 0 ? {
      message: `${expiredSubscriptions} aboneliğin süresi doldu`,
      actionLabel: 'Yönet',
      actionHref: '/super-admin/subscriptions',
      variant: 'error',
    } : undefined

    const responseData = {
      stats,
      alert,
      monthlyData,
      subscriptionData,
      recentHospitals: formattedHospitals,
      expiringSubscriptions,
      recentActivity,
      platformOverview: {
        hospitalCount,
        activeHospitalCount,
        suspendedCount,
        totalUsers,
        totalStaff,
        activeSubscriptions,
        trialSubscriptions,
        expiredSubscriptions: expiredSubscriptions,
        completionRate,
      },
    }

    await setCached(CACHE_KEY, responseData, CACHE_TTL)

    return jsonResponse(responseData, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
  } catch (err) {
    logger.error('SuperAdmin Dashboard', 'Dashboard verileri alınamadı', err)
    return errorResponse('Dashboard verileri alınamadı', 503)
  }
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Az önce'
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} gün önce`
  return new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}
