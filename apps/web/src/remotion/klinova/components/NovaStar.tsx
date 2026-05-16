import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { KLINOVA_COLORS } from "../../../components/brand/tokens";

export interface NovaStarProps {
  size?: number;
  color?: string;
  glowColor?: string;
  burstStartFrame?: number;
}

/**
 * Nabız zirvesinde patlayan 4-noktalı nova yıldızı.
 * Scale spring ile zıplar, glow halkası dışa doğru yayılır, merkez parlar.
 *
 * @param burstStartFrame - Yıldız hangi frame'de patlamaya başlasın (varsayılan 0)
 */
export function NovaStar({
  size = 80,
  color = KLINOVA_COLORS.surfaceWhite,
  glowColor = KLINOVA_COLORS.LEGACY_cyanSoft,
  burstStartFrame = 0,
}: NovaStarProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const burstFrame = frame - burstStartFrame;

  const starScale = spring({
    frame: burstFrame,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.6 },
  });

  const glowRadius = interpolate(burstFrame, [0, 30, 60], [0, 1.6, 1.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(burstFrame, [0, 15, 60], [0, 0.9, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rayOpacity = interpolate(burstFrame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const coreScale = interpolate(
    burstFrame,
    [0, 8, 16, 30],
    [0, 1.3, 1, 1.05],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} style={{ overflow: "visible" }}>
      <circle
        r={30 * glowRadius}
        fill={glowColor}
        opacity={glowOpacity * 0.35}
        style={{ filter: "blur(8px)" }}
      />
      <circle
        r={18 * glowRadius}
        fill={glowColor}
        opacity={glowOpacity * 0.6}
        style={{ filter: "blur(4px)" }}
      />

      <g opacity={rayOpacity}>
        {[0, 45, 90, 135].map((angle) => (
          <line
            key={angle}
            x1="0"
            y1="0"
            x2={40 * glowRadius}
            y2="0"
            stroke={color}
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.4"
            transform={`rotate(${angle})`}
          />
        ))}
      </g>

      <g transform={`scale(${starScale})`}>
        <path
          d="M 0 -20 L 4 -4 L 20 0 L 4 4 L 0 20 L -4 4 L -20 0 L -4 -4 Z"
          fill={color}
        />
      </g>

      <circle r={4 * coreScale} fill={color} opacity={0.95} />
    </svg>
  );
}
