/**
 * PDF tasarım sistemi — renk paleti, spacing, tipografi sabitleri.
 *
 * Brand primary: #0d9668 (mint teal). Severity renkleri WCAG uyumlu
 * (yeşil/sarı/kırmızı kontrastları 4.5:1 üstü).
 */

export const COLORS = {
  primary:       [13, 150, 104] as [number, number, number],
  primaryDark:   [6, 95, 70] as [number, number, number],
  primaryLight:  [236, 253, 245] as [number, number, number],
  accent:        [245, 158, 11] as [number, number, number],

  // Metin
  textDark:      [15, 23, 42] as [number, number, number],
  textMuted:     [100, 116, 139] as [number, number, number],
  textLight:     [148, 163, 184] as [number, number, number],

  // Severity
  success:       [22, 163, 74] as [number, number, number],
  successBg:     [236, 253, 245] as [number, number, number],
  warning:       [217, 119, 6] as [number, number, number],
  warningBg:     [254, 249, 195] as [number, number, number],
  danger:        [220, 38, 38] as [number, number, number],
  dangerBg:      [254, 242, 242] as [number, number, number],

  // Yüzey
  surface:       [255, 255, 255] as [number, number, number],
  surfaceAlt:    [248, 250, 252] as [number, number, number],
  border:        [226, 232, 240] as [number, number, number],
  borderStrong:  [148, 163, 184] as [number, number, number],
}

export const SPACING = {
  pageMarginX: 18,
  pageMarginTop: 18,
  pageMarginBottom: 20,
  sectionGap: 10,
  lineGap: 6,
}

export const FONT_SIZES = {
  coverTitle: 26,
  coverSubtitle: 14,
  coverMeta: 10,
  sectionTitle: 13,
  bodyLarge: 11,
  body: 9.5,
  small: 8,
  micro: 7,
}

/** Page defaults */
export const PAGE = {
  orientation: 'portrait' as const,
  unit: 'mm' as const,
  format: 'a4' as const,
  width: 210,
  height: 297,
}
