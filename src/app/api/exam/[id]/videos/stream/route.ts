import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getStreamUrl } from '@/lib/s3'

/** Get signed streaming URL for a video */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attemptId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  if (!videoId) return errorResponse('videoId required')

  // Verify attempt belongs to user and is in video phase
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId: dbUser!.id, status: 'watching_videos' },
  })
  if (!attempt) return errorResponse('Invalid attempt or not in video phase', 403)

  const video = await prisma.trainingVideo.findFirst({
    where: { id: videoId, trainingId: attempt.trainingId },
  })
  if (!video) return errorResponse('Video not found', 404)

  const streamUrl = getStreamUrl(video.videoKey)

  return jsonResponse({ streamUrl, video })
}
