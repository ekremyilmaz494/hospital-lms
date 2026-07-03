import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { checkFeature } from '@/lib/feature-gate'

/**
 * İK/HBYS entegrasyonu — senkron koşusu detayı (hospital-admin).
 *
 * GET → koşu başlığı + satır sonuçları sayfalı (?page&limit&action=error).
 * Org-scope ZORUNLU — başka org'un koşusu 404. payloadMasked zaten KVKK
 * gereği maskeli yazılır (ingest tarafı); burada ek maskeleme gerekmez.
 */

const FEATURE_DISABLED_MSG = 'Personel entegrasyonu planınızda etkin değil.'

const idSchema = z.string().uuid()

// SyncRowAction enum değerleri — geçersiz filtre 400 ile reddedilir.
const actionFilterSchema = z.enum([
  'create', 'update', 'deactivate', 'reactivate', 'skip', 'conflict', 'error',
])

// GET /api/admin/integration/runs/[id] — koşu detayı + satır sonuçları
export const GET = withAdminRoute<{ id: string }>(async ({ request, params, organizationId }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  // Geçersiz UUID → Prisma cast hatasına düşmeden 404 (iç detay sızdırma).
  const parsedId = idSchema.safeParse(params.id)
  if (!parsedId.success) return errorResponse('Senkron koşusu bulunamadı', 404)
  const runId = parsedId.data

  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = safePagination(searchParams, 100)

  const actionParam = searchParams.get('action')
  let actionFilter: z.infer<typeof actionFilterSchema> | undefined
  if (actionParam !== null) {
    const parsedAction = actionFilterSchema.safeParse(actionParam)
    if (!parsedAction.success) return errorResponse('Geçersiz işlem filtresi', 400)
    actionFilter = parsedAction.data
  }

  // Satır sorguları da org-scoped (defense-in-depth) — koşu başka org'a
  // aitse run null döner ve 404 verilir, satırlar zaten sızmaz.
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

  if (!run) return errorResponse('Senkron koşusu bulunamadı', 404)

  return jsonResponse(
    {
      run,
      rows,
      pagination: { page, limit, total: rowTotal, totalPages: Math.ceil(rowTotal / limit) },
    },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })
