/**
 * Çoklu sektör desteği — her organization bir sektöre bağlı. UI/sözcük seçimi
 * (örn. "personel" vs. "çalışan", "hastane" vs. "kurum") sektöre göre değişebilir.
 */
export const SECTORS = [
  'healthcare',
  'manufacturing',
  'hotel',
  'education',
  'retail',
  'finance',
  'logistics',
  'other',
] as const

export type Sector = (typeof SECTORS)[number]

export const SECTOR_LABELS_TR: Record<Sector, string> = {
  healthcare: 'Sağlık',
  manufacturing: 'Üretim/Sanayi',
  hotel: 'Otel/Turizm',
  education: 'Eğitim',
  retail: 'Perakende',
  finance: 'Finans',
  logistics: 'Lojistik',
  other: 'Diğer',
}

export function isSector(value: unknown): value is Sector {
  return typeof value === 'string' && (SECTORS as readonly string[]).includes(value)
}
