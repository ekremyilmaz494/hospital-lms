/**
 * Wizard ortak tipleri ve sabit Klinova palette'i.
 * 4 step component'i ve ana page.tsx burayı paylaşır.
 */

export interface DeptStaff {
  id: string;
  name: string;
  title: string;
  initials: string;
}

export interface Dept {
  id: string;
  name: string;
  count: number;
  color: string;
  staff: DeptStaff[];
}

export interface VideoItem {
  id: number;
  title: string;
  url: string;
  file?: File;
  contentType: 'video' | 'pdf' | 'audio';
  pageCount?: number;
  durationSeconds?: number;
  documentKey?: string;
  documentFile?: File;
  documentUploading?: boolean;
}

export interface QuestionItem {
  id: number;
  text: string;
  points: number;
  options: string[];
  correct: number;
}

export interface CategoryOption {
  id?: string;
  value: string;
  label: string;
  icon: string;
  color?: string;
}

/** Klinova emerald palette — sabit hex'ler (CSS var bağımlılığını azaltmak için). */
export const K = {
  PRIMARY: '#0d9668',
  PRIMARY_HOVER: '#087a54',
  PRIMARY_LIGHT: '#d1fae5',
  PRIMARY_SOFT: 'rgba(13, 150, 104, 0.08)',
  SURFACE: '#ffffff',
  BG: '#fafaf9',
  BG_SOFT: '#f5f4f1',
  BORDER: '#c9c4be',
  BORDER_SOFT: '#e7e5e0',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981',
  SUCCESS_BG: '#ecfdf5',
  WARNING: '#f59e0b',
  WARNING_BG: '#fffbeb',
  ERROR: '#ef4444',
  ERROR_BG: '#fef2f2',
  INFO: '#3b82f6',
  INFO_BG: '#eff6ff',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
  FONT_MONO: 'var(--font-mono, ui-monospace)',
} as const;

export const cardStyle: React.CSSProperties = {
  background: K.SURFACE,
  border: `1.5px solid ${K.BORDER}`,
  borderRadius: 16,
  padding: 24,
  boxShadow: K.SHADOW_CARD,
};

/**
 * N soruyu 100 puana eşit dağıtır. Yuvarlama artığı son soruya eklenir,
 * böylece toplam her zaman tam 100 olur (örn. 3 soru → 33+33+34).
 */
export const distributePoints = (n: number): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? base + remainder : base));
};

/** Baraj puanı için en az kaç doğru cevap gerektiğini hesaplar. */
export const minCorrectForPassing = (passingScore: number, totalQuestions: number): number => {
  if (totalQuestions <= 0 || passingScore <= 0) return 0;
  return Math.ceil((passingScore / 100) * totalQuestions);
};
