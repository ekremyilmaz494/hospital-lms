import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'

interface SignBody {
  signatureData: string
  signatureMethod: 'canvas' | 'acknowledge'
}

/** POST /api/exam/[id]/sign — Personel sınav sonucu dijital imzası */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const body = await parseBody<SignBody>(request)
  if (!body?.signatureData || !body?.signatureMethod) {
    return errorResponse('signatureData ve signatureMethod alanları zorunludur', 400)
  }

  const { signatureData, signatureMethod } = body

  if (signatureMethod !== 'canvas' && signatureMethod !== 'acknowledge') {
    return errorResponse('signatureMethod "canvas" veya "acknowledge" olmalıdır', 400)
  }

  // Canvas imzası: base64 PNG kontrolü
  if (signatureMethod === 'canvas' && !signatureData.startsWith('data:image/png;base64,')) {
    return errorResponse('Canvas imzası base64 PNG formatında olmalıdır', 400)
  }

  // Acknowledge: sabit string kontrolü
  if (signatureMethod === 'acknowledge' && signatureData !== 'ACKNOWLEDGED') {
    return errorResponse('Onay imzası "ACKNOWLEDGED" değerinde olmalıdır', 400)
  }

  // Attempt'i bul — userId eşleşmeli
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id },
    select: { id: true, isPassed: true, signedAt: true, trainingId: true },
  })

  if (!attempt) return errorResponse('Sınav denemesi bulunamadı', 404)

  // Sadece geçenler imzalayabilir
  if (!attempt.isPassed) return errorResponse('Sadece başarılı sınav denemeleri imzalanabilir', 403)

  // Zaten imzalanmış mı
  if (attempt.signedAt) return errorResponse('Zaten imzalandı', 409)

  const signatureIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const signedAt = new Date()

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { signedAt, signatureData, signatureIp, signatureMethod },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'sign',
    entityType: 'exam_attempt',
    entityId: attemptId,
    newData: { signatureMethod, signatureIp, signedAt },
  })

  return jsonResponse({ success: true, signedAt })
}
