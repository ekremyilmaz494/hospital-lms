/**
 * POST /api/admin/ai-content-studio/shared-session
 *
 * Klinova paylaşımlı Google/NotebookLM oturumunu günceller.
 * storage_state.json içeriği doğrudan worker'a yüklenir.
 * Oturum süresi dolduğunda bu endpoint ile terminal açmadan yenilenebilir.
 */
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { aiAccountConnectSchema } from '@/lib/ai-content-studio/validations'
import { callWorker } from '@/lib/ai-content-studio/notebook-worker'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const POST = withAdminRoute(async ({ request, dbUser }) => {
  const allowed = await checkRateLimit(`ai-shared-session:${dbUser.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla deneme. Lütfen bir saat bekleyin.', 429)

  const body = await parseBody<{ storageStateJson: string }>(request)
  const parsed = aiAccountConnectSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz storage_state.', 400)
  }

  try {
    await callWorker({
      method: 'POST',
      path: '/api/shared/storage-state',
      body: { storageStateJson: parsed.data.storageStateJson },
      timeoutMs: 15_000,
    })
  } catch (err) {
    logger.error('AI Studio', 'Shared session upload failed', { err: String(err) })
    return errorResponse('Worker servisine ulaşılamıyor.', 502)
  }

  return jsonResponse({ ok: true })
})
