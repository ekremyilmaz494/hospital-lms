/**
 * /api/integration/v1/staff/[externalId] — İK/HBYS tekil personel yönetimi (M2M push).
 *
 * PATCH  → kısmi güncelleme: body + mevcut değerlerden tam StaffRecord kurulur,
 *          tek satır `runSync` delta işler (create → 201, diğer → 200, error|conflict → 422).
 * DELETE → deaktivasyon: `active:false` satırı `runSync`'ten geçer (tutarlı SyncRun izi);
 *          zaten pasifse action 'skip' ile 200.
 *
 * Kullanıcı `user_org_external_unique` (organizationId+externalId) ile bulunur —
 * yoksa 404. Auth/rate-limit/lisans/feature/idempotency `withIntegrationRoute`'ta.
 */
import { prisma } from '@/lib/prisma'
import { withIntegrationRoute } from '@/lib/integration/route-handler'
import { normalizeRecords } from '@/lib/integration/normalize'
import { runSync } from '@/lib/integration/ingest'
import { getPushConfig, singleRowResponse } from '@/lib/integration/push-helpers'
import { staffPatchSchema, firstIssueMessage, type StaffPatchInput } from '@/lib/integration/schemas'
import { ApiError, parseBody } from '@/lib/api-helpers'
import type { SyncOptions } from '@/lib/integration/types'

const NOT_FOUND_MESSAGE = 'Personel bulunamadı'
/** `User.externalId` VarChar(100) — daha uzunu var olamaz, DB'ye inmeden 404. */
const EXTERNAL_ID_MAX_LENGTH = 100

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  title: true,
  departmentId: true,
  hireDate: true,
  isActive: true,
} as const

interface ExistingUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  title: string | null
  departmentId: string | null
  hireDate: Date | null
  isActive: boolean
}

/** Path parametresini doğrular — boş/aşırı uzun sicil no var olamaz → 404. */
function parseExternalIdParam(raw: string | undefined): string {
  const externalId = (raw ?? '').trim()
  if (!externalId || externalId.length > EXTERNAL_ID_MAX_LENGTH) {
    throw new ApiError(NOT_FOUND_MESSAGE, 404)
  }
  return externalId
}

function findUserByExternalId(organizationId: string, externalId: string): Promise<ExistingUser | null> {
  return prisma.user.findUnique({
    where: { user_org_external_unique: { organizationId, externalId } },
    select: USER_SELECT,
  })
}

function pushSyncOptions(organizationId: string, apiKeyId: string, integrationId: string | null): SyncOptions {
  return {
    organizationId,
    channel: 'push',
    trigger: 'api',
    syncMode: 'delta',
    dryRun: false,
    integrationId,
    apiKeyId,
  }
}

/**
 * Body + mevcut kullanıcı değerlerinden TAM StaffRecord ham satırı kurar —
 * `runSync` delta diff'i "gönderilmeyen alan silindi" sanmasın.
 */
function mergePatchIntoRecord(
  externalId: string,
  patch: StaffPatchInput,
  user: ExistingUser,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    externalId,
    firstName: patch.firstName ?? user.firstName,
    lastName: patch.lastName ?? user.lastName,
    email: patch.email ?? user.email,
    phone: patch.phone ?? user.phone ?? undefined,
    title: patch.title ?? user.title ?? undefined,
    // TC yalnız body'den gelir — DB'de ham TC tutulmaz (yalnız hash), geri kurulamaz.
    tcKimlik: patch.tcKimlik ?? undefined,
    hireDate: patch.hireDate ?? (user.hireDate ? user.hireDate.toISOString().slice(0, 10) : undefined),
    // active verilmediyse mevcut durum korunur — pasif kullanıcıya alan PATCH'i
    // onu yeniden AKTİFLEŞTİRMEZ (runSync 'Zaten pasif' skip üretir).
    active: patch.active ?? user.isActive,
  }
  // Departman önceliği: body.departmentId > body.departmentName > mevcut departman.
  if (patch.departmentId != null) merged.departmentId = patch.departmentId
  else if (patch.departmentName != null) merged.departmentName = patch.departmentName
  else if (user.departmentId) merged.departmentId = user.departmentId
  return merged
}

export const PATCH = withIntegrationRoute<{ externalId: string }>(
  async ({ request, params, organizationId, apiKey, audit }) => {
    const externalId = parseExternalIdParam(params.externalId)

    const body = await parseBody<Record<string, unknown>>(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError('Geçersiz veri', 400)
    }
    const parsed = staffPatchSchema.safeParse(body)
    if (!parsed.success) throw new ApiError(firstIssueMessage(parsed.error), 400)

    const [config, user] = await Promise.all([
      getPushConfig(organizationId),
      findUserByExternalId(organizationId, externalId),
    ])
    if (!user) throw new ApiError(NOT_FOUND_MESSAGE, 404)

    // PATCH gövdesi kanonik alan adlarıyla gelir — fieldMapping/defaults toplu
    // feed'lere özgüdür, burada uygulanmaz (yalnız derin doğrulama için normalize).
    const { records, rowErrors } = normalizeRecords([mergePatchIntoRecord(externalId, parsed.data, user)])
    const record = records[0]
    if (rowErrors.length > 0 || !record) {
      throw new ApiError(rowErrors[0]?.message ?? 'Kayıt doğrulanamadı', 422)
    }

    const result = await runSync([record], pushSyncOptions(organizationId, apiKey.id, config?.id ?? null))

    const outcome = result.rowResults[0]
    await audit({
      action: 'integration.staff.update',
      entityType: 'user',
      entityId: externalId,
      newData: {
        runId: result.runId,
        rowAction: outcome?.action ?? null,
        userId: user.id,
      },
    })

    return singleRowResponse(result)
  },
)

export const DELETE = withIntegrationRoute<{ externalId: string }>(
  async ({ params, organizationId, apiKey, audit }) => {
    const externalId = parseExternalIdParam(params.externalId)

    const [config, user] = await Promise.all([
      getPushConfig(organizationId),
      findUserByExternalId(organizationId, externalId),
    ])
    if (!user) throw new ApiError(NOT_FOUND_MESSAGE, 404)

    // Değerler DB'den geldiği için normalize gerekmez — deaktivasyon da SyncRun
    // izinden geçer (raporlanabilirlik + deactivateStaff'ın sınav expire mantığı).
    const result = await runSync(
      [{ externalId, firstName: user.firstName, lastName: user.lastName, active: false }],
      pushSyncOptions(organizationId, apiKey.id, config?.id ?? null),
    )

    const outcome = result.rowResults[0]
    await audit({
      action: 'integration.staff.deactivate',
      entityType: 'user',
      entityId: externalId,
      newData: {
        runId: result.runId,
        rowAction: outcome?.action ?? null,
        userId: user.id,
      },
    })

    return singleRowResponse(result)
  },
)
