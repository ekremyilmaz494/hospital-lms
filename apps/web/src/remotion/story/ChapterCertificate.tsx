import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const BRAND = "#0d9668";
const BRAND_LIGHT = "#6dba92";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";
const CREAM = "#f5f0e6";

export const ChapterCertificate: React.FC<{ localFrame: number; opacity: number }> = ({
  localFrame,
  opacity,
}) => {
  const { fps } = useVideoConfig();

  // Certificate card drops in and tilts slightly
  const cardEnter = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 110 } });
  const tiltAngle = interpolate(localFrame, [0, 30, 120], [6, -2, -2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Shine sweeps across at frame 25-55
  const shineProgress = interpolate(localFrame, [25, 60], [-0.3, 1.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Signature draws at frame 45-75
  const sigProgress = interpolate(localFrame, [45, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // QR fades in at frame 60
  const qrEnter = spring({
    frame: localFrame - 60,
    fps,
    config: { damping: 20, stiffness: 130 },
  });

  // Download toast at frame 95
  const toastEnter = spring({
    frame: localFrame - 95,
    fps,
    config: { damping: 18, stiffness: 140 },
  });

  // Sparkles scatter at frame 80
  const sparkles = Array.from({ length: 12 }, (_, i) => {
    const p = spring({
      frame: localFrame - 80 - i * 2,
      fps,
      config: { damping: 12, stiffness: 100 },
    });
    const angle = (i / 12) * Math.PI * 2;
    const dist = 60 + (i % 3) * 40;
    return {
      x: Math.cos(angle) * dist * p,
      y: Math.sin(angle) * dist * p,
      size: 6 + (i % 3) * 3,
      opacity: (1 - p) * 0.9,
    };
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
      {/* Sparkle layer */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      >
        {sparkles.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: i % 2 === 0 ? ACCENT : BRAND_LIGHT,
              opacity: s.opacity,
              boxShadow: `0 0 ${s.size * 2}px currentColor`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>

      {/* Certificate */}
      <div
        style={{
          width: 640,
          aspectRatio: "1.414 / 1",
          position: "relative",
          borderRadius: 20,
          background: "linear-gradient(145deg, #fffdf6 0%, #f8f1de 100%)",
          border: `2px solid ${ACCENT}55`,
          boxShadow: `0 40px 80px rgba(26,58,40,0.2), 0 0 0 1px ${ACCENT}22`,
          padding: 40,
          overflow: "hidden",
          transform: `translateY(${interpolate(cardEnter, [0, 1], [60, 0])}px) rotate(${tiltAngle}deg) scale(${interpolate(cardEnter, [0, 1], [0.9, 1])})`,
          opacity: cardEnter,
        }}
      >
        {/* Shine overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${shineProgress * 100}%`,
            width: "45%",
            height: "100%",
            background: "linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.55) 50%, transparent 80%)",
            transform: "skewX(-20deg)",
            pointerEvents: "none",
          }}
        />

        {/* Border frame decoration */}
        <div
          style={{
            position: "absolute",
            inset: 12,
            border: `1px solid ${ACCENT}55`,
            borderRadius: 12,
            pointerEvents: "none",
          }}
        />

        {/* Corner ornaments */}
        {[
          { top: 20, left: 20 },
          { top: 20, right: 20 },
          { bottom: 20, left: 20 },
          { bottom: 20, right: 20 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              ...pos,
              width: 24,
              height: 24,
              border: `2px solid ${ACCENT}`,
              borderRadius: 2,
              opacity: 0.5,
            }}
          />
        ))}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${BRAND}, ${DARK})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              D
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, color: DARK, letterSpacing: "0.1em" }}>DEVAKENT HASTANESI</p>
              <p style={{ fontSize: 8, color: "#4a7060", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Egitim Platformu
              </p>
            </div>
          </div>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: `${ACCENT}22`,
              color: "#92400e",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            KVKK Onayli
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.3em",
              color: BRAND,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            — Basari Sertifikasi —
          </p>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: DARK,
              letterSpacing: "-0.02em",
              marginBottom: 4,
              fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            }}
          >
            Ayse Yildiz
          </h2>
          <p style={{ fontSize: 11, color: "#4a7060" }}>Hemsire · Personel ID: TR-24601</p>
        </div>

        {/* Subject */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: "#4a7060", marginBottom: 6 }}>Asagidaki egitimi basari ile tamamlamistir:</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: DARK, letterSpacing: "-0.01em" }}>
            Hasta Guvenligi Temel Prosedurleri
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              marginTop: 10,
              fontSize: 10,
              color: "#4a7060",
              fontWeight: 700,
            }}
          >
            <span>Sure: 2s 36d</span>
            <span>·</span>
            <span>Skor: %92</span>
            <span>·</span>
            <span>Tarih: 16.04.2026</span>
          </div>
        </div>

        {/* Bottom row: signature + QR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {/* Signature */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 150,
                height: 40,
                position: "relative",
                marginBottom: 6,
              }}
            >
              <svg width="150" height="40" viewBox="0 0 150 40" style={{ overflow: "visible" }}>
                <path
                  d="M 5,25 Q 15,5 25,22 T 45,20 Q 58,8 68,24 Q 78,30 88,18 Q 100,5 115,22 Q 128,32 140,20"
                  fill="none"
                  stroke={DARK}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="200"
                  strokeDashoffset={200 * (1 - sigProgress)}
                />
              </svg>
            </div>
            <div style={{ height: 1, background: DARK, opacity: 0.3, marginBottom: 4 }} />
            <p style={{ fontSize: 9, fontWeight: 800, color: DARK, letterSpacing: "0.08em" }}>Dr. Ahmet Kara</p>
            <p style={{ fontSize: 7, color: "#4a7060", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Egitim Koordinatoru
            </p>
          </div>

          {/* QR code mock */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 10,
              background: "white",
              border: `1px solid ${DARK}22`,
              padding: 6,
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: 1,
              transform: `scale(${qrEnter})`,
              opacity: qrEnter,
            }}
          >
            {Array.from({ length: 144 }, (_, i) => {
              // Deterministic "qr" pattern
              const seed = (i * 7 + (i % 11)) % 3;
              const isFinder =
                (i < 3 && Math.floor(i / 12) < 3) ||
                (i % 12 > 8 && Math.floor(i / 12) < 3) ||
                (i % 12 < 3 && Math.floor(i / 12) > 8);
              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1",
                    background: isFinder || seed === 0 ? DARK : "transparent",
                    borderRadius: 1,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Download toast */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          padding: "14px 18px",
          borderRadius: 16,
          background: DARK,
          color: "white",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 20px 40px rgba(26,58,40,0.35)",
          transform: `translateY(${interpolate(toastEnter, [0, 1], [30, 0])}px) scale(${interpolate(toastEnter, [0, 1], [0.85, 1])})`,
          opacity: toastEnter,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: BRAND_LIGHT,
            color: DARK,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 900,
          }}
        >
          ↓
        </div>
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: BRAND_LIGHT,
            }}
          >
            Hazir
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>PDF olarak indirildi</p>
        </div>
      </div>
    </div>
  );
};
