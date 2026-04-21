"use client"

import React, { useId } from "react"
import { motion } from "framer-motion"

interface GradientTracingProps {
  width: number
  height: number
  baseColor?: string
  gradientColors?: [string, string, string]
  animationDuration?: number
  strokeWidth?: number
  path?: string
  className?: string
  /** Animate the path drawing itself in on mount (stroke reveal). */
  drawIn?: boolean
  /** Seconds for the initial draw-in animation. */
  drawDuration?: number
  /** Add a soft Gaussian-blur glow behind the gradient stroke. */
  glow?: boolean
  /** Glow strength (stdDeviation for the blur). */
  glowStrength?: number
}

export const GradientTracing: React.FC<GradientTracingProps> = ({
  width,
  height,
  baseColor = "black",
  gradientColors = ["#2EB9DF", "#2EB9DF", "#9E00FF"],
  animationDuration = 2,
  strokeWidth = 2,
  path = `M0,${height / 2} L${width},${height / 2}`,
  className,
  drawIn = false,
  drawDuration = 1.8,
  glow = false,
  glowStrength = 2.5,
}) => {
  const reactId = useId()
  const safeId = reactId.replace(/[^a-zA-Z0-9]/g, "")
  const gradientId = `pulse-${safeId}`
  const filterId = `glow-${safeId}`

  // After draw-in completes, delay the gradient sweep so it kicks in just as the
  // line finishes drawing. drawDuration * 0.55 ≈ overlap a bit for a smooth handoff.
  const sweepDelay = drawIn ? drawDuration * 0.55 : 0

  return (
    <div className={className} style={{ width, height, position: "relative" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        style={{ overflow: "visible" }}
      >
        <defs>
          {glow && (
            <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation={glowStrength} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          <motion.linearGradient
            animate={{
              x1: [0, width * 2],
              x2: [0, width],
            }}
            transition={{
              duration: animationDuration,
              repeat: Infinity,
              ease: "linear",
              delay: sweepDelay,
            }}
            id={gradientId}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={gradientColors[0]} stopOpacity="0" />
            <stop stopColor={gradientColors[1]} />
            <stop offset="1" stopColor={gradientColors[2]} stopOpacity="0" />
          </motion.linearGradient>
        </defs>

        {/* Static "ghost" base stroke — fades in with the draw if drawIn enabled */}
        <motion.path
          d={path}
          stroke={baseColor}
          strokeOpacity="0.18"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(drawIn
            ? {
                initial: { pathLength: 0, opacity: 0 },
                animate: { pathLength: 1, opacity: 1 },
                transition: { duration: drawDuration, ease: [0.65, 0, 0.35, 1] },
              }
            : {})}
        />

        {/* Bright gradient pulse on top — draws together with the base, then loops */}
        <motion.path
          d={path}
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          filter={glow ? `url(#${filterId})` : undefined}
          {...(drawIn
            ? {
                initial: { pathLength: 0 },
                animate: { pathLength: 1 },
                transition: { duration: drawDuration, ease: [0.65, 0, 0.35, 1] },
              }
            : {})}
        />
      </svg>
    </div>
  )
}
