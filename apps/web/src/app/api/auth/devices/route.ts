import { jsonResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { listTrustedDevices } from '@/lib/auth/trusted-device'

/**
 * GET /api/auth/devices
 * Giriş yapan kullanıcının kendi aktif güvenilir cihazlarını listeler ("Cihazlarım").
 */
export const GET = withStaffRoute(async ({ dbUser }) => {
  const devices = await listTrustedDevices(dbUser.id)
  return jsonResponse({ devices }, 200, { 'Cache-Control': 'private, no-store' })
})
