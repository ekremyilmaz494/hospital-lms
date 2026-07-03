/**
 * GET /api/integration/v1/sync-runs/[id] — senkron koşusu durumu (M2M push).
 *
 * Partner sistemi, POST /sync veya /staff yanıtındaki `runId` ile koşunun
 * başlığını + satır sonuçlarını sayfalı sorgular (`?page&limit&action=error`).
 * Org-scope ZORUNLU — başka org'un koşusu 404. payloadMasked ingest tarafında
 * zaten KVKK-maskeli yazılır. Auth/rate-limit/lisans/feature `withIntegrationRoute`'ta.
 */
import { prisma } from '@/lib/prisma'
import { withIntegrationRoute } from '@/lib/integration/route-handler'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { syncRunIdSchema, rowActionFilterSchema } from '@/lib/integration/schemas'
import type { z } from 'zod/v4'

const NOT_FOUND_MESSAGE = 'Senkron koşusu bulunamadı'
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 500

/** Sayfalama parametresini [1, max] aralığına indirger (eksik/bozuk değer → fallback). */
function clampPageParam(raw: string | null, fallback: number, max: number): number {
  if (raw === null || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n), 1), max)
}

export const GET = withIntegrationRoute<{ id: string }>(
  async ({ request, params, organizationId }) => {
    // Geçersiz UUID → Prisma cast hatasına düşmeden 404 (iç detay sızdırma yok).
    const parsedId = syncRunIdSchema.safeParse(params.id)
    if (!parsedId.success) return errorResponse(NOT_FOUND_MESSAGE, 404)
    const runId = parsedId.data

    const { searchParams } = new URL(request.url)
    const page = clampPageParam(searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER)
    const limit = clampPageParam(searchParams.get('limit'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    const skip = (page - 1) * limit

    const actionParam = searchParams.get('action')
    let actionFilter: z.infer<typeof rowActionFilterSchema> | undefined
    if (actionParam !== null) {
      const parsedAction = rowActionFilterSchema.safeParse(actionParam)
      if (!parsedAction.success) return errorResponse('Geçersiz işlem filtresi', 400)
      actionFilter = parsedAction.data
    }

    // Satır sorguları da org-scoped (defense-in-depth) — koşu başka org'a aitse
    // run null döner ve 404 verilir, satırlar zaten sızmaz.
    const rowWhere = {
      syncRunId: runId,
      organizationId,
      ...(actionFilter ? { action: actionFilter } : {}),
    }

    const [run, rowTotal, rows] = await Promise.all([
      prisma.syncRun.findFirst({
        where: { id: runId, organizationId },
        select: {
          id: true,
          integrationId: true,
          channel: true,
          trigger: true,
          mode: true,
          syncMode: true,
          status: true,
          totalRows: true,
          createdRows: true,
          updatedRows: true,
          deactivatedRows: true,
          reactivatedRows: true,
          skippedRows: true,
          failedRows: true,
          errorSummary: true,
          fileName: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.syncRowResult.count({ where: rowWhere }),
      prisma.syncRowResult.findMany({
        where: rowWhere,
        select: {
          id: true,
          rowIndex: true,
          externalId: true,
          action: true,
          userId: true,
          message: true,
          payloadMasked: true,
          createdAt: true,
        },
        orderBy: { rowIndex: 'asc' },
        skip,
        take: limit,
      }),
    ])

    if (!run) return errorResponse(NOT_FOUND_MESSAGE, 404)

    return jsonResponse(
      {
        run,
        rows,
        pagination: { page, limit, total: rowTotal, totalPages: Math.ceil(rowTotal / limit) },
      },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    )
  },
  { idempotency: false },
)
