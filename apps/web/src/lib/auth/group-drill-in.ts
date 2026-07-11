/**
 * Grup drill-in yetki sınırı — sunucu tarafı DB kontrolü.
 *
 * Grup yöneticisi (esas yönetici) yalnız KENDİ grubundaki AKTİF (askıya alınmamış) bir
 * hastaneye girip yazabilir. acting-org cookie'si HMAC-imzalı + uid-bağlı olsa da, hedef
 * org'un gerçekten owner'ın grubuna ait OLDUĞUNU ve hâlâ AKTİF olduğunu her /api/admin
 * isteğinde DB'den doğrularız (savunma katmanı).
 *
 * isActive/isSuspended KONTROLÜ ŞART: super_admin bir hastaneyi askıya alınca, o hastanenin
 * KENDİ admin'i checkOrgActive+auth-cache ile ≤30s içinde kilitlenir; drill-in yolu da AYNI
 * kilidi uygulamalı (aksi halde aktif cookie'li grup yöneticisi askıya alınmış hastaneye
 * yazmaya devam ederdi — act-as START zaten askıdaki org'a 409 verir, per-request re-check
 * aynı sınırı korur). belongs → "grupta VE aktif VE askıda değil".
 *
 * 30s in-memory cache (authCache ile aynı tolerans) → sıcak yolda DB sorgusu yığılmaz;
 * askı/aktiflik değişikliği en fazla 30s içinde yansır (sistem normuyla aynı pencere).
 * Org gruptan çıkarılınca da aynı 30s içinde belongs=false olur.
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
    // Grupta + AKTİF + askıda DEĞİL — askıya alınmış hastaneye drill-in reddedilir (org'un
    // kendi admin'iyle aynı kilit; bkz. checkOrgActive/act-as START 409).
    where: { id: orgId, groupId, isActive: true, isSuspended: false },
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
