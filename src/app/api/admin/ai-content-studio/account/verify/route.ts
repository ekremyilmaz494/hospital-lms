/**
 * NotebookLM hesabı manuel doğrulama — worker'a `notebooklm status` koşturt.
 * UI'da "Bağlantıyı Test Et" butonu bunu çağırır.
 */
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { verifyAccount } from '@/lib/ai-content-studio/notebook-worker'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

export async function POST() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`ai-verify:${dbUser!.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla doğrulama denemesi.', 429)

  const orgId = dbUser!.organizationId!

  try {
    const status = await verifyAccount(orgId)
    if (status.connected) {
      await prisma.aiNotebookAccount.update({
        where: { organizationId: orgId },
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
}
