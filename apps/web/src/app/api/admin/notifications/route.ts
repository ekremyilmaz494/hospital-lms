import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createNotificationSchema } from '@/lib/validations'
import type { UserRole } from '@/types/database'

// perf-check: no-cache-invalidation — Bildirimler Redis'te cache'lenmiyor;
// tazeleme HTTP Cache-Control (max-age=10) + revalidatePath ile yapılıyor.

/**
 * Admin "Gönderdiklerim" listesi — batch (gönderim) bazlı.
 *
 * Tek bir admin gönderimi DB'de N alıcı satırı yaratır (createMany). Bu endpoint
 * o satırları `batchId` üzerinden tek kart olarak gruplar. Legacy satırlarda
 * (eski veri) `batchId` NULL; o satırlar tek-row batch gibi (id = batchId)
 * davranır.
 */
export const GET = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit } = safePagination(searchParams)

  // Bu admin'in gönderdikleri — sistem bildirimleri (senderId NULL) gözükmez.
  const where = { organizationId, senderId: dbUser.id }

  // Tüm satırları çek — gruplama ve sayfalama JS'te yapılır.
  // Not: groupBy + ayrı findMany ile title/message getirme paterni iki
  // round-trip + Cartesian + legacy NULL fallback'i karmaşıklaştırırdı.
  // Admin "Gönderdiklerim" hacmi sınırlı (rate limit: 100 bildirim/saat × ortalama
  // ~50 alıcı), tek findMany + JS grouping daha öngörülebilir.
  const rows = await prisma.notification.findMany({
    where,
    select: {
      id: true,
      batchId: true,
      title: true,
      message: true,
      type: true,
      isRead: true,
      createdAt: true,
      relatedTrainingId: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // batchId ile grupla; legacy (NULL) satırlar için id'yi grup anahtarı yap.
  type BatchAcc = {
    batchId: string
    isLegacy: boolean
    title: string
    message: string
    type: string
    createdAt: Date
    recipientCount: number
    readCount: number
    relatedTrainingId: string | null
  }
  const groups = new Map<string, BatchAcc>()
  for (const r of rows) {
    const key = r.batchId ?? r.id
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        batchId: key,
        isLegacy: r.batchId === null,
        title: r.title,
        message: r.message,
        type: r.type,
        createdAt: r.createdAt,
        recipientCount: 1,
        readCount: r.isRead ? 1 : 0,
        relatedTrainingId: r.relatedTrainingId,
      })
    } else {
      existing.recipientCount += 1
      if (r.isRead) existing.readCount += 1
      // En erken createdAt'i batch'in başlangıcı kabul et (createMany'de ms farkları olabilir)
      if (r.createdAt < existing.createdAt) existing.createdAt = r.createdAt
    }
  }

  const allBatches = Array.from(groups.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
  const total = allBatches.length
  const start = (page - 1) * limit
  const notifications = allBatches.slice(start, start + limit).map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  }))

  return jsonResponse(
    { notifications, total, page, limit },
    200,
    { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  )
}, { requireOrganization: true })

/**
 * Tek alıcılı manuel bildirim oluşturma. batchId set edilir — admin listesinde
 * tek kart (size=1 batch) olarak görünür.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createNotificationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { userId, title, message, type, relatedTrainingId } = parsed.data

  // GÜVENLİK (IDOR/mass-assignment): Alıcı ve ilişkili eğitim çağıranın org'una ait olmalı.
  // Önceki `...parsed.data` spread'i, yabancı bir userId ile başka org'un kullanıcısına
  // bağlı Notification satırı yaratılmasına izin veriyordu. (notifications/send rotasındaki
  // recipient doğrulamasının aynısı.)
  const [recipient, relatedTraining] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, organizationId, isActive: true }, select: { id: true } }),
    relatedTrainingId
      ? prisma.training.findFirst({ where: { id: relatedTrainingId, organizationId }, select: { id: true } })
      : Promise.resolve(null),
  ])
  if (!recipient) return errorResponse('Geçerli alıcı bulunamadı', 400)
  if (relatedTrainingId && !relatedTraining) return errorResponse('Geçersiz eğitim', 400)

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      ...(relatedTrainingId ? { relatedTrainingId } : {}),
      organizationId,
      senderId: dbUser.id,
      batchId: crypto.randomUUID(),
    },
  })

  revalidatePath('/staff/notifications')
  revalidatePath('/admin/notifications')

  return jsonResponse(notification, 201)
}, { requireOrganization: true })

// Bulk send to all staff
export const PUT = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const body = await parseBody<{ title: string; message: string; type: string }>(request)
  if (!body?.title || !body?.message) return errorResponse('Title and message required')

  // İçerik uzunluk limiti — bulk × 500 kullanıcı → bellek koruması
  if (body.title.length > 200) return errorResponse('Başlık en fazla 200 karakter olabilir', 400)
  if (body.message.length > 5000) return errorResponse('Mesaj en fazla 5000 karakter olabilir', 400)

  const staffUsers = await prisma.user.findMany({
    where: { organizationId, role: 'staff' satisfies UserRole, isActive: true },
    select: { id: true },
  })

  // Rate limit: max 500 kullanıcıya toplu bildirim
  if (staffUsers.length > 500) {
    return errorResponse(`Toplu bildirim en fazla 500 kişiye gönderilebilir. Mevcut personel: ${staffUsers.length}`, 400)
  }

  // Tüm batch'e tek UUID — admin listesi bunla tek karta gruplar.
  const batchId = crypto.randomUUID()

  // Batch gönderim (100'erli gruplarla)
  let totalSent = 0
  for (let i = 0; i < staffUsers.length; i += 100) {
    const batch = staffUsers.slice(i, i + 100)
    const result = await prisma.notification.createMany({
      data: batch.map(u => ({
        userId: u.id,
        organizationId,
        senderId: dbUser.id,
        batchId,
        title: body.title,
        message: body.message,
        type: body.type ?? 'announcement',
      })),
    })
    totalSent += result.count
  }

  // POST ile simetri: bulk gönderim sonrası staff ve admin listelerini
  // tazele. Realtime hook yeni gelenleri client store'a düşürür, ama
  // RSC cache'inde kalan eski sayfalar tutarsız kalabilir.
  revalidatePath('/staff/notifications')
  revalidatePath('/admin/notifications')

  return jsonResponse({ sent: totalSent, batchId })
}, { requireOrganization: true })
