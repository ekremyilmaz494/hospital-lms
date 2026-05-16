import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties } from "react";

const BRAND = "#0d9668";
const BRAND_LIGHT = "#6dba92";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";
const CREAM = "#f5f0e6";

const STAFF = [
  { initials: "AY", name: "Ayse Y.",   role: "Hemsire",    color: BRAND },
  { initials: "MK", name: "Mehmet K.", role: "Doktor",     color: DARK },
  { initials: "FS", name: "Fatma S.",  role: "Teknisyen",  color: "#b45309" },
  { initials: "KD", name: "Kadir D.",  role: "Hemsire",    color: BRAND },
];

export const ChapterAssign: React.FC<{ localFrame: number; opacity: number }> = ({
  localFrame,
  opacity,
}) => {
  const { fps } = useVideoConfig();

  const panelEnter = spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 120 } });
  const buttonPress = interpolate(localFrame, [30, 40, 50], [1, 0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const buttonGlow = interpolate(localFrame, [30, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
      {/* Admin panel card */}
      <div
        style={{
          width: 760,
          borderRadius: 28,
          backgroundColor: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(26,58,40,0.08)",
          boxShadow: "0 40px 80px rgba(26,58,40,0.18)",
          padding: 32,
          transform: `translateY(${interpolate(panelEnter, [0, 1], [40, 0])}px) scale(${interpolate(panelEnter, [0, 1], [0.95, 1])})`,
          opacity: panelEnter,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: BRAND, textTransform: "uppercase", marginBottom: 4 }}>
              Yonetici Paneli
            </p>
            <p style={{ fontSize: 22, fontWeight: 900, color: DARK, letterSpacing: "-0.02em" }}>
              Egitim Atamasi
            </p>
          </div>
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              backgroundColor: `${BRAND}14`,
              color: BRAND,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ● Canli
          </div>
        </div>

        {/* Training selector */}
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: CREAM,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${BRAND}, ${DARK})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            ♥
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: DARK }}>Acil Mudahale & CPR</p>
            <p style={{ fontSize: 11, color: "#4a7060", marginTop: 2 }}>4 saat · Sertifikali · Zorunlu</p>
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              backgroundColor: `${ACCENT}22`,
              color: "#92400e",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Seçildi
          </div>
        </div>

        {/* Staff list with stagger reveal */}
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "#4a7060", textTransform: "uppercase", marginBottom: 10 }}>
          Personel ({STAFF.length})
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          {STAFF.map((s, i) => {
            const rowEnter = spring({
              frame: localFrame - 15 - i * 8,
              fps,
              config: { damping: 22, stiffness: 150 },
            });
            const checkAppear = interpolate(localFrame, [55 + i * 5, 70 + i * 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={s.initials}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  backgroundColor: "white",
                  border: `1px solid ${interpolate(checkAppear, [0, 1], [0.06, 0.16]) > 0.1 ? BRAND : "rgba(26,58,40,0.08)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: rowEnter,
                  transform: `translateX(${interpolate(rowEnter, [0, 1], [-20, 0])}px)`,
                  boxShadow: `0 0 0 ${interpolate(checkAppear, [0, 1], [0, 2])}px ${BRAND}33`,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: s.color,
                    color: "white",
                    fontSize: 12,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: DARK }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: "#4a7060", marginTop: 1 }}>{s.role}</p>
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    backgroundColor: BRAND,
                    color: "white",
                    fontSize: 12,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: checkAppear,
                    transform: `scale(${checkAppear})`,
                  }}
                >
                  ✓
                </div>
              </div>
            );
          })}
        </div>

        {/* Assign button */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <div
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              backgroundColor: "transparent",
              border: `1.5px solid ${DARK}22`,
              color: DARK,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Iptal
          </div>
          <div
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${ACCENT} 0%, #d97706 100%)`,
              color: DARK,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              transform: `scale(${buttonPress})`,
              boxShadow: `0 ${interpolate(buttonGlow, [0, 1], [4, 20])}px ${interpolate(buttonGlow, [0, 1], [12, 40])}px ${ACCENT}${interpolate(buttonGlow, [0, 1], [40, 80]).toString(16).slice(0, 2)}`,
            }}
          >
            Atamayi Onayla →
          </div>
        </div>
      </div>

      {/* Floating notification */}
      <FloatingToast localFrame={localFrame} appearAt={80} />
    </div>
  );
};

const FloatingToast: React.FC<{ localFrame: number; appearAt: number }> = ({ localFrame, appearAt }) => {
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: localFrame - appearAt,
    fps,
    config: { damping: 18, stiffness: 110 },
  });

  const style: CSSProperties = {
    position: "absolute",
    top: 80,
    right: 60,
    padding: "14px 18px",
    borderRadius: 16,
    backgroundColor: DARK,
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 20px 40px rgba(26,58,40,0.35)",
    transform: `translateY(${interpolate(enter, [0, 1], [-30, 0])}px) scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
    opacity: enter,
  };

  return (
    <div style={style}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          backgroundColor: BRAND_LIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: DARK,
          fontSize: 14,
          fontWeight: 900,
        }}
      >
        ✓
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: BRAND_LIGHT }}>
          Basarili
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>4 personele bildirim gonderildi</p>
      </div>
    </div>
  );
};
