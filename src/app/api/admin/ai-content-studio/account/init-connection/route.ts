/**
 * POST /api/admin/ai-content-studio/account/init-connection
 *
 * Admin "Hesap Bağla" tıkladığında çağrılır. Yeni one-time token üretir
 * ve admin'e tek-satır kurulum komutunu döner.
 */
import { getAuthUser, requireRole, jsonResponse, errorResponse, getAppUrl } from '@/lib/api-helpers'
import { issueConnectionToken } from '@/lib/ai-content-studio/connection-tokens'
import { checkRateLimit } from '@/lib/redis'

export async function POST() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleErr = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleErr) return roleErr

  const allowed = await checkRateLimit(`ai-init-conn:${dbUser!.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla bağlantı denemesi.', 429)

  const token = await issueConnectionToken({
    orgId: dbUser!.organizationId!,
    userId: dbUser!.id,
  })

  const appUrl = getAppUrl()
  const scriptUrl = `${appUrl}/api/notebook-connect/script`
  const expiresInMinutes = 10

  return jsonResponse({
    token,
    expiresInMinutes,
    // OS-bazlı tek satırlık komut — script kendi TOKEN'ını query'den okur,
    // upload endpoint'ine token'la POST eder.
    commands: {
      macos: `curl -fsSL "${scriptUrl}?t=${token}" | python3 -`,
      linux: `curl -fsSL "${scriptUrl}?t=${token}" | python3 -`,
      windows: `iwr "${scriptUrl}?t=${token}" -UseBasicParsing | Select-Object -ExpandProperty Content | python -`,
    },
    pollUrl: `/api/admin/ai-content-studio/account`,
  })
}
