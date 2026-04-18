import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { KLINOVA_BRAND, KLINOVA_COLORS, KLINOVA_TYPOGRAPHY } from "../../components/brand/tokens";
import { PulseWave, PULSE_PEAK } from "./components/PulseWave";
import { NovaStar } from "./components/NovaStar";

export const LOGO_REVEAL_DURATION = 150;
export const LOGO_REVEAL_FPS = 30;

export interface LogoRevealProps {
  tagline?: string;
}

/**
 * 5 saniyelik Klinova logo reveal kompozisyonu.
 *
 * Zaman çizelgesi (30fps):
 *  0-20   (0.6sn) → Arka plan gradient'i spring ile girer
 *  10-50  (0.3→1.7sn) → Nabız çizgisi sol→sağ çizilir
 *  45-75  (1.5→2.5sn) → Zirvede nova yıldızı patlar
 *  75-105 (2.5→3.5sn) → Wordmark soldan kayar + fade in
 *  95-120 (3.2→4sn) → Tagline fade in
 *  130-150 (4.3→5sn) → Hafif exit fade
 *
 * Bu zamanlamalar sahne ritmini belirler. Değiştirirken nova patlamasının
 * çizgi zirveye ulaştığı anla eşleşmesine dikkat et — yoksa his bozulur.
 */
export const LogoReveal: React.FC<LogoRevealProps> = ({
  tagline = KLINOVA_BRAND.tagline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  const wordmarkProgress = spring({
    frame: frame - 75,
    fps,
    config: { damping: 20, stiffness: 140 },
  });

  const taglineOpacity = interpolate(frame, [95, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [135, 150], [1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordmarkTranslateX = interpolate(wordmarkProgress, [0, 1], [-40, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${KLINOVA_COLORS.slateMid} 0%, ${KLINOVA_COLORS.slate} 70%)`,
        opacity: exitOpacity,
      }}
    >
      <AbsoluteFill
        style={{
          opacity: bgProgress * 0.35,
          background: `radial-gradient(circle at 30% 40%, ${KLINOVA_COLORS.indigo}44 0%, transparent 50%), radial-gradient(circle at 70% 60%, ${KLINOVA_COLORS.cyan}33 0%, transparent 50%)`,
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: 500,
            height: 200,
            opacity: bgProgress,
          }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <PulseWave
              width={500}
              height={200}
              strokeColor={KLINOVA_COLORS.white}
              strokeWidth={4}
              drawStartFrame={10}
              drawDurationFrames={40}
            />
          </div>

          <div
            style={{
              position: "absolute",
              left: PULSE_PEAK.x,
              top: PULSE_PEAK.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <NovaStar size={140} burstStartFrame={45} />
          </div>
        </div>

        <div
          style={{
            marginTop: -8,
            transform: `translateX(${wordmarkTranslateX}px)`,
            opacity: wordmarkProgress,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: KLINOVA_TYPOGRAPHY.display,
              fontSize: 96,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              display: "flex",
              alignItems: "baseline",
            }}
          >
            <span style={{ fontWeight: 800, color: KLINOVA_COLORS.white }}>
              Klin
            </span>
            <span style={{ fontWeight: 500, color: KLINOVA_COLORS.cyanSoft }}>
              ova
            </span>
          </div>

          <div
            style={{
              fontFamily: KLINOVA_TYPOGRAPHY.body,
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(255,255,255,0.65)",
              letterSpacing: "0.04em",
              opacity: taglineOpacity,
            }}
          >
            {tagline}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
