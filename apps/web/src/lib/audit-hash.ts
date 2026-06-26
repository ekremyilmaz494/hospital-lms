import { createHash } from 'crypto'

/**
 * Audit log hash zinciri için SHA-256 hash hesaplar (bütünlük/değişmezlik kanıtı).
 *
 * Bağımlılığı YOK (sadece `crypto`) — bilinçli olarak `api-helpers`'tan ayrı tutuldu
 * ki ham `pg` kullanan ops scriptleri (Prisma/Next import etmeden) tek doğruluk
 * kaynağı olan bu fonksiyonu kullanabilsin. Format DEĞİŞMEZ: değişirse mevcut tüm
 * zincir geçersiz olur. Alan sırası ve `?? ''` boş-değer kuralları korunmalıdır.
 */
export function computeAuditHash(fields: {
  prevHash: string | null
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  createdAt: string
}): string {
  const payload = [
    fields.prevHash ?? '',
    fields.action,
    fields.entityType,
    fields.entityId ?? '',
    fields.userId ?? '',
    fields.createdAt,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}
