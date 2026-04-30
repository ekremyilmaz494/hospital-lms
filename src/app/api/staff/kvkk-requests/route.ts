import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'

const REQUEST_TYPES = [
  'access',        // Verilerimin islenip islenmedigini ogrenme
  'detail',        // Islenmisse bilgi talep etme
  'purpose',       // Isleme amacini ve amacina uygun kullanilip kullanilmadigini ogrenme
  'third_party',   // Ucuncu kisilere aktarilip aktarilmadigini ogrenme
  'correction',    // Eksik/yanlis islenmisse duzeltilmesini isteme
  'deletion',      // Kisisel verilerin silinmesini/yok edilmesini isteme
  'notification',  // Duzeltme/silme islemlerinin ucuncu kisilere bildirilmesini isteme
  'objection',     // Otomatik sistemler vasitasiyla aleyhime sonuc cikarilmasina itiraz
  'damage',        // Kanuna aykiri isleme sebebiyle zararin giderilmesini talep etme
] as const

const createRequestSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  description: z.string().min(10, 'Aciklama en az 10 karakter olmalidir').max(2000),
})

/** GET /api/staff/kvkk-requests — Kullanicinin KVKK taleplerini listele */
export const GET = withStaffRoute(async ({ dbUser }) => {
  try {
    const requests = await prisma.kvkkRequest.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestType: true,
        status: true,
        description: true,
        responseNote: true,
        createdAt: true,
        completedAt: true,
      },
    })

    return jsonResponse({ requests }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('KVKKRequests', 'Talepler listelenemedi', err)
    return errorResponse('Talepler yüklenirken hata oluştu', 500)
  }
})

/** POST /api/staff/kvkk-requests — Yeni KVKK hak talebi olustur */
export const POST = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  const allowed = await checkRateLimit(`kvkk:create:${dbUser.id}`, 5, 300)
  if (!allowed) return errorResponse('Çok fazla talep gönderildi. Lütfen bekleyin.', 429)

  const body = await parseBody<unknown>(request)
  if (!body) return errorResponse('Gecersiz istek', 400)

  const parsed = createRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  try {
    // Ayni tipte bekleyen talep varsa engelle
    const existing = await prisma.kvkkRequest.findFirst({
      where: {
        userId: dbUser.id,
        requestType: parsed.data.requestType,
        status: 'pending',
      },
    })

    if (existing) {
      return errorResponse('Bu tipte bekleyen bir talebiniz zaten mevcut. Lutfen sonuclanmasini bekleyin.', 409)
    }

    const kvkkRequest = await prisma.kvkkRequest.create({
      data: {
        userId: dbUser.id,
        organizationId,
        requestType: parsed.data.requestType,
        description: parsed.data.description,
        status: 'pending',
      },
      select: {
        id: true,
        requestType: true,
        status: true,
        createdAt: true,
      },
    })

    return jsonResponse({
      message: 'KVKK hak talebiniz basariyla olusturuldu. Yasal sure icinde (30 gun) talebiniz degerlendirilecektir.',
      request: kvkkRequest,
    }, 201)
  } catch (err) {
    logger.error('KVKKRequests', 'Talep oluşturulamadı', err)
    return errorResponse('Talep oluşturulurken hata oluştu', 500)
  }
}, { requireOrganization: true })
