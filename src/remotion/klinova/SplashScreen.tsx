import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { KLINOVA_COLORS, KLINOVA_TYPOGRAPHY } from "../../components/brand/tokens";
import { NovaStar } from "./components/NovaStar";

export const SPLASH_DURATION = 60;
export const SPLASH_FPS = 30;

/**
 * 2 saniyelik PWA/app splash screen.
 * PNG frame export ile manifest icon olarak kullanılabilir, ya da
 * runtime'da Remotion Player ile canlı oynatılabilir.
 *
 * Zaman çizelgesi (30fps):
 *  0-15  → Logo scale spring ile girer
 *  15-40 → Görünür, hafif nefes animasyonu
 *  40-60 → Fade out
 */
export const SplashScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });

  const breathe = Math.sin((frame / fps) * Math.PI * 1.2) * 0.03 + 1;

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [45, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalOpacity = Math.min(enterOpacity, exitOpacity);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${KLINOVA_COLORS.LEGACY_indigoDeep} 0%, ${KLINOVA_COLORS.LEGACY_cyanDeep} 100%)`,
        alignItems: "center",
        justifyContent: "center",
        opacity: finalOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          transform: `scale(${enterScale * breathe})`,
        }}
      >
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 44,
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 24px 80px ${KLINOVA_COLORS.LEGACY_slate}66`,
          }}
        >
          <NovaStar size={120} burstStartFrame={5} />
        </div>

        <div
          style={{
            fontFamily: KLINOVA_TYPOGRAPHY.display,
            fontSize: 56,
            fontWeight: 700,
            color: KLINOVA_COLORS.surfaceWhite,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          <span style={{ fontWeight: 800 }}>Klin</span>
          <span style={{ fontWeight: 400, opacity: 0.85 }}>ova</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
