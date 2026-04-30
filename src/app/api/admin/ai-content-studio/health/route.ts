/**
 * GET /api/admin/ai-content-studio/health — worker + Klinova shared session sağlık durumu
 *
 * UI bunu polling ile çağırır; "Klinova AI" rozeti yeşil/kırmızı gösterir.
 */
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { callWorker } from '@/lib/ai-content-studio/notebook-worker'

export const GET = withAdminRoute(async () => {
  try {
    const status = await callWorker<{ connected: boolean; googleEmail?: string; reason?: string }>({
      method: 'GET',
      path: '/api/shared/status',
      timeoutMs: 10_000,
    })
    return jsonResponse(
      { workerOk: true, ...status },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch {
    return jsonResponse(
      { workerOk: false, connected: false, reason: 'Worker servisine ulaşılamıyor' },
      200,
      { 'Cache-Control': 'private, max-age=10' },
    )
  }
})
