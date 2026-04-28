import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'

const createSchema = z.object({
  trainingId: z.string().uuid('Geçersiz eğitim kimliği'),
  reason: z.string().trim().min(10, 'Açıklama en az 10 karakter olmalı').max(1000).optional(),
})

/** GET /api/staff/attempt-requests?trainingId=... — Kullanıcının ek hak taleplerini listele */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const url = new URL(request.url)
  const trainingId = url.searchParams.get('trainingId')
  if (trainingId && !/^[0-9a-f-]{36}$/i.test(trainingId)) {
    return errorResponse('Geçersiz eğitim kimliği', 400)
  }

  try {
    const requests = await prisma.examAttemptRequest.findMany({
      where: {
        userId: dbUser!.id,
        ...(trainingId && { trainingId }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        trainingId: true,
        reason: true,
        status: true,
        grantedAttempts: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
        training: { select: { title: true } },
      },
    })

    return jsonResponse({ requests }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (err) {
    logger.error('AttemptRequests', 'Talepler listelenemedi', err)
    return errorResponse('Talepler yüklenirken hata oluştu', 500)
  }
}

/** POST /api/staff/attempt-requests — Ek deneme hakkı talep et */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  if (!dbUser!.organizationId) {
    return errorResponse('Kurum bilgisi bulunamadı', 403)
  }

  const allowed = await checkRateLimit(`attempt-req:${dbUser!.id}`, 5, 300)
  if (!allowed) return errorResponse('Çok fazla talep gönderildi. Lütfen bekleyin.', 429)

  const body = await parseBody<unknown>(request)
  if (!body) return errorResponse('Geçersiz istek', 400)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  try {
    // Atama dogrulamasi + bekleyen talep kontrolu paralel — birbirinden bagimsiz
    const [assignment, existing] = await Promise.all([
      prisma.trainingAssignment.findFirst({
        where: { trainingId: parsed.data.trainingId, userId: dbUser!.id },
        select: {
          id: true,
          status: true,
          currentAttempt: true,
          maxAttempts: true,
          training: { select: { organizationId: true, title: true } },
        },
      }),
      prisma.examAttemptRequest.findFirst({
        where: {
          userId: dbUser!.id,
          trainingId: parsed.data.trainingId,
          status: 'pending',
        },
        select: { id: true },
      }),
    ])

    if (!assignment) {
      return errorResponse('Bu eğitime atanmamışsınız', 404)
    }
    if (assignment.training.organizationId !== dbUser!.organizationId) {
      return errorResponse('Yetkisiz erişim', 403)
    }
    if (assignment.status === 'passed') {
      return errorResponse('Bu eğitimi zaten başarıyla tamamladınız', 400)
    }
    if (assignment.currentAttempt < assignment.maxAttempts) {
      return errorResponse('Hâlâ deneme hakkınız var, talep oluşturmanıza gerek yok', 400)
    }
    if (existing) {
      return errorResponse('Bu eğitim için bekleyen bir talebiniz zaten var', 409)
    }

    // Talep olustur + bildirim icin admin listesi paralel (admin fetch create'e bagli degil)
    const [created, admins] = await Promise.all([
      prisma.examAttemptRequest.create({
        data: {
          userId: dbUser!.id,
          organizationId: dbUser!.organizationId,
          trainingId: parsed.data.trainingId,
          reason: parsed.data.reason ?? null,
          status: 'pending',
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        where: {
          organizationId: dbUser!.organizationId,
          role: { in: ['admin', 'super_admin'] },
          isActive: true,
        },
        select: { id: true },
      }),
    ])

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          organizationId: dbUser!.organizationId!,
          title: 'Yeni ek deneme talebi',
          message: `${dbUser!.firstName} ${dbUser!.lastName}, "${assignment.training.title}" eğitimi için ek deneme hakkı istiyor.`,
          type: 'assignment',
          relatedTrainingId: parsed.data.trainingId,
        })),
      })
    }

    return jsonResponse(
      {
        message: 'Ek deneme talebiniz iletildi. Yöneticiniz değerlendirecek.',
        request: created,
      },
      201,
    )
  } catch (err) {
    logger.error('AttemptRequests', 'Talep oluşturulamadı', err)
    return errorResponse('Talep oluşturulurken hata oluştu', 500)
  }
}
