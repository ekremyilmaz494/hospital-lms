import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination, ApiError, getOrgUrl } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createStaffSchema } from '@/lib/validations'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { hashTcKimlik, tcAuditRef } from '@/lib/tc-crypto'
import { generateSyntheticEmail, isSyntheticEmail } from '@/lib/synthetic-email'
import { logger } from '@/lib/logger'
import { sendStaffWelcomeEmail, sendInvitationEmail } from '@/lib/email'
import { generateTempPassword } from '@/lib/passwords'
import { checkRateLimit, withCache, invalidateOrgCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import type { AssignmentStatus } from '@/lib/exam-state-machine'
import type { UserRole } from '@/types/database'
import { findActivePeriod, getEffectiveStartDate } from '@/lib/training-periods'
import {
  generateInvitationToken,
  computeInvitationExpiry,
  buildInvitationUrl,
  STAFF_INVITATION_TTL_HOURS,
} from '@/lib/invitations'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const orgId = organizationId
  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const department = searchParams.get('department')
  const isActive = searchParams.get('isActive')

  const cacheKey = `cache:${orgId}:staff:${page}:${limit}:${search}:${department || ''}:${isActive || ''}`

  const data = await withCache(cacheKey, 120, async () => {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      role: 'staff',
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

    // Departmanları önce çek — hem hiyerarşik staffCount toplamı hem de
    // department filter'ında descendant id'lerini çözmek için gerekli.
    const rawDepartments = await prisma.department.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        parentId: true,
        _count: { select: { users: { where: { role: 'staff' satisfies UserRole, isActive: true } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    // parentId → children id list (tek pass)
    const childrenByParent = new Map<string, string[]>()
    for (const d of rawDepartments) {
      if (!d.parentId) continue
      const list = childrenByParent.get(d.parentId)
      if (list) list.push(d.id)
      else childrenByParent.set(d.parentId, [d.id])
    }

    // BFS ile descendant id'leri topla (self dahil)
    const collectSubtree = (rootId: string): string[] => {
      const result: string[] = []
      const queue: string[] = [rootId]
      while (queue.length) {
        const id = queue.shift()!
        result.push(id)
        const children = childrenByParent.get(id)
        if (children) queue.push(...children)
      }
      return result
    }

    if (department) {
      // Sadece bu org'a ait bir departman ID'si mi (cross-tenant koruma)
      const exists = rawDepartments.some(d => d.id === department)
      if (exists) {
        const subtree = collectSubtree(department)
        where.departmentId = { in: subtree }
      } else {
        where.departmentId = department // fallback (zaten 0 sonuç dönecek)
      }
    }

    // 1. dalga — sayfa listesi + global stat'lar + aktif period paralel
    const [staff, total, activeStaff, overallAvgAgg, activePeriod] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          departmentId: true,
          isActive: true,
          createdAt: true,
          hireDate: true,
          _count: { select: { assignments: true, examAttempts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true } }),
      // Tüm org için tek sayı — groupBy yerine aggregate (tek satır döner, ucuz)
      prisma.examAttempt.aggregate({
        where: { user: { organizationId: orgId, role: 'staff' satisfies UserRole }, isPassed: true },
        _avg: { postExamScore: true },
      }),
      findActivePeriod(orgId),
    ])

    // 2. dalga — sadece bu sayfadaki userId'ler için per-user metrikler.
    // Aktif period scope'u: passed atamaları period bazlı say, effectiveStart sonrası.
    const pageUserIds = staff.map(s => s.id)
    const periodScope: Record<string, unknown> = activePeriod ? { periodId: activePeriod.id } : {}

    const [completedAssignmentsRaw, avgScores, periodAssignedCounts] = pageUserIds.length > 0
      ? await Promise.all([
          // Tek tek satır çekiyoruz çünkü effectiveStart user bazlı filtreleme gerekiyor
          prisma.trainingAssignment.findMany({
            where: {
              userId: { in: pageUserIds },
              status: 'passed' satisfies AssignmentStatus,
              ...periodScope,
            },
            select: { userId: true, assignedAt: true, completedAt: true },
          }),
          prisma.examAttempt.groupBy({
            by: ['userId'],
            where: { userId: { in: pageUserIds }, isPassed: true },
            _avg: { postExamScore: true },
          }),
          // Aktif period içindeki toplam atama (assignedTrainings karşılığı)
          activePeriod
            ? prisma.trainingAssignment.findMany({
                where: { userId: { in: pageUserIds }, periodId: activePeriod.id },
                select: { userId: true, assignedAt: true },
              })
            : Promise.resolve([] as { userId: string; assignedAt: Date }[]),
        ])
      : [[], [], []] as const

    // Effective start filtresi
    const userById = new Map(staff.map(s => [s.id, s]))
    const completedMap = new Map<string, number>()
    if (activePeriod) {
      for (const row of completedAssignmentsRaw) {
        const u = userById.get(row.userId)
        if (!u) continue
        const eff = getEffectiveStartDate(
          { hireDate: u.hireDate, createdAt: u.createdAt },
          { startDate: activePeriod.startDate },
        )
        if (new Date(row.assignedAt) >= eff) {
          completedMap.set(row.userId, (completedMap.get(row.userId) ?? 0) + 1)
        }
      }
    } else {
      for (const row of completedAssignmentsRaw) {
        completedMap.set(row.userId, (completedMap.get(row.userId) ?? 0) + 1)
      }
    }

    const assignedMap = new Map<string, number>()
    if (activePeriod) {
      for (const row of periodAssignedCounts) {
        const u = userById.get(row.userId)
        if (!u) continue
        const eff = getEffectiveStartDate(
          { hireDate: u.hireDate, createdAt: u.createdAt },
          { startDate: activePeriod.startDate },
        )
        if (new Date(row.assignedAt) >= eff) {
          assignedMap.set(row.userId, (assignedMap.get(row.userId) ?? 0) + 1)
        }
      }
    }

    const avgScoreMap = new Map(avgScores.map(a => [a.userId, Math.round(Number(a._avg.postExamScore ?? 0))]))

    // staffCount = self + tüm descendants (recursive). Leaf'lerde = self.
    // Parent kartlarda toplam personel sayısı, alt departman badge'lerde
    // kendi sayısı doğru görünür.
    const directCountById = new Map(rawDepartments.map(d => [d.id, d._count.users]))
    const totalCountById = new Map<string, number>()
    for (const d of rawDepartments) {
      const subtree = collectSubtree(d.id)
      let total = 0
      for (const id of subtree) total += directCountById.get(id) ?? 0
      totalCountById.set(d.id, total)
    }

    const departments = rawDepartments.map(d => ({
      id: d.id,
      name: d.name,
      color: d.color,
      description: d.description || '',
      staffCount: totalCountById.get(d.id) ?? d._count.users,
      parentId: d.parentId ?? null,
    }))

    const overallAvgScore = Math.round(Number(overallAvgAgg._avg.postExamScore ?? 0))

    const stats = {
      totalStaff: total,
      activeStaff,
      departmentCount: rawDepartments.length,
      avgScore: overallAvgScore
    }

    const formattedStaff = staff.map(s => ({
      id: s.id,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
      email: s.email,
      department: departments.find(d => d.id === s.departmentId)?.name || '',
      departmentId: s.departmentId,
      title: s.title || '',
      // Aktif period varsa period scope'lu sayım, yoksa toplam atama (geri uyum)
      assignedTrainings: activePeriod
        ? (assignedMap.get(s.id) ?? 0)
        : (s._count.assignments || 0),
      completedTrainings: completedMap.get(s.id) ?? 0,
      avgScore: avgScoreMap.get(s.id) ?? 0,
      status: s.isActive ? 'Aktif' : 'Pasif',
      initials: `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase()
    }))

    return { staff: formattedStaff, departments, stats, total, page, limit, totalPages: Math.ceil(total / limit) }
  })

  return jsonResponse(
    data,
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const orgId = organizationId

  // IP bazlı rate limit: 50 oluşturma / 1 saat
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown'
  const allowed = await checkRateLimit(`staff-create:ip:${ip}`, 50, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla istek gönderdiniz. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const body = await parseBody(request)
  if (!body) throw new ApiError('Geçersiz istek verisi', 400)

  // mode default 'invite' — eski client'lar password gönderiyorsa otomatik 'direct'a düşürülür.
  // E-posta yoksa invite mümkün değil (davet maili gönderilemez) → 'direct' moda zorla.
  const rawBody = body as Record<string, unknown>
  if (!rawBody.mode) {
    const hasEmail = typeof rawBody.email === 'string' && rawBody.email.trim().length > 0
    const hasPassword = typeof rawBody.password === 'string' && rawBody.password.length > 0
    rawBody.mode = (!hasEmail || hasPassword) ? 'direct' : 'invite'
  }

  const parsed = createStaffSchema.safeParse(rawBody)
  if (!parsed.success) {
    logger.error('Admin Staff', 'Validation failed', parsed.error.issues)
    const msg = parsed.error.issues.map(i => {
      const field = i.path.join('.')
      if (field === 'email') return 'Geçerli bir e-posta adresi girin'
      if (field === 'password') return 'Şifre en az 8 karakter olmalıdır'
      if (field === 'firstName') return 'Ad zorunludur'
      if (field === 'lastName') return 'Soyad zorunludur'
      if (field === 'departmentId') return 'Geçersiz departman seçimi'
      return i.message
    }).join(', ')
    return errorResponse(msg)
  }

  const data = parsed.data

  // E-posta opsiyonel; boşsa TC hash'inden sentetik adres üret (UI'da gizlenir).
  // Invite modu için gerçek e-posta zorunlu — yoksa erken hata.
  let resolvedEmail: string
  const trimmedEmail = data.email?.trim()
  if (trimmedEmail) {
    resolvedEmail = trimmedEmail.toLowerCase()
  } else {
    if (data.mode === 'invite') {
      return errorResponse('Davet göndermek için e-posta adresi gereklidir', 400)
    }
    if (!data.tcKimlik) {
      return errorResponse('E-posta yoksa TC Kimlik No zorunludur', 400)
    }
    resolvedEmail = generateSyntheticEmail(hashTcKimlik(data.tcKimlik))
  }

  // B4.2/G4.2 — Cross-tenant departman kontrolü: departmentId bu organizasyona ait olmalı
  // departmentId artık zorunlu (Zod), ama yine de tenant doğrulaması yap
  const dept = await prisma.department.findFirst({
    where: { id: data.departmentId, organizationId: orgId },
    select: { name: true },
  })
  if (!dept) return errorResponse('Geçersiz departman — bu departman organizasyonunuza ait değil', 400)

  // Aynı email zaten sistemde mi (her iki mode için de kontrol)
  const existingUser = await prisma.user.findUnique({
    where: { email: resolvedEmail },
    select: { id: true },
  })
  if (existingUser) {
    return errorResponse(
      isSyntheticEmail(resolvedEmail)
        ? 'Bu TC Kimlik No ile zaten kayıtlı bir personel var'
        : 'Bu e-posta adresi zaten sistemde kayıtlı',
      409,
    )
  }

  // TC Kimlik No duplicate kontrolü — composite (org + tcHash) unique
  // Aynı TC farklı org'da olabilir (doktor 2 hastanede), o yüzden orgId scope'lu arıyoruz.
  if (data.tcKimlik) {
    const tcHash = hashTcKimlik(data.tcKimlik)
    const existingTc = await prisma.user.findFirst({
      where: { organizationId: orgId, tcHash },
      select: { id: true },
    })
    if (existingTc) {
      return errorResponse('Bu TC Kimlik No ile kayıtlı bir personel bu kurumda zaten mevcut', 409)
    }
  }

  // ── INVITE MODE — davet linki gönder, hesap kabul anında oluşur ────────────
  if (data.mode === 'invite') {
    // Aynı email için aktif davet varsa: eskiyi revoke et, yenisini oluştur
    await prisma.invitation.updateMany({
      where: {
        organizationId: orgId,
        email: resolvedEmail,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })

    const { raw, hash } = generateInvitationToken()
    const expiresAt = computeInvitationExpiry(STAFF_INVITATION_TTL_HOURS)

    const invitation = await prisma.invitation.create({
      data: {
        tokenHash: hash,
        email: resolvedEmail,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        title: data.title ?? null,
        role: 'staff',
        organizationId: orgId,
        departmentId: data.departmentId,
        invitedByUserId: dbUser.id,
        setAsOwner: false,
        expiresAt,
      },
      select: { id: true },
    })

    await audit({
      action: 'invitation.create',
      entityType: 'invitation',
      entityId: invitation.id,
      newData: { email: resolvedEmail, role: 'staff', expiresAt },
    })

    const orgForInvite = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true, brandColor: true },
    })
    // Token tenant subdomain'inde aktive edilir — accept sonrası kullanıcı
    // doğrudan kendi hastane staff panel'ine düşer.
    const inviteUrl = buildInvitationUrl(getOrgUrl(orgForInvite?.slug), raw)
    let emailSent = true
    try {
      emailSent = await sendInvitationEmail({
        to: resolvedEmail,
        organizationName: orgForInvite?.name ?? 'Hastane',
        brandColor: orgForInvite?.brandColor ?? null,
        inviteUrl,
        inviterName: `${dbUser.firstName} ${dbUser.lastName}`,
        recipientName: `${data.firstName} ${data.lastName}`,
        roleLabel: 'Personel',
        expiresInHours: STAFF_INVITATION_TTL_HOURS,
        organizationId: orgId,
      })
    } catch (err) {
      emailSent = false
      logger.error('Admin Staff', 'Davet maili gönderilemedi', {
        email: resolvedEmail,
        error: err instanceof Error ? err.message : err,
      })
    }

    return jsonResponse(
      {
        mode: 'invite',
        invitationId: invitation.id,
        email: resolvedEmail,
        expiresAt,
        emailSent,
        // SES sandbox / mail arızası fallback'i: admin link'i manuel paylaşabilsin
        ...(emailSent ? {} : { inviteUrl }),
      },
      201,
    )
  }

  // ── DIRECT MODE — şifreyle anında hesap oluştur (legacy + acil fallback) ───
  // Şifre opsiyonel — boş gelirse merkezi helper ile güvenli şifre üret
  const effectivePassword = data.password || generateTempPassword()

  let result
  try {
    result = await createAuthUser({
      email: resolvedEmail,
      password: effectivePassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'staff',
      organizationId: orgId,
      phone: data.phone,
      departmentId: data.departmentId,
      title: data.title,
      mustChangePassword: true,
      // KVKK: ham TC sadece bu noktaya kadar; createAuthUser içinde encrypt + hash'lenir
      tcKimlik: data.tcKimlik,
      tcAddedByUserId: dbUser.id,
    })
  } catch (err) {
    if (err instanceof AuthUserError) {
      logger.error('Admin Staff', 'Auth kullanıcı oluşturulamadı', err.message)
      return errorResponse(err.safeMessage)
    }
    if (err instanceof DbUserError) {
      logger.error('Admin Staff', 'DB insert başarısız — rollback yapıldı', err.message)
      return errorResponse(err.safeMessage)
    }
    throw err
  }

  const user = result.dbUser

  await audit({
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    newData: {
      ...user,
      // KVKK: plaintext TC audit log'a ASLA yazılmaz; sadece hash prefix referansı
      ...(data.tcKimlik ? { tcAuditRef: tcAuditRef(data.tcKimlik) } : {}),
    },
  })

  revalidatePath('/admin/staff')

  try { await invalidateDashboardCache(orgId) } catch { /* cache invalidation best-effort */ }
  try { await invalidateOrgCache(orgId, 'staff') } catch { /* cache invalidation best-effort */ }

  // Hoş geldiniz maili — fire-and-forget, hesap oluşumunu bloklamaz.
  // Sentetik adresler için mail gönderilmez (gerçek inbox değil).
  let welcomeEmailSent = false
  if (!isSyntheticEmail(user.email)) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, slug: true, brandColor: true },
      })
      await sendStaffWelcomeEmail({
        to: user.email,
        staffName: `${user.firstName} ${user.lastName}`,
        organizationName: org?.name ?? 'Hastane',
        brandColor: org?.brandColor ?? null,
        tempPassword: effectivePassword,
        // Personel doğrudan kendi hastane subdomain'ine yönlenir
        loginUrl: `${getOrgUrl(org?.slug)}/auth/login`,
      })
      welcomeEmailSent = true
    } catch (err) {
      logger.warn('Admin Staff', `Hoş geldiniz maili gönderilemedi: ${user.email}`, err instanceof Error ? err.message : err)
    }
  }

  return jsonResponse(
    {
      ...user,
      mode: 'direct',
      emailSent: welcomeEmailSent,
      // Geçici şifre — yeni eklenen personellere PDF basabilmek için response'ta
      // her zaman dön (mail gitse bile admin yazıcıdan basıp dağıtmak isteyebilir).
      // Frontend bunu PDF üretiminde kullanır; DB'de plaintext tutulmuyor.
      tempPassword: effectivePassword,
      // TC admin az önce form'da girmişti; PDF üretimi kolaysın diye echo'lanıyor.
      // KVKK: response sadece şu an oluşturmayı yapan admin'e gider (cookie auth).
      ...(data.tcKimlik ? { tcKimlik: data.tcKimlik } : {}),
    },
    201,
  )
}, { requireOrganization: true })
