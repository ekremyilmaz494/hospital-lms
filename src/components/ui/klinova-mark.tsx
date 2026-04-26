"use client"

import React from "react"

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

export const KlinovaMark: React.FC<KlinovaMarkProps> = ({
  width = 360,
  height = 80,
  showLabel = false,
  baseColor = "#ecfdf5",
  gradientColors = ["#a7f3d000", "#6ee7b7", "#a7f3d000"],
  animationDuration = 3.6,
  labelColor = "#a7f3d0",
  className,
}) => {
  const fontSize = Math.round(height * 0.78)
  const shineColor = gradientColors[1] ?? "#6ee7b7"
  const id = React.useId().replace(/:/g, "")

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "baseline",
        }}
      >
        <span
          aria-label="Klinova"
          className={`klinova-wordmark-${id}`}
          style={{
            fontFamily: "var(--font-editorial), Georgia, 'Times New Roman', serif",
            fontWeight: 400,
            fontStyle: "italic",
            fontSize,
            letterSpacing: "-0.01em",
            lineHeight: 1,
            color: baseColor,
            display: "inline-block",
            position: "relative",
          }}
        >
          Klinova
        </span>
        {/* Premium serif accent — small dot after the wordmark */}
        <span
          style={{
            display: "inline-block",
            width: Math.max(5, Math.round(fontSize * 0.09)),
            height: Math.max(5, Math.round(fontSize * 0.09)),
            borderRadius: "9999px",
            background: shineColor,
            marginLeft: Math.round(fontSize * 0.08),
            boxShadow: `0 0 12px ${shineColor}aa`,
            transform: `translateY(-${Math.round(fontSize * 0.05)}px)`,
          }}
        />

        <style>{`
          .klinova-wordmark-${id} {
            background-image: linear-gradient(
              105deg,
              ${baseColor} 0%,
              ${baseColor} 40%,
              ${shineColor} 47%,
              #ffffff 50%,
              ${shineColor} 53%,
              ${baseColor} 60%,
              ${baseColor} 100%
            );
            background-size: 300% 100%;
            background-position: 150% 50%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            animation: klinova-shine-${id} ${animationDuration}s linear infinite;
            text-shadow: 0 1px 2px rgba(0,0,0,0.18);
            filter: drop-shadow(0 0 18px ${shineColor}55);
          }
          @keyframes klinova-shine-${id} {
            0%   { background-position: 150% 50%; }
            70%  { background-position: -50% 50%; }
            100% { background-position: -50% 50%; }
          }
        `}</style>
      </div>

      {/* Hairline rule with refined uppercase tag */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 2 }}>
        <span
          style={{
            display: "inline-block",
            width: 36,
            height: 1,
            background: `linear-gradient(90deg, ${labelColor}cc, transparent)`,
          }}
        />
        {showLabel && (
          <span
            style={{
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.42em",
              color: labelColor,
              textTransform: "uppercase",
            }}
          >
            Hospital Suite
          </span>
        )}
      </div>
    </div>
  )
}
