"use client";

import { LogoMark, type LogoMarkVariant } from "./LogoMark";
import { Wordmark, type WordmarkVariant } from "./Wordmark";

export type LogoLayout = "horizontal" | "vertical" | "mark-only" | "wordmark-only";
export type LogoTheme = "gradient" | "light" | "dark";

export interface LogoProps {
  size?: number;
  layout?: LogoLayout;
  theme?: LogoTheme;
  tagline?: string;
  className?: string;
}

/**
 * Klinova ana logosu — marka işareti + kelime markası bileşimi.
 * Header/footer/landing/pdf için tek kaynak.
 *
 * @param size - marka işareti px boyutu (varsayılan 48). Kelime markası oran koruyarak ölçeklenir.
 * @param layout - "horizontal" (varsayılan), "vertical", "mark-only", "wordmark-only"
 * @param theme - "gradient" (varsayılan), koyu zeminlerde "light", açık zeminlerde "dark"
 * @param tagline - Logonun altında gösterilecek opsiyonel alt başlık
 */
export function Logo({
  size = 48,
  layout = "horizontal",
  theme = "gradient",
  tagline,
  className,
}: LogoProps) {
  const markVariant: LogoMarkVariant =
    theme === "gradient" ? "gradient" : theme === "light" ? "mono-light" : "mono-dark";

  const wordVariant: WordmarkVariant = theme;

  if (layout === "mark-only") {
    return <LogoMark size={size} variant={markVariant} className={className} />;
  }

  if (layout === "wordmark-only") {
    return <Wordmark size={size * 0.75} variant={wordVariant} className={className} />;
  }

  const isVertical = layout === "vertical";
  const taglineColor = theme === "light" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.6)";

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: isVertical ? "column" : "row",
        alignItems: "center",
        gap: isVertical ? size * 0.25 : size * 0.3,
      }}
    >
      <LogoMark size={size} variant={markVariant} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isVertical ? "center" : "flex-start",
          gap: 2,
        }}
      >
        <Wordmark size={size * 0.85} variant={wordVariant} />
        {tagline ? (
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: size * 0.22,
              fontWeight: 500,
              color: taglineColor,
              letterSpacing: "0.01em",
            }}
          >
            {tagline}
          </span>
        ) : null}
      </div>
    </div>
  );
}
