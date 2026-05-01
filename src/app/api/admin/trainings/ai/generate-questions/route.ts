/**
 * AI soru üretimi (wizard step 3) — OpenRouter çağrısı.
 *
 * Akış:
 *  1. Admin/super_admin auth + org context
 *  2. Body validation (zod) — sourceS3Keys, model, count, excluded
 *  3. Rate limit (org bazlı, 20/saat)
 *  4. Org'un encrypted custom OpenRouter key'i varsa decrypt edilir; yoksa platform key
 *  5. `generateQuestions` çağrısı; OpenRouterError → 502
 *  6. audit + jsonResponse
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
  count: z.number().int().min(1).max(20).default(15),
  excluded: z.array(z.object({ text: z.string() })).optional(),
})

export const POST = withAdminRoute(
  async ({ request, organizationId, audit }) => {
    const raw = await parseBody<unknown>(request)
    if (!raw) throw new ApiError('Geçersiz veri', 400)

    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
    }
    const { sourceS3Keys, model, count, excluded } = parsed.data

    const allowed = await checkRateLimit(`ai-gen:${organizationId}`, 20, 3600)
    if (!allowed) {
      throw new ApiError(
        'AI üretim limiti aşıldı (saatte 20). Lütfen sonra tekrar deneyin.',
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
        count,
        excluded,
        customApiKey,
      })
    } catch (err) {
      if (err instanceof OpenRouterError) {
        logger.warn('ai.generate-questions', 'OpenRouter error', {
          organizationId,
          model,
          error: err.message,
        })
        throw new ApiError(err.message, 502)
      }
      throw err
    }

    await audit({
      action: 'ai.generate-questions',
      entityType: 'training',
      entityId: 'wizard-draft',
      newData: { model, count, excludedCount: excluded?.length ?? 0 },
    })

    return jsonResponse({ questions })
  },
  { requireOrganization: true },
)
