import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const BRAND = "#0d9668";
const BRAND_LIGHT = "#6dba92";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";
const SUCCESS = "#059669";
const ERROR_RED = "#dc2626";
const CREAM = "#f5f0e6";

const OPTIONS = [
  { letter: "A", text: "5 saniye boyunca eller yikanir", correct: false },
  { letter: "B", text: "En az 20 saniye, WHO protokolu uygulanir", correct: true },
  { letter: "C", text: "Sadece eldivenli temastan sonra", correct: false },
  { letter: "D", text: "Dezenfektan sprey yeterlidir", correct: false },
];

export const ChapterExam: React.FC<{ localFrame: number; opacity: number }> = ({
  localFrame,
  opacity,
}) => {
  const { fps } = useVideoConfig();

  const cardEnter = spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 130 } });

  // Hovering then selecting answer B at frame 40
  const hoverProgress = interpolate(localFrame, [25, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Selection lock after 40
  const selected = localFrame > 42 ? 1 : 0; // B selected

  // Reveal correct/incorrect highlighting at frame 55
  const revealProgress = interpolate(localFrame, [55, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Score bump at frame 70
  const scoreBump = spring({
    frame: localFrame - 70,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  // Timer animation
  const timerProgress = interpolate(localFrame, [0, 135], [1, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const timerSecs = Math.round(timerProgress * 60);

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
      <div
        style={{
          width: 720,
          borderRadius: 28,
          background: "white",
          border: "1px solid rgba(26,58,40,0.06)",
          boxShadow: "0 40px 80px rgba(26,58,40,0.18)",
          padding: 32,
          transform: `translateY(${interpolate(cardEnter, [0, 1], [40, 0])}px) scale(${interpolate(cardEnter, [0, 1], [0.95, 1])})`,
          opacity: cardEnter,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: BRAND,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Son Sinav · Soru 3 / 5
            </p>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: DARK,
                letterSpacing: "-0.02em",
                lineHeight: 1.25,
                maxWidth: 520,
              }}
            >
              El hijyeninde dogru uygulama nedir?
            </h3>
          </div>

          {/* Timer ring */}
          <div
            style={{
              position: "relative",
              width: 70,
              height: 70,
            }}
          >
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="30" stroke={`${DARK}12`} strokeWidth="5" fill="none" />
              <circle
                cx="35"
                cy="35"
                r="30"
                stroke={timerProgress > 0.5 ? BRAND : ACCENT}
                strokeWidth="5"
                fill="none"
                strokeDasharray={2 * Math.PI * 30}
                strokeDashoffset={2 * Math.PI * 30 * (1 - timerProgress)}
                strokeLinecap="round"
                transform="rotate(-90 35 35)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                fontWeight: 900,
                color: DARK,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{timerSecs}</span>
              <span style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a7060" }}>
                SAN
              </span>
            </div>
          </div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {OPTIONS.map((opt, i) => {
            const rowEnter = spring({
              frame: localFrame - 12 - i * 6,
              fps,
              config: { damping: 22, stiffness: 150 },
            });
            const isSelected = i === 1 && selected === 1;
            const isHovering = i === 1 && localFrame >= 25 && localFrame < 42;
            const revealState = revealProgress > 0 && opt.correct;
            const wrongReveal = revealProgress > 0 && isSelected && !opt.correct;

            const borderColor = revealState
              ? SUCCESS
              : wrongReveal
                ? ERROR_RED
                : isSelected
                  ? BRAND
                  : isHovering
                    ? `${BRAND}55`
                    : "rgba(26,58,40,0.08)";

            const bgColor = revealState
              ? `${SUCCESS}12`
              : wrongReveal
                ? `${ERROR_RED}0c`
                : isSelected
                  ? `${BRAND}0c`
                  : isHovering
                    ? `${BRAND}06`
                    : CREAM;

            return (
              <div
                key={opt.letter}
                style={{
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: `1.5px solid ${borderColor}`,
                  background: bgColor,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: rowEnter,
                  transform: `translateX(${interpolate(rowEnter, [0, 1], [-20, 0])}px) scale(${isSelected ? 1 + hoverProgress * 0.01 : 1})`,
                  boxShadow: revealState ? `0 0 0 4px ${SUCCESS}22` : isSelected ? `0 0 0 4px ${BRAND}22` : "none",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: revealState
                      ? SUCCESS
                      : wrongReveal
                        ? ERROR_RED
                        : isSelected
                          ? BRAND
                          : "white",
                    color: revealState || isSelected || wrongReveal ? "white" : DARK,
                    border: revealState || isSelected || wrongReveal ? "none" : "1px solid rgba(26,58,40,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {revealState ? "✓" : wrongReveal ? "✕" : opt.letter}
                </div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: DARK,
                    flex: 1,
                  }}
                >
                  {opt.text}
                </p>
                {revealState && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: SUCCESS,
                      opacity: revealProgress,
                    }}
                  >
                    Dogru Cevap
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer with score */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            borderTop: "1px solid rgba(26,58,40,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 4,
                    borderRadius: 999,
                    background: i < 3 ? BRAND : "rgba(26,58,40,0.1)",
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#4a7060" }}>3 / 5 cevaplandi</p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${BRAND}0c 0%, ${BRAND}22 100%)`,
              border: `1px solid ${BRAND}33`,
              transform: `scale(${1 + scoreBump * 0.08})`,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: BRAND,
              }}
            >
              Anlik Skor
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: DARK,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              %{Math.round(60 + revealProgress * 20)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
