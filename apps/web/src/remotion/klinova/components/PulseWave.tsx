import { interpolate, useCurrentFrame } from "remotion";
import { KLINOVA_COLORS } from "../../../components/brand/tokens";

export interface PulseWaveProps {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  drawStartFrame?: number;
  drawDurationFrames?: number;
}

const PATH_D = "M 20 100 L 120 100 L 150 80 L 180 120 L 220 40 L 260 160 L 300 80 L 340 100 L 480 100";
const PATH_LENGTH = 720;

/**
 * Sol→sağ çizilen animasyonlu EKG nabız çizgisi.
 * strokeDasharray + strokeDashoffset tekniği ile çizim reveal'ı yapar.
 *
 * @param drawStartFrame - Çizim hangi frame'de başlasın (varsayılan 0)
 * @param drawDurationFrames - Çizim süresi (varsayılan 40 frame ≈ 1.3sn @30fps)
 */
export function PulseWave({
  width = 500,
  height = 200,
  strokeColor = KLINOVA_COLORS.surfaceWhite,
  strokeWidth = 4,
  drawStartFrame = 0,
  drawDurationFrames = 40,
}: PulseWaveProps) {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [drawStartFrame, drawStartFrame + drawDurationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const dashOffset = PATH_LENGTH * progress;

  return (
    <svg
      viewBox="0 0 500 200"
      width={width}
      height={height}
      style={{ overflow: "visible" }}
    >
      <path
        d={PATH_D}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={PATH_LENGTH}
        strokeDashoffset={dashOffset}
        style={{
          filter: `drop-shadow(0 0 8px ${strokeColor}88)`,
        }}
      />
    </svg>
  );
}

/**
 * Path üzerindeki zirve noktası koordinatları (nova yıldızı burada belirir).
 * PATH_D içindeki "L 220 40" noktası — en yüksek spike.
 */
export const PULSE_PEAK = { x: 220, y: 40 } as const;
