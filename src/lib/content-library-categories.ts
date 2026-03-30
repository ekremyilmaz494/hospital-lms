/** Hastane personeline yönelik hazır içerik kütüphanesi kategori tanımları. */
export const CONTENT_LIBRARY_CATEGORIES = {
  INFECTION_CONTROL:    { label: 'Enfeksiyon Kontrolü',  color: 'var(--color-error)' },
  FIRE_SAFETY:          { label: 'Yangın Güvenliği',      color: 'var(--color-warning)' },
  PATIENT_RIGHTS:       { label: 'Hasta Hakları',         color: 'var(--color-info)' },
  KVKK:                 { label: 'KVKK',                  color: 'var(--color-primary)' },
  OCCUPATIONAL_HEALTH:  { label: 'İş Sağlığı',            color: 'var(--color-accent)' },
  FIRST_AID:            { label: 'İlk Yardım',            color: 'var(--color-success)' },
  MEDICAL_WASTE:        { label: 'Tıbbi Atık',            color: '#8b5cf6' },
  HAND_HYGIENE:         { label: 'El Hijyeni',            color: '#06b6d4' },
  WORKPLACE_VIOLENCE:   { label: 'Şiddet Önleme',         color: '#f43f5e' },
  EMERGENCY_PROCEDURES: { label: 'Acil Prosedürler',      color: '#64748b' },
} as const

export type ContentLibraryCategoryKey = keyof typeof CONTENT_LIBRARY_CATEGORIES

export const CONTENT_LIBRARY_DIFFICULTY = {
  BASIC:        { label: 'Temel',   color: 'var(--color-success)' },
  INTERMEDIATE: { label: 'Orta',    color: 'var(--color-warning)' },
  ADVANCED:     { label: 'İleri',   color: 'var(--color-error)' },
} as const

export type ContentLibraryDifficulty = keyof typeof CONTENT_LIBRARY_DIFFICULTY

export const CONTENT_LIBRARY_TARGET_ROLES = [
  { value: 'all',          label: 'Tüm Personel' },
  { value: 'doctor',       label: 'Doktor' },
  { value: 'nurse',        label: 'Hemşire' },
  { value: 'health_staff', label: 'Diğer Sağlık Personeli' },
  { value: 'admin_staff',  label: 'İdari Personel' },
] as const
