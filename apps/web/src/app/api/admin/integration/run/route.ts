/**
 * POST /api/admin/integration/run — "Şimdi Çalıştır" (manuel pull senkron tetiği).
 *
 * Yalnız pull kanalı: push'ta tetiklenecek bir şey yok (karşı taraf gönderir),
 * file'da admin zaten dosya yükleme akışını kullanır. `force` YALNIZ buradan
 * geçilebilir (API'den asla) — snapshot toplu-deaktivasyon güvenlik eşiğini
 * bilinçli admin kararıyla aşmak için. `dryRun` hiçbir değişiklik uygulamaz,
 * plan SyncRun(dry_run) olarak kaydedilir ve kanal sağlığına (lastRunStatus)
 * yazılmaz.
 */
import { z } from 'zod'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { checkFeature } from '@/lib/feature-gate'
import { runPullForIntegration } from '@/lib/integration/pull'

const runSchema = z.object({
  channel: z.literal('pull'),
  dryRun: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
})

export const maxDuration = 300

export const POST = withAdminRoute(
  async ({ request, dbUser, organizationId, audit }) => {
    const enabled = await checkFeature(organizationId, 'staffIntegration')
    if (!enabled) {
      return errorResponse('Personel entegrasyonu planınızda etkin değil.', 403)
    }

    const allowed = await checkRateLimit(`integration:run:${organizationId}`, 6, 3600)
    if (!allowed) {
      return errorResponse('Saatlik manuel senkron limiti aşıldı. Lütfen daha sonra tekrar deneyin.', 429)
    }

    const raw = await parseBody<unknown>(request)
    const parsed = runSchema.safeParse(raw)
    if (!parsed.success) {
      return errorResponse('Geçersiz istek gövdesi.', 400)
    }
    const { dryRun, force } = parsed.data

    const integration = await prisma.staffIntegration.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'pull' } },
    })
    if (!integration || !integration.pullBaseUrl) {
      return errorResponse('Pull yapılandırması bulunamadı. Önce Pull Ayarları sekmesinden yapılandırın.', 404)
    }
    if (!integration.isActive) {
      return errorResponse('Pull kanalı pasif. Önce Kanallar sekmesinden etkinleştirin.', 409)
    }

    const result = await runPullForIntegration(integration, 'manual', dbUser.id, { dryRun, force })

    await audit({
      action: 'integration.run.manual',
      entityType: 'sync_run',
      entityId: result.runId ?? null,
      newData: { channel: 'pull', dryRun, force, ok: result.ok, status: result.status ?? null },
    })

    // Fetch/senkron hatası "işlem sonucu"dur (kullanıcı hatası değil) — 200 + ok:false
    // döner, UI toast'lar (test-connection emsali). runId varsa detay Geçmiş'ten izlenir.
    if (!result.ok) {
      return jsonResponse({ ok: false, message: result.error ?? 'Senkron başarısız.' })
    }
    return jsonResponse({ ok: true, runId: result.runId, status: result.status, counts: result.counts })
  },
  { requireOrganization: true },
)
