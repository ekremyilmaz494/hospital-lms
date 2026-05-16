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
