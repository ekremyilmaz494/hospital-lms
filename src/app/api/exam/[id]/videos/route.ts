import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // id can be a trainingId — find the training and user's assignment
  const assignment = await prisma.trainingAssignment.findFirst({
    where: { trainingId: id, userId: dbUser!.id },
  })

  // Also try as assignmentId
  const assignment2 = assignment ?? await prisma.trainingAssignment.findFirst({
    where: { id, userId: dbUser!.id },
  })

  const trainingId = assignment2?.trainingId ?? id

  const training = await prisma.training.findFirst({
    where: { id: trainingId },
    select: { id: true, title: true },
  })

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Get videos for this training
  const videos = await prisma.trainingVideo.findMany({
    where: { trainingId: training.id },
    orderBy: { sortOrder: 'asc' },
  })

  // Get user's video progress
  const progress = await prisma.videoProgress.findMany({
    where: { userId: dbUser!.id, videoId: { in: videos.map(v => v.id) } },
  })

  const progressMap = new Map(progress.map(p => [p.videoId, p]))

  return jsonResponse({
    trainingTitle: training.title,
    videos: videos.map(v => {
      const p = progressMap.get(v.id)
      return {
        id: v.id,
        title: v.title,
        url: v.videoUrl,
        duration: v.durationSeconds,
        completed: p?.isCompleted ?? false,
      }
    }),
  })
}
