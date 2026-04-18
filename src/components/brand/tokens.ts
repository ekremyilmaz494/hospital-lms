/**
 * Klinova marka kimliği — tek kaynak (single source of truth).
 * Hem statik SVG logosu hem Remotion animasyonları bu dosyadan beslenir.
 */

export const KLINOVA_COLORS = {
  indigo: "#6366F1",
  indigoDeep: "#4F46E5",
  indigoSoft: "#A5B4FC",
  cyan: "#06B6D4",
  cyanDeep: "#0891B2",
  cyanSoft: "#67E8F9",
  slate: "#0F172A",
  slateMid: "#1E293B",
  surface: "#F8FAFC",
  white: "#FFFFFF",
} as const;

export const KLINOVA_GRADIENT = {
  primary: {
    from: KLINOVA_COLORS.indigo,
    to: KLINOVA_COLORS.cyan,
    angle: 135,
  },
  rich: {
    from: KLINOVA_COLORS.indigoDeep,
    to: KLINOVA_COLORS.cyanDeep,
    angle: 135,
  },
  dark: {
    from: KLINOVA_COLORS.slate,
    to: KLINOVA_COLORS.slateMid,
    angle: 180,
  },
} as const;

export const KLINOVA_TYPOGRAPHY = {
  display: "'Plus Jakarta Sans', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const KLINOVA_BRAND = {
  name: "Klinova",
  tagline: "Sağlık personeli için dijital eğitim platformu",
  domain: "klinova.com",
} as const;

/**
 * CSS için hazır gradient string üretir.
 * @example cssGradient(KLINOVA_GRADIENT.primary) → "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)"
 */
export function cssGradient(
  g: (typeof KLINOVA_GRADIENT)[keyof typeof KLINOVA_GRADIENT],
): string {
  return `linear-gradient(${g.angle}deg, ${g.from} 0%, ${g.to} 100%)`;
}
