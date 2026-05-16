import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, setCached } from '@/lib/redis'
import { z } from 'zod/v4'
import { randomUUID } from 'crypto'

const impersonateSchema = z.object({
  userId: z.string().uuid(),
})

/**
 * G3.4 — Super admin impersonation endpoint.
 * Generates a one-time magic-link sign-in URL for the target user.
 * Logs the impersonation action to the audit trail before returning the URL.
 *
 * Security notes:
 * - Only super_admin role can call this endpoint
 * - Target user must exist and belong to a real organization
 * - The magic link expires in ~1 hour and is single-use
 * - The caller's tab remains authenticated; impersonation opens in a new tab
 */
export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  // Rate limit: max 10 impersonations per super-admin per hour
  const rateLimitOk = await checkRateLimit(`impersonate:${dbUser.id}`, 10, 3600)
  if (!rateLimitOk) return errorResponse('Çok fazla impersonation denemesi. Lütfen bir saat sonra tekrar deneyin.', 429)

  let body: { userId: string }
  try {
    const raw = await request.json()
    body = impersonateSchema.parse(raw)
  } catch {
    return errorResponse('Geçersiz istek gövdesi', 400)
  }

  // Resolve target user from DB
  const targetUser = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, isActive: true },
  })

  if (!targetUser) return errorResponse('Kullanıcı bulunamadı', 404)
  if (!targetUser.isActive) return errorResponse('Pasif kullanıcı impersonate edilemez', 400)
  if (targetUser.role === 'super_admin') return errorResponse('Başka bir super admin impersonate edilemez', 403)

  // İmpersonation bilgilerini kriptografik token ile Redis'te sakla (URL manipülasyonunu önle)
  const impersonationToken = randomUUID()
  await setCached(`impersonation:${impersonationToken}`, {
    impersonatedBy: dbUser.id,
    impersonatorName: `${dbUser.firstName} ${dbUser.lastName}`,
    targetUserId: targetUser.id,
    createdAt: new Date().toISOString(),
  }, 3600) // 1 saat TTL — magic link ile aynı ömür

  // Generate single-use magic link via service role key
  const adminClient = await createServiceClient()
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/callback?imp_token=${impersonationToken}`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return errorResponse('Magic link oluşturulamadı: ' + (linkError?.message ?? 'Bilinmeyen hata'), 500)
  }

  // Audit log — always before returning the link
  await audit({
    action: 'impersonate',
    entityType: 'user',
    entityId: targetUser.id,
    newData: {
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      targetOrganizationId: targetUser.organizationId,
    },
  })

  return jsonResponse({
    actionLink: linkData.properties.action_link,
    targetUser: {
      id: targetUser.id,
      name: `${targetUser.firstName} ${targetUser.lastName}`,
      email: targetUser.email,
      role: targetUser.role,
    },
  })
})
