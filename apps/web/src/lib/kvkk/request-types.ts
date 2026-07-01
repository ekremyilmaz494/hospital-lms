/**
 * KVKK m.11 hak talebi tipleri ve durumları — TEK doğruluk kaynağı.
 * Staff talep formu (`app/staff/kvkk`), staff/admin API zod şemaları ve admin yanıt paneli
 * (`app/admin/kvkk-requests`) bu sabitleri paylaşır ki tip listesi tek yerden güncellensin.
 */

/** KVKK m.11'deki 9 hak talebi tipi (DB `request_type` değerleri). */
export const KVKK_REQUEST_TYPES = [
  'access', // Verilerimin islenip islenmedigini ogrenme
  'detail', // Islenmisse bilgi talep etme
  'purpose', // Isleme amacini ve amacina uygun kullanilip kullanilmadigini ogrenme
  'third_party', // Ucuncu kisilere aktarilip aktarilmadigini ogrenme
  'correction', // Eksik/yanlis islenmisse duzeltilmesini isteme
  'deletion', // Kisisel verilerin silinmesini/yok edilmesini isteme
  'notification', // Duzeltme/silme islemlerinin ucuncu kisilere bildirilmesini isteme
  'objection', // Otomatik sistemler vasitasiyla aleyhime sonuc cikarilmasina itiraz
  'damage', // Kanuna aykiri isleme sebebiyle zararin giderilmesini talep etme
] as const

export type KvkkRequestType = (typeof KVKK_REQUEST_TYPES)[number]

/**
 * Talep tipi → görünen başlık + açıklama (staff formu ve admin listesinde ortak).
 * `Record<string, ...>` tipi DB'den gelen ham string ile güvenli indexlemeye izin verir
 * (bilinmeyen tip → undefined, çağıran `?.` ile fallback yapar). Anahtar bütünlüğü
 * `satisfies` ile derleme zamanında yine de garanti edilir.
 */
export const KVKK_REQUEST_TYPE_LABELS: Record<string, { label: string; desc: string }> = {
  access: { label: 'Veri Isleme Sorgusu', desc: 'Kisisel verilerimin islenip islenmedigini ogrenmek istiyorum' },
  detail: { label: 'Veri Detay Talebi', desc: 'Islenen kisisel verilerim hakkinda bilgi talep ediyorum' },
  purpose: { label: 'Isleme Amaci Sorgusu', desc: 'Verilerimin isleme amacini ve amacina uygun kullanilip kullanilmadigini ogrenmek istiyorum' },
  third_party: { label: 'Ucuncu Kisi Aktarim Sorgusu', desc: 'Verilerimin ucuncu kisilere aktarilip aktarilmadigini ogrenmek istiyorum' },
  correction: { label: 'Duzeltme Talebi', desc: 'Eksik veya yanlis islenen kisisel verilerimin duzeltilmesini istiyorum' },
  deletion: { label: 'Silme / Yok Etme Talebi', desc: 'Kisisel verilerimin silinmesini veya yok edilmesini talep ediyorum' },
  notification: { label: 'Ucuncu Kisi Bildirim Talebi', desc: 'Duzeltme/silme islemlerinin verilerimin aktarildigi ucuncu kisilere bildirilmesini istiyorum' },
  objection: { label: 'Otomatik Karar Itiraz', desc: 'Otomatik sistemler vasitasiyla aleyhime bir sonuc cikarilmasina itiraz ediyorum' },
  damage: { label: 'Zarar Giderim Talebi', desc: 'Kanuna aykiri isleme nedeniyle ugradim zararin giderilmesini talep ediyorum' },
} satisfies Record<KvkkRequestType, { label: string; desc: string }>

/** KVKK talebinin yaşam döngüsü durumları. */
export const KVKK_REQUEST_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'] as const

export type KvkkRequestStatus = (typeof KVKK_REQUEST_STATUSES)[number]

/** Durum → görünen etiket. */
export const KVKK_STATUS_LABELS: Record<KvkkRequestStatus, string> = {
  pending: 'Beklemede',
  in_progress: 'İşleniyor',
  completed: 'Tamamlandı',
  rejected: 'Reddedildi',
}

/** KVKK başvurusuna yasal yanıt süresi (gün) — KVKK m.13. */
export const KVKK_RESPONSE_SLA_DAYS = 30
