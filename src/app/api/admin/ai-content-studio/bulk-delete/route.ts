import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { deleteObject } from '@/lib/s3'
import { aiBulkDeleteSchema } from '@/lib/validations'

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError
  const orgId = dbUser!.organizationId!

  const body = await parseBody<{ ids: string[] }>(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = aiBulkDeleteSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Geçersiz veri', 400)

  const generations = await prisma.aiGeneration.findMany({
    where: { id: { in: parsed.data.ids }, organizationId: orgId },
    select: { id: true, outputS3Key: true, savedToLibrary: true, title: true },
  })

  const deletable = generations.filter(g => !g.savedToLibrary)
  const skipped = generations.filter(g => g.savedToLibrary)

  if (deletable.length === 0) {
    return jsonResponse({
      deleted: 0,
      skipped: skipped.length,
      skippedReason: skipped.length > 0
        ? 'Kütüphaneye kaydedilmiş içerikler atlandı'
        : null,
    })
  }

  await Promise.allSettled(
    deletable
      .filter(g => g.outputS3Key)
      .map(g => deleteObject(g.outputS3Key!))
  )

  await prisma.aiGeneration.deleteMany({
    where: { id: { in: deletable.map(g => g.id) } },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'ai_generation_bulk_delete',
    entityType: 'AiGeneration',
    newData: {
      deletedCount: deletable.length,
      deletedIds: deletable.map(g => g.id),
    },
  })

  return jsonResponse({
    deleted: deletable.length,
    skipped: skipped.length,
    skippedReason: skipped.length > 0
      ? 'Kütüphaneye kaydedilmiş içerikler atlandı'
      : null,
  })
}
