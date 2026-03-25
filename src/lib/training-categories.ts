/**
 * Eğitim kategorileri — tüm uygulama genelinde kullanılan tek kaynak.
 * İleride DB'den veya admin ayarlarından çekilecek şekilde genişletilebilir.
 */
export const TRAINING_CATEGORIES = [
  { value: 'enfeksiyon', label: 'Enfeksiyon', icon: '🦠' },
  { value: 'is-guvenligi', label: 'İş Güvenliği', icon: '👷' },
  { value: 'hasta-haklari', label: 'Hasta Hakları', icon: '🪪' },
  { value: 'radyoloji', label: 'Radyoloji', icon: '☢️' },
  { value: 'laboratuvar', label: 'Laboratuvar', icon: '🔬' },
  { value: 'eczane', label: 'Eczane', icon: '💊' },
  { value: 'acil', label: 'Acil Servis', icon: '🚑' },
  { value: 'genel', label: 'Genel Eğitim', icon: '📚' },
] as const;

export type TrainingCategory = typeof TRAINING_CATEGORIES[number]['value'];
