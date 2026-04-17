import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DashboardCard } from "./DashboardCard";

const BRAND = "#0d9668";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";

export const HeroComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const blobScale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const logoOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const logoScale = interpolate(frame, [5, 25], [0.6, 1], {
    extrapolateRight: "clamp",
  });

  const card1Progress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 140 },
  });

  const progressBarWidth = interpolate(frame, [60, 120], [0, 68], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const stat1Progress = spring({
    frame: frame - 90,
    fps,
    config: { damping: 20, stiffness: 140 },
  });
  const stat2Progress = spring({
    frame: frame - 100,
    fps,
    config: { damping: 20, stiffness: 140 },
  });

  const notifProgress = spring({
    frame: frame - 130,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const exitFade = interpolate(frame, [165, 180], [1, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#f5f0e6", fontFamily: "Inter, system-ui, sans-serif" }}>
      <AbsoluteFill style={{ opacity: exitFade }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 520,
            height: 520,
            transform: `translate(-50%, -50%) scale(${blobScale})`,
            borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
            background: `linear-gradient(145deg, ${DARK} 0%, #0d2010 100%)`,
            boxShadow: "0 40px 80px rgba(26,58,40,0.25)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${logoScale})`,
            opacity: logoOpacity,
            width: 80,
            height: 80,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${BRAND}, ${DARK})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            fontWeight: 900,
            color: "white",
          }}
        >
          D
        </div>

        <DashboardCard
          progress={card1Progress}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translateY(${interpolate(card1Progress, [0, 1], [40, -20])}px)`,
            opacity: card1Progress,
            width: 360,
            padding: 20,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.55)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Aktif Egitim
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 999,
                backgroundColor: "rgba(74,222,128,0.15)",
                color: "#4ade80",
              }}
            >
              ● Devam Ediyor
            </span>
          </div>
          <p style={{ color: "white", fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
            Acil Mudahale & CPR Egitimi
          </p>
          <div
            style={{
              width: "100%",
              height: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.12)",
              marginBottom: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressBarWidth}%`,
                height: 6,
                borderRadius: 999,
                backgroundColor: BRAND,
                boxShadow: `0 0 12px ${BRAND}`,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{Math.round(progressBarWidth)}% tamamlandi</span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>4 / 6 ders</span>
          </div>
        </DashboardCard>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% - 100px), calc(30px + ${interpolate(stat1Progress, [0, 1], [30, 0])}px))`,
            opacity: stat1Progress,
            width: 95,
            padding: "10px 12px",
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.09)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ width: 14, height: 14, marginBottom: 6, borderRadius: 3, backgroundColor: "#4ade80" }} />
          <p style={{ fontSize: 20, fontWeight: 900, color: "white", lineHeight: 1 }}>%94</p>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>Basari Orani</p>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + 105px), calc(30px + ${interpolate(stat2Progress, [0, 1], [30, 0])}px))`,
            opacity: stat2Progress,
            width: 95,
            padding: "10px 12px",
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.09)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ width: 14, height: 14, marginBottom: 6, borderRadius: 3, backgroundColor: ACCENT }} />
          <p style={{ fontSize: 20, fontWeight: 900, color: "white", lineHeight: 1 }}>218</p>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>Katilimci</p>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + 140px), calc(-150px + ${interpolate(notifProgress, [0, 1], [-20, 0])}px))`,
            opacity: notifProgress,
            padding: "10px 14px",
            borderRadius: 999,
            backgroundColor: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              backgroundColor: `${BRAND}1a`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: BRAND,
              fontWeight: 900,
            }}
          >
            ✓
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: DARK }}>Sertifika hazir</span>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + 170px), -220px) scale(${blobScale})`,
            width: 60,
            height: 60,
            borderRadius: 999,
            backgroundColor: ACCENT,
            color: DARK,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            boxShadow: `0 8px 24px ${ACCENT}66`,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>7/24</span>
          <span style={{ fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>Erisim</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
