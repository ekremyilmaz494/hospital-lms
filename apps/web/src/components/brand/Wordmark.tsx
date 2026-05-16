"use client";

import { useId } from "react";
import { KLINOVA_COLORS, KLINOVA_TYPOGRAPHY } from "./tokens";

export type WordmarkVariant = "gradient" | "light" | "dark";

export interface WordmarkProps {
  size?: number;
  variant?: WordmarkVariant;
  className?: string;
}

/**
 * Klinova kelime markası — Plus Jakarta Sans ile özel tipografi.
 * "Klin" normal ağırlık, "ova" biraz daha açık — kalın/ince kontrastı ile okunaklılık.
 *
 * @param size - px cinsinden yazı boyutu (varsayılan 40)
 * @param variant - "gradient" (varsayılan), "light" koyu zeminler, "dark" açık zeminler için
 */
export function Wordmark({ size = 40, variant = "gradient", className }: WordmarkProps) {
  const uid = useId();
  const gradId = `klinova-word-grad-${uid}`;

  const fill =
    variant === "gradient"
      ? `url(#${gradId})`
      : variant === "light"
        ? KLINOVA_COLORS.surfaceWhite
        : KLINOVA_COLORS.LEGACY_slate;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 64"
      height={size}
      width={size * (280 / 64)}
      role="img"
      aria-label="Klinova"
      className={className}
    >
      <title>Klinova</title>

      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={KLINOVA_COLORS.LEGACY_indigo} />
          <stop offset="100%" stopColor={KLINOVA_COLORS.LEGACY_cyan} />
        </linearGradient>
      </defs>

      <text
        x="0"
        y="48"
        fill={fill}
        style={{
          fontFamily: KLINOVA_TYPOGRAPHY.display,
          fontSize: "52px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
        }}
      >
        Klin
      </text>
      <text
        x="96"
        y="48"
        fill={fill}
        style={{
          fontFamily: KLINOVA_TYPOGRAPHY.display,
          fontSize: "52px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          opacity: 0.92,
        }}
      >
        ova
      </text>
    </svg>
  );
}
