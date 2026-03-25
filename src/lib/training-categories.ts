/**
 * Eğitim kategorileri — tüm uygulama genelinde kullanılan tek kaynak.
 * İleride DB'den veya admin ayarlarından çekilecek şekilde genişletilebilir.
 */
export const TRAINING_CATEGORIES = [
  { value: 'enfeksiyon', label: 'Enfeksiyon' },
  { value: 'is-guvenligi', label: 'İş Güvenliği' },
  { value: 'hasta-haklari', label: 'Hasta Hakları' },
  { value: 'radyoloji', label: 'Radyoloji' },
  { value: 'laboratuvar', label: 'Laboratuvar' },
  { value: 'eczane', label: 'Eczane' },
  { value: 'acil', label: 'Acil Servis' },
  { value: 'genel', label: 'Genel Eğitim' },
] as const;

export type TrainingCategory = typeof TRAINING_CATEGORIES[number]['value'];
