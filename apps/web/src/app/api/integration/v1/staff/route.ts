/**
 * POST /api/integration/v1/staff — İK/HBYS tekil personel upsert (M2M push).
 *
 * Auth/rate-limit/lisans/feature/idempotency `withIntegrationRoute`'ta.
 * Akış: zarf zod → push config (fieldMapping/defaults) → normalize (422) →
 * tek satır `runSync` delta → `{ runId, action, userId?, message? }`
 * (create → 201, diğer → 200; error|conflict → 422).
 */
import { withIntegrationRoute } from '@/lib/integration/route-handler'
import { normalizeRecords } from '@/lib/integration/normalize'
import { runSync } from '@/lib/integration/ingest'
import { getPushConfig, singleRowResponse } from '@/lib/integration/push-helpers'
import { staffUpsertSchema, firstIssueMessage } from '@/lib/integration/schemas'
import { ApiError, parseBody } from '@/lib/api-helpers'

export const POST = withIntegrationRoute(async ({ request, organizationId, apiKey, audit }) => {
  const body = await parseBody<Record<string, unknown>>(request)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Geçersiz veri', 400)
  }

  const parsed = staffUpsertSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(firstIssueMessage(parsed.error), 400)

  const config = await getPushConfig(organizationId)
  const { records, rowErrors } = normalizeRecords([parsed.data], config?.fieldMapping, config?.defaults)
  const record = records[0]
  if (rowErrors.length > 0 || !record) {
    throw new ApiError(rowErrors[0]?.message ?? 'Kayıt doğrulanamadı', 422)
  }
  // fieldMapping externalId'yi boş bir kaynak alana eşlemiş olabilir —
  // upsert anahtarı normalize SONRASI da zorunlu.
  if (!record.externalId) throw new ApiError('Sicil no (externalId) zorunludur', 422)

  const result = await runSync([record], {
    organizationId,
    channel: 'push',
    trigger: 'api',
    syncMode: 'delta',
    dryRun: false,
    integrationId: config?.id ?? null,
    apiKeyId: apiKey.id,
  })

  const outcome = result.rowResults[0]
  await audit({
    action: 'integration.staff.upsert',
    entityType: 'user',
    entityId: record.externalId,
    newData: {
      runId: result.runId,
      rowAction: outcome?.action ?? null,
      userId: outcome?.userId ?? null,
    },
  })

  return singleRowResponse(result)
})
