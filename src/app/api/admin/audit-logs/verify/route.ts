import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, computeAuditHash } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'

/**
 * GET /api/admin/audit-logs/verify
 * Verifies the hash chain integrity of all audit logs for the organization.
 * Reads logs in batches of 1000 using cursor pagination for scalability.
 * Rate limited: 1 request per 5 minutes per organization.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const organizationId = dbUser!.organizationId
  if (!organizationId) {
    return errorResponse('Kurum bilgisi bulunamadi', 400)
  }

  // Rate limiting: 1 request per 5 minutes per org
  const rateLimited = await checkRateLimit(`audit-verify:${organizationId}`, 1, 300)
  if (rateLimited) {
    return errorResponse('Bu islem 5 dakikada bir yapilabilir. Lutfen bekleyin.', 429)
  }

  try {
    const BATCH_SIZE = 1000
    let totalRecords = 0
    let previousHash: string | null = null

    const selectFields = {
      id: true,
      hash: true,
      prevHash: true,
      action: true,
      entityType: true,
      entityId: true,
      userId: true,
      createdAt: true,
    } as const

    // First batch (no cursor)
    let batch = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: selectFields,
      take: BATCH_SIZE,
    })

    while (batch.length > 0) {
      for (const record of batch) {
        totalRecords++

        // Skip records without hash (created before hash chaining was enabled)
        if (!record.hash) {
          previousHash = null
          continue
        }

        // Verify prevHash links to previous record's hash
        if (record.prevHash !== previousHash) {
          return jsonResponse({
            verified: false,
            brokenAt: { id: record.id, createdAt: record.createdAt },
            totalRecords,
          })
        }

        // Recalculate hash and compare
        const expectedHash = computeAuditHash({
          prevHash: record.prevHash,
          action: record.action,
          entityType: record.entityType,
          entityId: record.entityId,
          userId: record.userId,
          createdAt: record.createdAt.toISOString(),
        })

        if (expectedHash !== record.hash) {
          return jsonResponse({
            verified: false,
            brokenAt: { id: record.id, createdAt: record.createdAt },
            totalRecords,
          })
        }

        previousHash = record.hash
      }

      // If batch was smaller than BATCH_SIZE, we've reached the end
      if (batch.length < BATCH_SIZE) break

      const lastId = batch[batch.length - 1].id

      // Next batch using cursor pagination
      batch = await prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
        select: selectFields,
        take: BATCH_SIZE,
        skip: 1,
        cursor: { id: lastId },
      })
    }

    return jsonResponse({ verified: true, totalRecords }, 200, {
      'Cache-Control': 'private, no-store',
    })
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AuditVerify] Chain verification failed:', err)
    }
    return errorResponse('Dogrulama sirasinda bir hata olustu', 500)
  }
}
