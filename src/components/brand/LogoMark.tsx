"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { KLINOVA_COLORS } from "./tokens";

export type LogoMarkVariant =
  | "gradient"
  | "mono-light"
  | "mono-dark"
  | "transparent";

export interface LogoMarkProps {
  size?: number;
  variant?: LogoMarkVariant;
  animated?: boolean;
  title?: string;
  className?: string;
}

/**
 * Klinova marka işareti — nabız çizgisi zirvesinde nova yıldızına dönüşür.
 * Sağlık (EKG) + yenilik (nova/yeni yıldız) birleşimi.
 *
 * @param size - px cinsinden boyut (varsayılan 64)
 * @param variant
 *   - "gradient" (varsayılan): rounded rect + indigo→cyan gradient arka plan
 *   - "mono-light": koyu zeminlerde beyaz arka plan
 *   - "mono-dark": açık zeminlerde slate arka plan
 *   - "transparent": arka plan yok, gradient renkli nabız+nova
 * @param animated - true ise nova yıldızı sürekli hafif pulse yapar (header için)
 * @param title - Erişilebilirlik için SVG başlığı
 */
export function LogoMark({
  size = 64,
  variant = "gradient",
  animated = false,
  title = "Klinova",
  className,
}: LogoMarkProps) {
  const uid = useId();
  const gradId = `klinova-grad-${uid}`;
  const glowId = `klinova-glow-${uid}`;
  const reduce = useReducedMotion();
  const shouldAnimate = animated && !reduce;

  const showRect = variant !== "transparent";

  const fillBg =
    variant === "gradient"
      ? `url(#${gradId})`
      : variant === "mono-light"
        ? KLINOVA_COLORS.white
        : variant === "mono-dark"
          ? KLINOVA_COLORS.slate
          : "transparent";

  const strokeColor =
    variant === "transparent"
      ? `url(#${gradId})`
      : variant === "mono-light"
        ? KLINOVA_COLORS.slate
        : KLINOVA_COLORS.white;

  const strokeOpacity = variant === "mono-light" ? 0.35 : 1;

  const glyphFill =
    variant === "transparent"
      ? `url(#${gradId})`
      : variant === "mono-light"
        ? KLINOVA_COLORS.slate
        : KLINOVA_COLORS.white;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>

      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={KLINOVA_COLORS.indigo} />
          <stop offset="100%" stopColor={KLINOVA_COLORS.cyan} />
        </linearGradient>

        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={KLINOVA_COLORS.cyanSoft} stopOpacity="0.6" />
          <stop offset="60%" stopColor={KLINOVA_COLORS.cyanSoft} stopOpacity="0.2" />
          <stop offset="100%" stopColor={KLINOVA_COLORS.cyanSoft} stopOpacity="0" />
        </radialGradient>
      </defs>

      {showRect ? (
        <rect x="2" y="2" width="60" height="60" rx="16" ry="16" fill={fillBg} />
      ) : null}

      <path
        d="M 8 34 L 20 34 L 23 28 L 26 40 L 30 12 L 34 52 L 38 28 L 42 34 L 56 34"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          shouldAnimate
            ? 0.55
            : variant === "transparent"
              ? 1
              : strokeOpacity * 0.85
        }
      />

      {shouldAnimate ? (
        <motion.path
          d="M 8 34 L 20 34 L 23 28 L 26 40 L 30 12 L 34 52 L 38 28 L 42 34 L 56 34"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray="14 86"
          initial={{ strokeDashoffset: 100 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          style={{
            filter: `drop-shadow(0 0 3px ${KLINOVA_COLORS.cyanSoft})`,
          }}
        />
      ) : null}

      <motion.g
        animate={
          shouldAnimate
            ? { scale: [1, 1.12, 1] }
            : { scale: 1 }
        }
        transition={
          shouldAnimate
            ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }
        }
        style={{
          transformBox: "fill-box",
          transformOrigin: "30px 12px",
        }}
      >
        <motion.circle
          cx="30"
          cy="12"
          r="10"
          fill={`url(#${glowId})`}
          animate={
            shouldAnimate
              ? { opacity: [0.6, 1, 0.6], scale: [1, 1.25, 1] }
              : { opacity: 1, scale: 1 }
          }
          transition={
            shouldAnimate
              ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
        />
        <path
          d="M 30 5 L 31.6 10.4 L 37 12 L 31.6 13.6 L 30 19 L 28.4 13.6 L 23 12 L 28.4 10.4 Z"
          fill={glyphFill}
        />
        <circle cx="30" cy="12" r="1.6" fill={glyphFill} />
      </motion.g>
    </svg>
  );
}
