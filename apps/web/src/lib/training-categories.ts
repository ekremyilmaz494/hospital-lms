/**
 * Eğitim kategorileri — tüm uygulama genelinde kullanılan tek kaynak.
 * İleride DB'den veya admin ayarlarından çekilecek şekilde genişletilebilir.
 *
 * `icon` alanı Lucide ikon adıdır — <CategoryIcon> bileşeni ile render edilir.
 * `color` alanı her kategorinin marka rengidir.
 */
export const TRAINING_CATEGORIES = [
  { value: 'enfeksiyon', label: 'Enfeksiyon', icon: 'Shield', color: '#ef4444' },
  { value: 'is-guvenligi', label: 'İş Güvenliği', icon: 'HardHat', color: '#f59e0b' },
  { value: 'hasta-haklari', label: 'Hasta Hakları', icon: 'HeartHandshake', color: '#3b82f6' },
  { value: 'radyoloji', label: 'Radyoloji', icon: 'Radiation', color: '#a855f7' },
  { value: 'laboratuvar', label: 'Laboratuvar', icon: 'Microscope', color: '#06b6d4' },
  { value: 'eczane', label: 'Eczane', icon: 'Pill', color: '#ec4899' },
  { value: 'acil', label: 'Acil Servis', icon: 'Siren', color: '#dc2626' },
  { value: 'genel', label: 'Genel Eğitim', icon: 'BookOpen', color: '#0d9668' },
] as const;

export type TrainingCategory = typeof TRAINING_CATEGORIES[number]['value'];

/** Eşleşmeyen / silinmiş kategori için kullanılan etiket. */
export const UNCATEGORIZED_LABEL = 'Kategorisiz';
const UNCATEGORIZED_COLOR = '#78716c'; // nötr/muted

// Org'a özel (admin'in elle eklediği) kategorilerin DB'de renk kolonu yok —
// slug'dan deterministik, sabit ve birbirinden ayırt edilebilir renk üret.
const CATEGORY_PALETTE = [
  '#ef4444', '#f59e0b', '#3b82f6', '#a855f7', '#06b6d4',
  '#ec4899', '#dc2626', '#0891b2', '#7c3aed', '#0d9668',
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function paletteColor(slug: string): string {
  return CATEGORY_PALETTE[hashSlug(slug) % CATEGORY_PALETTE.length];
}

export interface CategoryMeta {
  value: string | null;
  label: string;
  color: string;
  isOrphan: boolean;
}

/**
 * Bir eğitimin `category` slug'ını gösterilebilir meta'ya (etiket + renk) çözer.
 *
 * `Training.category` bir string slug'dır (FK değil) — bir kategori silinince
 * eğitimde orphan slug kalır. Bu resolver:
 *  - yerleşik varsayılanları kendi marka renkleriyle,
 *  - org'a özel (DB) kategorileri slug-hash paletiyle,
 *  - eşleşmeyen/silinmiş veya boş slug'ları "Kategorisiz" olarak
 * döndürür; böylece UI'da liste/filtre/rozet asla kırılmaz.
 *
 * @param dbCategories Org'un güncel kategori listesi (opsiyonel). Verilirse
 *   admin'in yeniden adlandırdığı etiketler, seçtiği renkler ve özel kategoriler de çözülür.
 */
export function resolveCategoryMeta(
  value: string | null | undefined,
  dbCategories?: readonly { value: string; label: string; color?: string | null }[],
): CategoryMeta {
  if (!value) {
    return { value: null, label: UNCATEGORIZED_LABEL, color: UNCATEGORIZED_COLOR, isOrphan: true };
  }

  const db = dbCategories?.find((c) => c.value === value);
  const builtin = TRAINING_CATEGORIES.find((c) => c.value === value);

  if (!db && !builtin) {
    // Silinmiş veya hiç tanınmayan kategori → orphan
    return { value, label: UNCATEGORIZED_LABEL, color: UNCATEGORIZED_COLOR, isOrphan: true };
  }

  // Etiket: admin DB'de yeniden adlandırmış olabilir → DB önceliklidir.
  const label = db?.label ?? builtin!.label;
  // Renk önceliği: admin'in DB'de seçtiği renk → yerleşik marka rengi → slug-hash paleti.
  const color = db?.color ?? builtin?.color ?? paletteColor(value);
  return { value, label, color, isOrphan: false };
}
