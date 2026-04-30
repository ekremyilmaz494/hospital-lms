import { jsonResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/auth/accept-terms
 * Sets termsAccepted=true and termsAcceptedAt=now() for the authenticated user.
 */
export const PUT = withStaffRoute(async ({ dbUser }) => {
  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
