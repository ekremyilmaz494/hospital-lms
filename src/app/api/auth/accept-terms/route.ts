import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/auth/accept-terms
 * Sets termsAccepted=true and termsAcceptedAt=now() for the authenticated user.
 */
export async function PUT() {
  const { dbUser, error } = await getAuthUser()

  if (error || !dbUser) {
    return error ?? errorResponse('Yetkisiz erisim', 401)
  }

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
  })

  return jsonResponse({ success: true })
}
