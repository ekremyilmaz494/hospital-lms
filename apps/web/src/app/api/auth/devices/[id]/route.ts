import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { revokeTrustedDevice } from '@/lib/auth/trusted-device'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE /api/auth/devices/[id]
 * Kullanıcının kendi güvenilir cihazlarından birini iptal eder ("Çıkış yaptır").
 * Sonraki girişte o cihaz tekrar SMS/MFA doğrulaması ister.
 */
export const DELETE = withStaffRoute<{ id: string }>(async ({ params, dbUser }) => {
  const { id } = params
  if (!UUID_RE.test(id)) return errorResponse('Geçersiz cihaz kimliği', 400)

  const revoked = await revokeTrustedDevice(dbUser.id, id)
  if (!revoked) return errorResponse('Cihaz bulunamadı veya zaten iptal edilmiş', 404)

  return jsonResponse({ success: true })
}, { writeGuard: false })
