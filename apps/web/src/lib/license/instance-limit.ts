/**
 * Lisans instance (klon) limiti — gelir koruma.
 *
 * Bir lisans dosyası N sunucuya kopyalanıp her birinde çalıştırılabilir. Heartbeat ucu
 * son 24 saatte kaç FARKLI instance'ın aynı lisansla yaşadığını bilir; bu sayı imzalı
 * `limits.maxInstances`'ı aşarsa makbuz `revoked` döner ve client `state.ts` bunu LOCKED'a
 * çevirir (mevcut revoked→LOCKED yolu; ek client değişikliği gerekmez).
 *
 * KISIT: bu HARD zorlama yalnız KISITLI-ÇIKIŞ modunda (heartbeat lisans sunucusuna ulaşır)
 * işler. TAM air-gap'te heartbeat yoktur → klon-limiti online zorlanamaz; gelir kapısı
 * offline-makbuz-süresidir (mevcut). maxInstances yok/null → sınırsız (eski lisanslar bozulmaz).
 */
export type ReceiptStatus = 'valid' | 'revoked'

export interface ReceiptStatusDecision {
  status: ReceiptStatus
  /** Limit aşıldığı için mi kilitlendi (audit/log ayrımı için). */
  overLimit: boolean
}

/**
 * Heartbeat makbuz durumunu belirler.
 * @param licenseStatus  DB'deki lisans durumu (revoked = kalıcı iptal).
 * @param distinctInstanceCount  Son 24 saatte görülen farklı instance sayısı (mevcut dahil).
 * @param maxInstances  İmzalı limit (undefined=eski lisans, null=sınırsız, sayı=zorla).
 */
export function resolveReceiptStatus(
  licenseStatus: string,
  distinctInstanceCount: number,
  maxInstances: number | null | undefined,
): ReceiptStatusDecision {
  const overLimit = typeof maxInstances === 'number' && distinctInstanceCount > maxInstances
  const status: ReceiptStatus = licenseStatus === 'revoked' || overLimit ? 'revoked' : 'valid'
  return { status, overLimit }
}
