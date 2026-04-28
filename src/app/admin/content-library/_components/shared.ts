// ── Klinova Design Tokens (sabit hex'ler — CSS var bypass) ────────────────
// Modal bileşenleri arasında paylaşılan stil token'ları ve tipler.

export const K = {
  PRIMARY: '#0d9668',
  PRIMARY_HOVER: '#087a54',
  PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff',
  BG: '#fafaf9',
  SURFACE_HOVER: '#f5f5f4',
  BORDER: '#c9c4be',
  BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981',
  SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b',
  WARNING_BG: '#fef3c7',
  ERROR: '#ef4444',
  ERROR_BG: '#fee2e2',
  INFO: '#3b82f6',
  INFO_BG: '#dbeafe',
  ACCENT: '#f59e0b',
  VIDEO: '#3b82f6',
  AUDIO: '#f59e0b',
  PDF: '#dc2626',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  SHADOW_HOVER: '0 4px 8px rgba(15, 23, 42, 0.08), 0 16px 40px rgba(15, 23, 42, 0.08)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
} as const

export interface ContentLibraryItem {
  id: string
  title: string
  description: string | null
  category: string
  thumbnailUrl: string | null
  duration: number
  smgPoints: number
  difficulty: string
  targetRoles: string[]
  isActive: boolean
  isInstalled: boolean
  isOwned?: boolean
}
