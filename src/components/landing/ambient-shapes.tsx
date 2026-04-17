"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

type Palette = "emerald" | "amber" | "cream";

const PALETTES: Record<
  Palette,
  {
    blob1: string;
    blob2: string;
    ring: string;
  }
> = {
  emerald: {
    blob1: "rgba(13,150,104,0.14)",
    blob2: "rgba(109,186,146,0.18)",
    ring: "rgba(26,58,40,0.08)",
  },
  amber: {
    blob1: "rgba(245,158,11,0.16)",
    blob2: "rgba(180,83,9,0.1)",
    ring: "rgba(245,158,11,0.18)",
  },
  cream: {
    blob1: "rgba(26,58,40,0.08)",
    blob2: "rgba(245,158,11,0.08)",
    ring: "rgba(26,58,40,0.06)",
  },
};

type AmbientShapesProps = {
  palette?: Palette;
  intensity?: number;
  /** Shapes move at different speeds; larger = more dramatic parallax. Default 1. */
  parallax?: number;
};

export function AmbientShapes({
  palette = "emerald",
  intensity = 1,
  parallax = 1,
}: AmbientShapesProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const colors = PALETTES[palette];

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "end start"],
  });

  const disable = shouldReduce || parallax === 0;

  const y1 = useTransform(scrollYProgress, [0, 1], [0, disable ? 0 : -160 * parallax]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, disable ? 0 : 180 * parallax]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, disable ? 0 : -90 * parallax]);
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, disable ? 0 : 40]);
  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, disable ? 0 : -30]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity: intensity }}
    >
      {/* Organic blob 1 — top-left */}
      <motion.div
        style={{
          y: y1,
          rotate: rotate1,
          position: "absolute",
          top: "-8%",
          left: "-6%",
          width: 520,
          height: 520,
          borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
          background: `radial-gradient(circle at 30% 30%, ${colors.blob1} 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />

      {/* Organic blob 2 — bottom-right */}
      <motion.div
        style={{
          y: y2,
          rotate: rotate2,
          position: "absolute",
          bottom: "-10%",
          right: "-8%",
          width: 480,
          height: 480,
          borderRadius: "55% 45% 40% 60% / 50% 60% 40% 50%",
          background: `radial-gradient(circle at 70% 70%, ${colors.blob2} 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />

      {/* Outline ring — mid */}
      <motion.svg
        style={{ y: y3, position: "absolute", top: "40%", right: "15%" }}
        width="180"
        height="180"
        viewBox="0 0 180 180"
      >
        <circle
          cx="90"
          cy="90"
          r="84"
          fill="none"
          stroke={colors.ring}
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <circle
          cx="90"
          cy="90"
          r="56"
          fill="none"
          stroke={colors.ring}
          strokeWidth="1"
        />
      </motion.svg>

      {/* Floating plus marks */}
      {[
        { x: "18%", y: "28%", size: 14 },
        { x: "82%", y: "22%", size: 10 },
        { x: "72%", y: "72%", size: 16 },
        { x: "24%", y: "78%", size: 12 },
      ].map((p, i) => (
        <motion.div
          key={i}
          style={{
            y: i % 2 === 0 ? y1 : y2,
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            opacity: 0.35,
          }}
        >
          <svg viewBox="0 0 20 20" width={p.size} height={p.size}>
            <path
              d="M 10 2 V 18 M 2 10 H 18"
              stroke={colors.ring.replace(/[\d.]+\)$/, "0.35)")}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      ))}

      {/* Dot grid — subtle */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${colors.ring} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          opacity: 0.4,
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black 0%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black 0%, transparent 80%)",
        }}
      />
    </div>
  );
}
