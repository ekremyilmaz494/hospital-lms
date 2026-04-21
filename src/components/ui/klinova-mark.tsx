"use client"

import React from "react"
import { GradientTracing } from "@/components/ui/gradient-tracing"

interface KlinovaMarkProps {
  width?: number
  height?: number
  showLabel?: boolean
  baseColor?: string
  gradientColors?: [string, string, string]
  animationDuration?: number
  strokeWidth?: number
  labelColor?: string
  className?: string
  drawIn?: boolean
  drawDuration?: number
  glow?: boolean
  glowStrength?: number
}

// Full "KLINOVA" geometric wordmark — each letter as stroked subpaths so the
// gradient tracing sweeps the entire word in one pass (gradient userSpaceOnUse
// covers the bbox; subpath M jumps don't break the visual trace).
//
// Layout on a 360×80 canvas, baseline y=12-72, letter cells ~46px wide + gaps:
//   K @ 10-44 · L @ 56-86 · I @ 100-100 · N @ 114-150 · O @ 162-200 · V @ 212-244 · A @ 256-298
const KLINOVA_PATH = [
  // K
  "M10,12 L10,72",
  "M10,42 L44,12",
  "M10,42 L44,72",
  // L
  "M56,12 L56,72 L86,72",
  // I
  "M100,12 L100,72",
  // N
  "M114,72 L114,12 L150,72 L150,12",
  // O — octagonal stroke (closed-ish polyline)
  "M170,12 L192,12 L200,22 L200,62 L192,72 L170,72 L162,62 L162,22 Z",
  // V
  "M212,12 L228,72 L244,12",
  // A
  "M256,72 L277,12 L298,72",
  "M263,52 L291,52",
].join(" ")

export const KlinovaMark: React.FC<KlinovaMarkProps> = ({
  width = 360,
  height = 80,
  showLabel = false,
  baseColor = "#c9a961",
  gradientColors = ["#c9a96100", "#f59e0b", "#c9a96100"],
  animationDuration = 2.6,
  strokeWidth = 3.5,
  labelColor = "#c9a961",
  className,
  drawIn = true,
  drawDuration = 1.8,
  glow = true,
  glowStrength = 2.2,
}) => {
  return (
    <div className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      <GradientTracing
        width={width}
        height={height}
        baseColor={baseColor}
        gradientColors={gradientColors}
        animationDuration={animationDuration}
        strokeWidth={strokeWidth}
        path={KLINOVA_PATH}
        drawIn={drawIn}
        drawDuration={drawDuration}
        glow={glow}
        glowStrength={glowStrength}
      />
      {showLabel && (
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.34em",
            color: labelColor,
            paddingLeft: 2,
          }}
        >
          KLINOVA
        </span>
      )}
    </div>
  )
}
