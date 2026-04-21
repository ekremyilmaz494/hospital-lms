import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

const submitSchema = z.object({
  answers: z.array(
    z.object({
      itemId: z.string().uuid(),
      score: z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional(),
    })
  ).min(1),
})

/**
 * POST /api/staff/evaluations/[id]/submit
 *
 * Yetkinlik değerlendirmesini tamamlar:
 * - Tüm form item'ları puanlanmış olmalı
 * - Kategori ağırlıklarına göre weighted overall score hesaplanır (100 üzerinden)
 * - Mevcut cevaplar silinip yenileri yazılır (idempotent re-submit desteği)
 * - Status COMPLETED'a geçirilir, completedAt set edilir
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`eval-submit:${dbUser!.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin.', 429)

  const { id } = await params

  const body = await request.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Geçersiz cevap formatı.', 400)
  }

  try {
    const evaluation = await prisma.competencyEvaluation.findFirst({
      where: {
        id,
        evaluatorId: dbUser!.id,
        form: { organizationId: dbUser!.organizationId! },
      },
      select: {
        id: true,
        status: true,
        form: {
          select: {
            categories: {
              select: {
                weight: true,
                items: { select: { id: true } },
              },
            },
          },
        },
      },
    })

    if (!evaluation) return errorResponse('Değerlendirme bulunamadı.', 404)
    if (evaluation.status === 'COMPLETED') return errorResponse('Bu değerlendirme zaten tamamlandı.', 409)

    // Tüm maddelerin cevaplandığını ve item ID'lerin bu forma ait olduğunu doğrula
    const allItemIds = new Set(evaluation.form.categories.flatMap(c => c.items.map(i => i.id)))
    const answerItemIds = new Set(parsed.data.answers.map(a => a.itemId))

    for (const itemId of allItemIds) {
      if (!answerItemIds.has(itemId)) {
        return errorResponse('Tüm maddelerin puanlanması zorunludur.', 400)
      }
    }
    for (const answer of parsed.data.answers) {
      if (!allItemIds.has(answer.itemId)) {
        return errorResponse('Geçersiz madde gönderildi.', 400)
      }
    }

    // Weighted overall score — kategorilerin ortalaması, kategori ağırlığına göre
    const answerByItem = new Map(parsed.data.answers.map(a => [a.itemId, a.score]))
    let weightedSum = 0
    let totalWeight = 0
    for (const cat of evaluation.form.categories) {
      if (cat.items.length === 0 || cat.weight === 0) continue
      const catSum = cat.items.reduce((s, item) => s + (answerByItem.get(item.id) ?? 0), 0)
      const catAvg = catSum / cat.items.length
      weightedSum += catAvg * cat.weight
      totalWeight += cat.weight
    }
    // 5 üzerinden puan → 100'e normalize (×20)
    const overallScore = totalWeight > 0 ? (weightedSum / totalWeight) * 20 : 0
    const overallScoreRounded = Math.round(overallScore * 100) / 100

    await prisma.$transaction(async (tx) => {
      await tx.competencyAnswer.deleteMany({ where: { evaluationId: id } })
      await tx.competencyAnswer.createMany({
        data: parsed.data.answers.map(a => ({
          evaluationId: id,
          itemId: a.itemId,
          score: a.score,
          comment: a.comment ?? null,
        })),
      })
      await tx.competencyEvaluation.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          overallScore: overallScoreRounded,
          completedAt: new Date(),
        },
      })
    })

    void createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId ?? undefined,
      action: 'EVALUATION_COMPLETED',
      entityType: 'competency_evaluation',
      entityId: id,
      newData: { overallScore: overallScoreRounded },
    })

    return jsonResponse({ success: true, overallScore: overallScoreRounded })
  } catch (err) {
    logger.error('staff:evaluations:submit', 'Submit başarısız', err)
    return errorResponse('Değerlendirme kaydedilemedi.', 500)
  }
}
