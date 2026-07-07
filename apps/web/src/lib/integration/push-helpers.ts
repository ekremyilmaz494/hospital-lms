/**
 * İnbound push REST rotalarının (`/api/integration/v1`) ortak yardımcıları.
 *
 * route.ts dosyaları YALNIZ handler + Next route config export edebilir
 * (helper export'u `next build`'i kırar — bilinen incident) → rotalar arası
 * paylaşılan mantık burada yaşar.
 */
import { prisma } from '@/lib/prisma'
import { ApiError, jsonResponse } from '@/lib/api-helpers'
import type { StaffRecord, SyncResult, SyncRowOutcome } from './types'

/** Org'un push kanalı konfigürasyonu (yoksa null — API anahtarı tek başına yeterli). */
export interface PushIntegrationConfig {
  id: string
  fieldMapping: Record<string, string> | null
  defaults: Partial<StaffRecord> | null
  deactivateMissing: boolean
  deactivateThresholdPct: number
}

/** Prisma Json alanını düz objeye indirger (dizi/primitive → null). */
function asJsonObject<T>(value: unknown): T | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as T)
    : null
}

/**
 * Org'un `StaffIntegration` channel='push' kaydını okur.
 *
 * - Kayıt yok → `null` (config zorunlu değil; kimliksel eşleme + null integrationId).
 * - Kayıt var ama `isActive=false` → kanal bilinçli kapatılmış → 403.
 *
 * @throws {ApiError} 403 — push kanalı devre dışı bırakılmışsa
 */
export async function getPushConfig(organizationId: string): Promise<PushIntegrationConfig | null> {
  const config = await prisma.staffIntegration.findUnique({
    where: { organizationId_channel: { organizationId, channel: 'push' } },
    select: {
      id: true,
      isActive: true,
      fieldMapping: true,
      defaults: true,
      deactivateMissing: true,
      deactivateThresholdPct: true,
    },
  })
  if (!config) return null
  if (!config.isActive) {
    throw new ApiError('Push entegrasyon kanalı devre dışı. Yönetici panelinden etkinleştirilmesi gerekir.', 403)
  }
  return {
    id: config.id,
    fieldMapping: asJsonObject<Record<string, string>>(config.fieldMapping),
    defaults: asJsonObject<Partial<StaffRecord>>(config.defaults),
    deactivateMissing: config.deactivateMissing,
    deactivateThresholdPct: config.deactivateThresholdPct,
  }
}

/**
 * Tek satırlık `runSync` sonucunu HTTP yanıtına çevirir
 * (staff POST / PATCH / DELETE ortak yanıt deseni).
 *
 * - `create` → 201, diğer uygulanan aksiyonlar (update/skip/deactivate/reactivate) → 200
 * - `error` | `conflict` → 422 (mesaj + details.runId/action)
 *
 * @throws {ApiError} 422 — satır hata/çakışmayla sonuçlandıysa
 * @throws {ApiError} 500 — koşu satır sonucu üretmediyse (beklenmez)
 */
export function singleRowResponse(result: SyncResult): Response {
  const outcome: SyncRowOutcome | undefined = result.rowResults[0]
  if (!outcome) {
    throw new ApiError('Senkron sonucu okunamadı. Lütfen tekrar deneyin.', 500, { runId: result.runId })
  }
  if (outcome.action === 'error' || outcome.action === 'conflict') {
    throw new ApiError(outcome.message ?? 'Kayıt işlenemedi', 422, {
      runId: result.runId,
      action: outcome.action,
    })
  }
  return jsonResponse(
    {
      runId: result.runId,
      action: outcome.action,
      ...(outcome.userId ? { userId: outcome.userId } : {}),
      ...(outcome.message ? { message: outcome.message } : {}),
    },
    outcome.action === 'create' ? 201 : 200,
  )
}
