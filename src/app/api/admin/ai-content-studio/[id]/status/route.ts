/**
 * Generation status polling endpoint.
 *
 * Worker'dan iş durumunu çek → DB'yi güncelle → response.
 * UI bu endpoint'i 5 sn'de bir poll eder.
 *
 * "completed" olunca uploadedSize'ı DB'ye yazar.
 */
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getJobStatus } from '@/lib/ai-content-studio/notebook-worker'
import { logger } from '@/lib/logger'

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const gen = await prisma.aiGeneration.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      status: true,
      workerJobId: true,
      fileSize: true,
      errorMessage: true,
      completedAt: true,
      artifactType: true,
    },
  })
  if (!gen) return errorResponse('Üretim bulunamadı.', 404)

  // Terminal state — worker'a sormaya gerek yok
  if (gen.status === 'completed' || gen.status === 'failed') {
    return jsonResponse(
      { id: gen.id, status: gen.status, fileSize: gen.fileSize, error: gen.errorMessage, completedAt: gen.completedAt },
      200,
      { 'Cache-Control': 'private, max-age=60' },
    )
  }

  if (!gen.workerJobId) {
    // Henüz worker'a forward edilmemiş — pending state
    return jsonResponse(
      { id: gen.id, status: gen.status, progress: 0 },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  }

  // Worker'dan durumu çek
  let workerStatus
  try {
    workerStatus = await getJobStatus(gen.workerJobId)
  } catch (err) {
    logger.warn('AI Studio', 'Worker status check failed (returning DB state)', { err: String(err), id })
    return jsonResponse(
      { id: gen.id, status: gen.status, progress: 0 },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  }

  // Worker terminal state'e geçtiyse DB'yi güncelle
  if (workerStatus.status === 'completed') {
    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: {
        status: 'completed',
        fileSize: workerStatus.uploadedSize ?? null,
        completedAt: new Date(workerStatus.completedAt ?? Date.now()),
      },
    })
    return jsonResponse(
      {
        id: gen.id,
        status: 'completed',
        progress: 100,
        fileSize: workerStatus.uploadedSize,
      },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  }

  if (workerStatus.status === 'failed') {
    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: {
        status: 'failed',
        errorMessage: workerStatus.error?.slice(0, 500) ?? 'Üretim başarısız.',
        completedAt: new Date(),
      },
    })
    return jsonResponse(
      {
        id: gen.id,
        status: 'failed',
        error: workerStatus.error,
      },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  }

  return jsonResponse(
    {
      id: gen.id,
      status: workerStatus.status,
      progress: workerStatus.progress ?? 0,
    },
    200,
    { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  )
}, { requireOrganization: true })
