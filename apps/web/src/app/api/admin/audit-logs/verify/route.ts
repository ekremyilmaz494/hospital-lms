import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, computeAuditHash } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/audit-logs/verify
 * Verifies the hash chain integrity of all audit logs for the organization.
 * Reads logs in batches of 1000 using cursor pagination for scalability.
 * Rate limited: 1 request per 5 minutes per organization.
 */
export const GET = withAdminRoute(async ({ organizationId }) => {
  // Rate limiting: 1 request per 5 minutes per org.
  // checkRateLimit → true = İZİNLİ, false = limit aşıldı (redis.ts). Diğer tüm
  // çağrı yerleriyle aynı: `if (!allowed)`. (Eski hali ters olduğu için ilk çağrı
  // her zaman 429 dönüyordu — doğrulama butonu ilk tıklamada kırıktı.)
  const allowed = await checkRateLimit(`audit-verify:${organizationId}`, 1, 300)
  if (!allowed) {
    return errorResponse('Bu işlem 5 dakikada bir yapılabilir. Lütfen bekleyin.', 429)
  }

  try {
    const BATCH_SIZE = 1000
    let totalRecords = 0
    let previousHash: string | null = null
    // Zinciri kuran sırayla AYNI deterministik sıra: [createdAt asc, id asc].
    // (id tie-breaker'ı, aynı milisaniyedeki geçmiş kayıtların rastgele sıralanıp
    //  zinciri yanlışlıkla "bozuk" göstermesini engeller.)
    const chainOrder = [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
    // İlk hash'li kayıt "çapa"dır: prevHash bağı kontrol edilmez. Böylece 1 yıllık
    // audit rotasyonu (cron) zincirin BAŞINI silse de doğrulama "bozuk" demez —
    // kalan kayıtlar yine kendi hash'leri + aralarındaki bağ ile tamper-evident kalır.
    // Zincirin ORTASINDAN bir kayıt silinir/değiştirilirse yine yakalanır.
    let anchored = false

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

    const broken = (record: { id: string; createdAt: Date }) =>
      jsonResponse({
        verified: false,
        brokenAt: { id: record.id, createdAt: record.createdAt },
        totalRecords,
      })

    // First batch (no cursor)
    let batch = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: chainOrder,
      select: selectFields,
      take: BATCH_SIZE,
    })

    while (batch.length > 0) {
      for (const record of batch) {
        totalRecords++

        // Hash'siz kayıtları atla (hash zinciri eklenmeden önce yazılanlar) ve çapayı sıfırla.
        if (!record.hash) {
          previousHash = null
          anchored = false
          continue
        }

        // 1) Bütünlük: kaydın kendi içeriği + sakladığı prevHash'ten hash'i yeniden hesapla.
        const expectedHash = computeAuditHash({
          prevHash: record.prevHash,
          action: record.action,
          entityType: record.entityType,
          entityId: record.entityId,
          userId: record.userId,
          createdAt: record.createdAt.toISOString(),
        })
        if (expectedHash !== record.hash) {
          return broken(record)
        }

        // 2) Bağ: yalnız çapadan SONRA zorunlu (prefix-truncation/rotasyon toleransı).
        if (anchored && record.prevHash !== previousHash) {
          return broken(record)
        }

        previousHash = record.hash
        anchored = true
      }

      // If batch was smaller than BATCH_SIZE, we've reached the end
      if (batch.length < BATCH_SIZE) break

      const lastId = batch[batch.length - 1].id

      // Next batch using cursor pagination (aynı deterministik sıra)
      batch = await prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: chainOrder,
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
    logger.error('AuditVerify', 'Chain verification failed', err)
    return errorResponse('Doğrulama sırasında bir hata oluştu', 500)
  }
}, { requireOrganization: true })
