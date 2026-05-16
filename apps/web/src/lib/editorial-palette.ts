/**
 * Clinical Editorial Palette — Staff/Admin/Super-Admin paneli için TEK constant kaynağı.
 *
 * ⚠️ ZORUNLU KURAL — YEREL CONSTANT TANIMI YASAK
 * ==============================================
 * `src/app/{staff,admin,super-admin,help}/**` altındaki TÜM sayfa dosyaları
 * renk/font constant'larını bu dosyadan IMPORT ETMEK ZORUNDA.
 *
 * YANLIŞ:                          DOĞRU:
 *   const CREAM = '#f4ead5'          import { CREAM } from '@/lib/editorial-palette'
 *   const INK = '#0a1628'
 *   const FONT_MONO = 'var(...)'
 *
 * Neden? Yerel tanım = her sayfa kendi kopyasını tutar. Renk güncellenirse
 * 13 sayfa ayrı ayrı düzeltilmeli → biri unutulur → tutarsızlık. 2026-04-22
 * bu tuzağa düşüldü (10 sayfa farklı cream fallback'iyle seam yarattı).
 *
 * Guard: `scripts/editorial-palette-guard.sh` CI'da ve lint-staged'da çalışır.
 * Yerel constant tanımı varsa commit bloklanır.
 *
 * Light mode: cream paper, ink text, gold accent. Dark mode: midnight
 * newsprint (cream↔ink flip).
 *
 * Chrome dosyaları (`components/layouts/**` — topbar/sidebar/drawer/bottom-nav)
 * istisna: bilinçli olarak hex sabit kullanırlar (dark mode flip olmasın diye).
 * Memory: feedback_editorial_palette.md.
 */

/* ── Core palette ─────────────────────────────────────── */
export const INK = 'var(--ed-ink, #0a1628)';
export const INK_SOFT = 'var(--ed-ink-soft, #5b6478)';
export const CREAM = 'var(--ed-cream, #f4ead5)';
export const GOLD = 'var(--ed-gold, #c9a961)';
export const RULE = 'var(--ed-rule, #e0d7c0)';
export const OLIVE = 'var(--ed-olive, #1a3a28)';

/* ── Gold alpha variants (globals.css'de tanımlı) ─────── */
export const GOLD_A10 = 'var(--ed-gold-a10, #c9a9611a)';
export const GOLD_A20 = 'var(--ed-gold-a20, #c9a96133)';
export const GOLD_A33 = 'var(--ed-gold-a33, #c9a96155)';

/* ── Kart zemin: cream page üzerinde beyaz print ─────── */
export const CARD_BG = '#ffffff';

/* ── Semantic status rozet renkleri ─────────────────────
 * Her sayfa farklı label kullanabilir ("DEVAM" vs "DEVAM EDİYOR") —
 * buradan sadece renk sözlüğü alınır, label yerinde kalır.
 */
export const STATUS_TOKENS = {
  assigned:    { ink: '#1f3a7a', bg: '#eef2fb', dot: '#2c55b8' },
  in_progress: { ink: '#6a4e11', bg: '#fef6e7', dot: '#b4820b' },
  completed:   { ink: '#0a5c37', bg: '#e8f5ec', dot: '#0a7a47' },
  failed:      { ink: '#7a1e18', bg: '#fdf5f2', dot: '#b3261e' },
  neutral:     { ink: '#5b6478', bg: '#f5f0e6', dot: '#9aa3b8' },
} as const;

/* ── Tone tokens — alert banner / danger / success bg'ler ── */
export const TONE_TOKENS = {
  danger:  { bg: '#fdf5f2', border: '#b3261e', ink: '#7a1e18' },
  warning: { bg: '#fef6e7', border: '#b4820b', ink: '#6a4e11' },
  info:    { bg: '#eef2fb', border: '#2c55b8', ink: '#1f3a7a' },
  success: { bg: '#e8f5ec', border: '#0a7a47', ink: '#0a5c37' },
} as const;

/* ── Font stack'leri — Tailwind config'deki gerçek isimler ── */
export const FONT_DISPLAY = 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif';
export const FONT_BODY = 'var(--font-inter), Inter, system-ui, sans-serif';
export const FONT_MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

/* ── Tipografi clamp token tablosu ──────────────────────
 * Mobil → masaüstü smooth scale. Editorial primitive'ler ve sayfa-seviyesi
 * başlıklar buradan tüketmeli — sabit `font-size: 17px` yerine `FONT_SIZE.h3`.
 *
 * Min değer 375px iPhone SE'de okunaklılığı, max değer ≥1280px masaüstünde
 * dergi-hiyerarşisini korur. Body 16px tabanı iOS otomatik zoom riskini de azaltır.
 */
export const FONT_SIZE = {
  h1:      'clamp(1.5rem, 3vw + 0.5rem, 2.5rem)',     // 24 → 40
  h2:      'clamp(1.125rem, 1.5vw + 0.25rem, 1.75rem)', // 18 → 28
  h3:      'clamp(1rem, 1vw + 0.25rem, 1.25rem)',      // 16 → 20
  h4:      'clamp(0.9375rem, 0.5vw + 0.5rem, 1.0625rem)', // 15 → 17
  body:    'clamp(0.9375rem, 0.25vw + 0.5rem, 1rem)',  // 15 → 16
  caption: 'clamp(0.75rem, 0.15vw + 0.5rem, 0.8125rem)', // 12 → 13
  metric:  'clamp(1.5rem, 2vw + 0.75rem, 2.25rem)',    // 24 → 36 (KPI)
} as const;
