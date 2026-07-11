/**
 * Grup drill-in yetki sınırı — sunucu tarafı DB kontrolü.
 *
 * Grup yöneticisi (esas yönetici) yalnız KENDİ grubundaki bir hastaneye girip yazabilir.
 * acting-org cookie'si HMAC-imzalı + uid-bağlı olsa da, hedef org'un gerçekten owner'ın
 * grubuna ait olduğunu her /api/admin isteğinde DB'den doğrularız (savunma katmanı: org
 * gruptan çıkarılırsa aktif drill-in cookie'si en fazla 30s içinde geçersizleşir).
 *
 * 30s in-memory cache (authCache ile aynı tolerans) → sıcak yolda DB sorgusu yığılmaz.
 *
 * prisma LAZY import edilir (fonksiyon içinde): api-handler bu modülü import ettiği için,
 * top-level `import prisma` api-handler'ın modül-yükünü prisma'ya bağlar ve api-helpers'ı
 * mock'layıp prisma'yı mock'lamayan mevcut route testlerini kırardı (DATABASE_URL yok → throw).
 */
const membershipCache = new Map<string, { belongs: boolean; expires: number }>()
const TTL_MS = 30_000

export async function orgInOwnerGroup(orgId: string, groupId: string, nowMs = Date.now()): Promise<boolean> {
  const key = `${orgId}:${groupId}`
  const hit = membershipCache.get(key)
  if (hit && hit.expires > nowMs) return hit.belongs

  const { prisma } = await import('@/lib/prisma')
  const found = await prisma.organization.findFirst({
    where: { id: orgId, groupId },
    select: { id: true },
  })
  const belongs = found !== null
  membershipCache.set(key, { belongs, expires: nowMs + TTL_MS })
  return belongs
}

/** Cache'i temizle (org gruptan çıkarılınca / test). */
export function invalidateGroupMembershipCache(): void {
  membershipCache.clear()
}
