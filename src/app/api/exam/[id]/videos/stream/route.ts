import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { getStreamUrl } from '@/lib/s3'
import type { AttemptStatus } from '@/lib/exam-state-machine'

/** Get signed streaming URL for a video */
export const GET = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id: attemptId } = params

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  if (!videoId) return errorResponse('videoId required')

  // Verify attempt belongs to user and is in video phase
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser.id, status: 'watching_videos' satisfies AttemptStatus },
    include: { training: { select: { organizationId: true } } },
  })
  if (!attempt) return errorResponse('Invalid attempt or not in video phase', 403)

  // Verify org isolation
  if (attempt.training.organizationId !== organizationId) {
    return errorResponse('Yetkisiz erişim', 403)
  }

  const video = await prisma.trainingVideo.findFirst({
    where: { id: videoId, trainingId: attempt.trainingId },
  })
  if (!video) return errorResponse('Video not found', 404)

  const streamUrl = await getStreamUrl(video.videoKey)

  return jsonResponse({ streamUrl, video }, 200, { 'Cache-Control': 'private, no-store' })
}, { requireOrganization: true })
