import { prisma } from '@/lib/prisma'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse, ApiError } from '@/lib/api-helpers'
import { checkFeature } from '@/lib/feature-gate'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { maskEmail, maskPhone } from '@/lib/pii-mask'
import { fetchStaffFromRemote } from '@/lib/integration/pull'

/**
 * POST /api/admin/integration/test-connection — İK/HBYS pull bağlantı testi.
 *
 * Pull config'iyle uzak API'den TEK sayfa çeker, ilk 3 ham satırı alan adlarıyla
 * ama değerleri KVKK-maskeli döner (admin mapping'i doğrulayabilsin diye).
 * Bağlantı hatası bir "test sonucu"dur → 200 + { ok:false, message }.
 */

const FEATURE_DISABLED_MSG = 'Personel entegrasyonu planınızda etkin değil.'

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Telefon-benzeri: yalnız rakam/boşluk/+()-. karakterleri ve en az 7 rakam.
const PHONE_LIKE = /^\+?[\d\s().-]{7,20}$/

/** Tek değeri maskeler — sayı/boolean/null aynen, string'ler KVKK-maskeli. */
function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return ''
    if (EMAIL_LIKE.test(trimmed)) return maskEmail(trimmed)
    if (PHONE_LIKE.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7) return maskPhone(trimmed)
    return `${trimmed.slice(0, 2)}***`
  }
  // İç içe nesne/dizi — içeriği bilinmiyor, ham PII sızdırmamak için tamamen maskele.
  return '***'
}

function maskRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, val]) => [key, maskValue(val)]))
}

export const POST = withAdminRoute(async ({ organizationId, audit }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  const allowed = await checkRateLimit(`integration:test:${organizationId}`, 10, 3600)
  if (!allowed) {
    return errorResponse('Çok fazla bağlantı testi yapıldı. Lütfen daha sonra tekrar deneyin.', 429)
  }

  const integration = await prisma.staffIntegration.findUnique({
    where: { organizationId_channel: { organizationId, channel: 'pull' } },
    select: {
      id: true,
      pullBaseUrl: true,
      pullAuthType: true,
      pullCredentialsEncrypted: true,
      pullPagination: true,
    },
  })
  if (!integration || !integration.pullBaseUrl) {
    return errorResponse('Pull yapılandırması bulunamadı', 404)
  }

  try {
    const { rows, truncated } = await fetchStaffFromRemote(integration, { maxPages: 1 })
    const sample = rows.slice(0, 3)
    const sampleFields = Array.from(new Set(sample.flatMap((r) => Object.keys(r))))
    const sampleRows = sample.map(maskRow)

    // Audit'e ham satır ASLA yazılmaz — yalnız sonuç özeti.
    await audit({
      action: 'integration.test-connection',
      entityType: 'staff_integration',
      entityId: integration.id,
      newData: { ok: true, totalFetched: rows.length, truncated },
    })

    return jsonResponse({ ok: true, sampleFields, sampleRows, totalFetched: rows.length, truncated })
  } catch (err) {
    // Fetch/yapılandırma hatası test SONUCUDUR → 200 + ok:false (form içinde gösterilir).
    const message = err instanceof ApiError
      ? err.message
      : 'İK API bağlantı testi başarısız — sunucuya ulaşılamadı.'
    if (!(err instanceof ApiError)) {
      logger.error('integration-test', 'Bağlantı testi beklenmeyen hata', {
        organizationId,
        err: err instanceof Error ? err.message : String(err),
      })
    }

    await audit({
      action: 'integration.test-connection',
      entityType: 'staff_integration',
      entityId: integration.id,
      newData: { ok: false, message },
    })

    return jsonResponse({ ok: false, message })
  }
}, { requireOrganization: true })
