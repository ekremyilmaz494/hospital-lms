import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const BRAND = "#0d9668";
const BRAND_LIGHT = "#6dba92";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";
const CREAM = "#f5f0e6";

export const ChapterWatch: React.FC<{ localFrame: number; opacity: number }> = ({
  localFrame,
  opacity,
}) => {
  const { fps } = useVideoConfig();

  const playerEnter = spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 130 } });

  // Play button ripple — pulse twice then fades as video starts
  const playPulse = interpolate(
    localFrame,
    [10, 30, 31, 45],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Progress bar fills 0 → 68% across 45-120 frames
  const progress = interpolate(localFrame, [40, 120], [0, 68], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Timer counts up
  const totalSeconds = Math.floor(interpolate(localFrame, [40, 120], [0, 156], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");

  // "ileri sarma kilitli" badge slides in
  const badgeEnter = spring({
    frame: localFrame - 60,
    fps,
    config: { damping: 18, stiffness: 140 },
  });

  // Ambient waveform bars
  const barHeights = Array.from({ length: 24 }, (_, i) => {
    const seed = (i * 13) % 7;
    const wave = Math.sin((localFrame + i * 4) / 8) * 0.4 + 0.6;
    return 6 + seed + wave * 14;
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Video player frame */}
      <div
        style={{
          width: 720,
          transform: `translateY(${interpolate(playerEnter, [0, 1], [40, 0])}px) scale(${interpolate(playerEnter, [0, 1], [0.95, 1])})`,
          opacity: playerEnter,
        }}
      >
        {/* Toolbar above video */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: BRAND,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Aktif Egitim · Bolum 2/6
            </p>
            <p style={{ fontSize: 20, fontWeight: 900, color: DARK, letterSpacing: "-0.02em" }}>
              Hasta Guvenligi Temel Prosedurleri
            </p>
          </div>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              backgroundColor: "white",
              border: "1px solid rgba(26,58,40,0.08)",
              color: "#4a7060",
              fontSize: 11,
              fontWeight: 800,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            {mm}:{ss} / 02:36
          </div>
        </div>

        {/* Video surface */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: 20,
            overflow: "hidden",
            background: `linear-gradient(145deg, ${DARK} 0%, #0d2010 100%)`,
            boxShadow: "0 30px 60px rgba(26,58,40,0.3)",
          }}
        >
          {/* Scene atmosphere: faint blue/green glow */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              left: "30%",
              width: 320,
              height: 320,
              background: `radial-gradient(circle, ${BRAND}55 0%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-10%",
              right: "10%",
              width: 240,
              height: 240,
              background: `radial-gradient(circle, ${BRAND_LIGHT}33 0%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />

          {/* Scene silhouette mock — nurse + monitor */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "flex-end",
              gap: 40,
              opacity: 0.25,
            }}
          >
            {/* Monitor frame */}
            <div
              style={{
                width: 140,
                height: 100,
                borderRadius: 8,
                border: "2px solid rgba(255,255,255,0.5)",
                backgroundColor: "rgba(13,150,104,0.15)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: 10,
              }}
            >
              <div style={{ height: 4, width: "60%", background: BRAND_LIGHT, borderRadius: 999, marginBottom: 6 }} />
              <div style={{ height: 4, width: "80%", background: "rgba(255,255,255,0.4)", borderRadius: 999, marginBottom: 6 }} />
              <div style={{ height: 4, width: "45%", background: ACCENT, borderRadius: 999 }} />
            </div>
            {/* Silhouette figure */}
            <div
              style={{
                width: 70,
                height: 150,
                borderRadius: "50% 50% 25% 25%",
                background: "rgba(255,255,255,0.6)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -30,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.7)",
                }}
              />
            </div>
          </div>

          {/* Play button ripple */}
          {playPulse > 0.01 && (
            <>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 80 + playPulse * 100,
                  height: 80 + playPulse * 100,
                  transform: "translate(-50%, -50%)",
                  borderRadius: 999,
                  border: `2px solid ${BRAND_LIGHT}`,
                  opacity: (1 - playPulse) * 0.8,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 80,
                  height: 80,
                  transform: "translate(-50%, -50%)",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "14px solid transparent",
                    borderBottom: "14px solid transparent",
                    borderLeft: `22px solid ${DARK}`,
                    marginLeft: 6,
                  }}
                />
              </div>
            </>
          )}

          {/* Waveform bars at bottom */}
          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 56,
              display: "flex",
              alignItems: "flex-end",
              gap: 3,
              opacity: 0.55,
            }}
          >
            {barHeights.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  background: `linear-gradient(to top, ${BRAND} 0%, ${BRAND_LIGHT} 100%)`,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 32,
              height: 4,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: `linear-gradient(to right, ${BRAND} 0%, ${BRAND_LIGHT} 100%)`,
                borderRadius: 999,
                boxShadow: `0 0 16px ${BRAND}`,
              }}
            />
          </div>

          {/* Bottom-left play icon small + duration */}
          <div
            style={{
              position: "absolute",
              left: 24,
              bottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "rgba(255,255,255,0.85)",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              letterSpacing: "0.05em",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 2, background: BRAND_LIGHT }} />
            {mm}:{ss}
          </div>

          {/* Top-right quality + volume */}
          <div
            style={{
              position: "absolute",
              right: 24,
              top: 18,
              display: "flex",
              gap: 8,
            }}
          >
            <div
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                backgroundColor: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(8px)",
                color: "white",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.05em",
              }}
            >
              1080p
            </div>
            <div
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                backgroundColor: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(8px)",
                color: "white",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              ♪ 85%
            </div>
          </div>

          {/* Locked-seek badge (top-left) */}
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 18,
              padding: "6px 12px",
              borderRadius: 999,
              background: `${ACCENT}ee`,
              color: DARK,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: `0 6px 20px ${ACCENT}55`,
              transform: `translateX(${interpolate(badgeEnter, [0, 1], [-30, 0])}px)`,
              opacity: badgeEnter,
            }}
          >
            <span style={{ fontSize: 12 }}>⚿</span>
            Ileri Sarma Kilitli
          </div>
        </div>

        {/* Below-player status bar */}
        <div
          style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 14,
            background: "white",
            border: "1px solid rgba(26,58,40,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: BRAND,
                boxShadow: `0 0 12px ${BRAND}`,
              }}
            />
            <p style={{ fontSize: 12, fontWeight: 700, color: DARK }}>
              Gercek izleme suresi kaydediliyor
            </p>
          </div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: BRAND,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            {Math.round(progress)}% izlendi
          </p>
        </div>
      </div>
    </div>
  );
};
