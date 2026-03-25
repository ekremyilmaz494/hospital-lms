import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const profile = await prisma.user.findUnique({
    where: { id: dbUser!.id },
    include: {
      organization: { select: { name: true, code: true } },
      _count: { select: { assignments: true, examAttempts: true } },
    },
  })

  return jsonResponse(profile)
}

export async function PATCH(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const body = await parseBody<{ phone?: string; avatarUrl?: string }>(request)
  if (!body) return errorResponse('Invalid body')

  // Staff can only update phone and avatar
  const updated = await prisma.user.update({
    where: { id: dbUser!.id },
    data: {
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
    },
  })

  return jsonResponse(updated)
}
