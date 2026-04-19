/**
 * Klinova marka kimliği — tek kaynak (single source of truth).
 * Hem statik SVG logosu hem Remotion animasyonları hem de landing/admin
 * tüm yüzeyleri bu dosyadan beslenir.
 *
 * Değişiklik notu (v2 — Nisan 2026):
 *  - Ana palet indigo/cyan'dan olive/amber'e taşındı (landing ile hizalandı)
 *  - Eski indigo/cyan değerleri LEGACY_* olarak geriye dönük korunuyor
 *  - Tüm landing inline hex kodları bu dosyadan çekilmeli
 */

export const KLINOVA_COLORS = {
  // ── Primary: Olive (güven, şifa, doğal)
  brand: "#1a3a28",           // olive-900 — ana marka rengi, başlıklar
  brandDeep: "#0d2010",       // olive-950 — dark bg, gradient'in koyu ucu
  brandMid: "#3d5e51",        // olive-600 — body metin, ikinci seviye
  brandSoft: "#A9C4B3",       // olive-300 — pasif durumlar, disabled
  brandTint: "#E4EDE7",       // olive-50 — hover bg, subtle accents

  // ── Accent: Amber (aksiyon, CTA, dikkat)
  accent: "#f59e0b",          // amber-500 — primary CTA
  accentDeep: "#d97706",      // amber-600 — hover/active CTA
  accentSoft: "#FDE68A",      // amber-200 — badge bg, highlight
  accentTint: "#FEF3C7",      // amber-100 — warning/info bg

  // ── Surface
  surface: "#f5f0e6",         // warm beige — landing ana bg
  surfaceWarm: "#EDE7D9",     // beige-mid — kartlar, alternating rows
  surfaceWhite: "#FFFFFF",    // bleach — modal, panel
  surfaceDark: "#0d2010",     // dark mode bg

  // ── Ink (metin hiyerarşisi)
  ink: "#1a3a28",             // birincil metin (= brand)
  inkMid: "#3d5e51",          // ikincil metin
  inkMuted: "#6b7f74",        // üçüncül, placeholder
  inkInverse: "#F5F0E6",      // dark bg üzerinde metin

  // ── Semantik
  success: "#16A34A",
  warning: "#f59e0b",         // = accent
  danger: "#DC2626",
  info: "#0891B2",            // cyan-deep — bilgi iletişimi için korundu

  // ── Legacy (geriye dönük — Remotion videolarında hâlâ kullanılıyor)
  // YENI KOD YAZARKEN BUNLARI KULLANMA.
  LEGACY_indigo: "#6366F1",
  LEGACY_indigoDeep: "#4F46E5",
  LEGACY_cyan: "#06B6D4",
  LEGACY_cyanDeep: "#0891B2",
  LEGACY_slate: "#0F172A",

  // ── Legacy alias'ları (LogoMark, Wordmark, Remotion komponentlerinin eski
  // API'sini kırmamak için). Rebrand öncesi bu isimler doğrudan kullanılıyordu;
  // şimdi yeni kod LEGACY_* veya yeni semantik alanları kullanmalı.
  white: "#FFFFFF",
  slate: "#0F172A",
  slateMid: "#334155",
  indigo: "#6366F1",
  indigoDeep: "#4F46E5",
  indigoSoft: "#C7D2FE",
  cyan: "#06B6D4",
  cyanDeep: "#0891B2",
  cyanSoft: "#A5F3FC",
} as const;

export const KLINOVA_GRADIENT = {
  /** Ana marka gradient'i — logo, hero, öne çıkan kartlar */
  primary: {
    from: KLINOVA_COLORS.brand,
    to: KLINOVA_COLORS.brandDeep,
    angle: 145,
  },
  /** Aksiyon gradient'i — CTA butonları, badge'ler */
  accent: {
    from: KLINOVA_COLORS.accent,
    to: KLINOVA_COLORS.accentDeep,
    angle: 135,
  },
  /** Premium/section-break — olive + amber karışımı */
  rich: {
    from: KLINOVA_COLORS.brand,
    to: KLINOVA_COLORS.accent,
    angle: 135,
  },
  /** Koyu mod / hero fallback zemini */
  dark: {
    from: KLINOVA_COLORS.brandDeep,
    to: "#000000",
    angle: 180,
  },
} as const;

export const KLINOVA_TYPOGRAPHY = {
  display: "'Plus Jakarta Sans', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

/** Chart kütüphaneleri için semantik 5'li palet */
export const KLINOVA_CHART_PALETTE = [
  KLINOVA_COLORS.brand,        // #1a3a28
  KLINOVA_COLORS.accent,       // #f59e0b
  KLINOVA_COLORS.info,         // #0891b2
  KLINOVA_COLORS.danger,       // #dc2626
  KLINOVA_COLORS.brandMid,     // #3d5e51
] as const;

export const KLINOVA_BRAND = {
  name: "Klinova",
  tagline: "Sağlık kurumları için operasyon platformu",
  domain: "klinova.com",
} as const;

/**
 * CSS için hazır gradient string üretir.
 * @example cssGradient(KLINOVA_GRADIENT.primary)
 *   → "linear-gradient(145deg, #1a3a28 0%, #0d2010 100%)"
 */
export function cssGradient(
  g: (typeof KLINOVA_GRADIENT)[keyof typeof KLINOVA_GRADIENT],
): string {
  return `linear-gradient(${g.angle}deg, ${g.from} 0%, ${g.to} 100%)`;
}

/**
 * Tailwind / CSS custom property çıktısı — globals.css'e inject edilir.
 * @example :root { --brand-600: #1a3a28; ... }
 */
export function toCssVars(): string {
  return [
    `--brand: ${KLINOVA_COLORS.brand};`,
    `--brand-deep: ${KLINOVA_COLORS.brandDeep};`,
    `--brand-mid: ${KLINOVA_COLORS.brandMid};`,
    `--brand-soft: ${KLINOVA_COLORS.brandSoft};`,
    `--brand-tint: ${KLINOVA_COLORS.brandTint};`,
    `--accent: ${KLINOVA_COLORS.accent};`,
    `--accent-deep: ${KLINOVA_COLORS.accentDeep};`,
    `--accent-soft: ${KLINOVA_COLORS.accentSoft};`,
    `--surface: ${KLINOVA_COLORS.surface};`,
    `--surface-warm: ${KLINOVA_COLORS.surfaceWarm};`,
    `--ink: ${KLINOVA_COLORS.ink};`,
    `--ink-mid: ${KLINOVA_COLORS.inkMid};`,
    `--ink-muted: ${KLINOVA_COLORS.inkMuted};`,
    `--success: ${KLINOVA_COLORS.success};`,
    `--warning: ${KLINOVA_COLORS.warning};`,
    `--danger: ${KLINOVA_COLORS.danger};`,
    `--info: ${KLINOVA_COLORS.info};`,
  ].join("\n  ");
}
