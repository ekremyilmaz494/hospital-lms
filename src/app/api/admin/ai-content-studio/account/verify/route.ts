/**
 * NotebookLM hesabı manuel doğrulama — worker'a `notebooklm status` koşturt.
 * UI'da "Bağlantıyı Test Et" butonu bunu çağırır.
 */
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { verifyAccount } from '@/lib/ai-content-studio/notebook-worker'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

export const POST = withAdminRoute(async ({ dbUser, organizationId }) => {
  const allowed = await checkRateLimit(`ai-verify:${dbUser.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla doğrulama denemesi.', 429)

  try {
    const status = await verifyAccount(organizationId)
    if (status.connected) {
      await prisma.aiNotebookAccount.update({
        where: { organizationId },
        data: {
          lastVerifiedAt: new Date(),
          googleEmail: status.googleEmail ?? null,
        },
      })
    }
    return jsonResponse(status)
  } catch (err) {
    logger.error('AI Studio', 'Verify failed', { err: String(err) })
    return errorResponse('Worker servisine ulaşılamıyor.', 502)
  }
}, { requireOrganization: true })
