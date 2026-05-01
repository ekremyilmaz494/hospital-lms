/**
 * AI soru tek-adet replenish — kullanıcı listeden soru sildiğinde yenisini üretir.
 *
 * `generate-questions` ile farklar:
 *  - count zorunlu 1
 *  - excluded ZORUNLU (mevcut sorular geçilir, tekrar üretmemesi için)
 *  - rate limit ayrı: 100/saat (silme/yenileme döngüsü generate'ten daha sık)
 *  - dönüş: tek soru objesi (array değil)
 */
import { z } from 'zod'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, ApiError, parseBody } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { decrypt } from '@/lib/crypto'
import { generateQuestions, OpenRouterError } from '@/lib/openrouter'
import { isValidModelId } from '@/lib/openrouter-models'
import { logger } from '@/lib/logger'

const bodySchema = z.object({
  sourceS3Keys: z.array(z.string().min(1)).min(1).max(10),
  model: z.string().refine(isValidModelId, { message: 'Geçersiz model id' }),
  excluded: z.array(z.object({ text: z.string() })).min(1),
})

export const POST = withAdminRoute(
  async ({ request, organizationId, audit }) => {
    const raw = await parseBody<unknown>(request)
    if (!raw) throw new ApiError('Geçersiz veri', 400)

    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
    }
    const { sourceS3Keys, model, excluded } = parsed.data

    const allowed = await checkRateLimit(`ai-replenish:${organizationId}`, 100, 3600)
    if (!allowed) {
      throw new ApiError(
        'AI üretim limiti aşıldı (saatte 100). Lütfen sonra tekrar deneyin.',
        429,
      )
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { openrouterApiKeyEncrypted: true },
    })
    const customApiKey = org?.openrouterApiKeyEncrypted
      ? decrypt(org.openrouterApiKeyEncrypted)
      : null

    let questions
    try {
      questions = await generateQuestions({
        model,
        sourceS3Keys,
        count: 1,
        excluded,
        customApiKey,
      })
    } catch (err) {
      if (err instanceof OpenRouterError) {
        logger.warn('ai.replenish-question', 'OpenRouter error', {
          organizationId,
          model,
          error: err.message,
        })
        throw new ApiError(err.message, 502)
      }
      throw err
    }

    if (questions.length === 0) {
      throw new ApiError('Yeni soru üretilemedi, tekrar deneyin', 502)
    }

    await audit({
      action: 'ai.generate-questions',
      entityType: 'training',
      entityId: 'wizard-draft',
      newData: { model, count: 1, excludedCount: excluded.length },
    })

    return jsonResponse({ question: questions[0] })
  },
  { requireOrganization: true },
)
