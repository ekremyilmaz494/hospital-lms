import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ChapterAssign } from "./ChapterAssign";
import { ChapterWatch } from "./ChapterWatch";
import { ChapterExam } from "./ChapterExam";
import { ChapterCertificate } from "./ChapterCertificate";

const BRAND = "#0d9668";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";
const CREAM = "#f5f0e6";
const STONE = "#ece7d7";

const CHAPTER_LEN = 135;
const OVERLAP = 20;
const TOTAL = CHAPTER_LEN * 4;

function chapterFade(frame: number, start: number): number {
  const localFrame = frame - start;
  if (localFrame < -OVERLAP) return 0;
  if (localFrame < 0) return interpolate(localFrame, [-OVERLAP, 0], [0, 1]);
  if (localFrame > CHAPTER_LEN) return 0;
  if (localFrame > CHAPTER_LEN - OVERLAP)
    return interpolate(localFrame, [CHAPTER_LEN - OVERLAP, CHAPTER_LEN], [1, 0]);
  return 1;
}

const CHAPTER_BG = [
  // Chapter 1: Cream with warm accent
  {
    base: CREAM,
    blob1: { color: BRAND, x: "15%", y: "20%", size: 400, opacity: 0.08 },
    blob2: { color: ACCENT, x: "85%", y: "75%", size: 320, opacity: 0.1 },
  },
  // Chapter 2: Darker cream with cool accent
  {
    base: STONE,
    blob1: { color: DARK, x: "80%", y: "15%", size: 380, opacity: 0.1 },
    blob2: { color: BRAND, x: "10%", y: "80%", size: 340, opacity: 0.12 },
  },
  // Chapter 3: Cream with brand glow
  {
    base: CREAM,
    blob1: { color: BRAND, x: "70%", y: "25%", size: 420, opacity: 0.12 },
    blob2: { color: DARK, x: "20%", y: "70%", size: 360, opacity: 0.08 },
  },
  // Chapter 4: Golden celebratory
  {
    base: "#fffaf0",
    blob1: { color: ACCENT, x: "50%", y: "50%", size: 520, opacity: 0.14 },
    blob2: { color: BRAND, x: "10%", y: "85%", size: 320, opacity: 0.1 },
  },
];

export const StoryComposition: React.FC = () => {
  const frame = useCurrentFrame();

  const chapterIndex = Math.min(3, Math.floor(frame / CHAPTER_LEN));
  const nextIndex = Math.min(3, chapterIndex + 1);
  const localInChapter = frame - chapterIndex * CHAPTER_LEN;
  const bgBlend =
    localInChapter > CHAPTER_LEN - OVERLAP
      ? interpolate(localInChapter, [CHAPTER_LEN - OVERLAP, CHAPTER_LEN], [0, 1])
      : 0;

  const currentBg = CHAPTER_BG[chapterIndex];
  const nextBg = CHAPTER_BG[nextIndex];

  // Chapter progress label (bottom-left)
  const chapterLabels = ["Atama", "Izleme", "Sinav", "Sertifika"];

  return (
    <AbsoluteFill
      style={{
        background: currentBg.base,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Next chapter base color crossfades */}
      <AbsoluteFill
        style={{
          background: nextBg.base,
          opacity: bgBlend,
        }}
      />

      {/* Ambient blob 1 — current */}
      <div
        style={{
          position: "absolute",
          left: currentBg.blob1.x,
          top: currentBg.blob1.y,
          width: currentBg.blob1.size,
          height: currentBg.blob1.size,
          borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
          background: currentBg.blob1.color,
          opacity: currentBg.blob1.opacity * (1 - bgBlend),
          filter: "blur(60px)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: currentBg.blob2.x,
          top: currentBg.blob2.y,
          width: currentBg.blob2.size,
          height: currentBg.blob2.size,
          borderRadius: "55% 45% 40% 60% / 50% 60% 40% 50%",
          background: currentBg.blob2.color,
          opacity: currentBg.blob2.opacity * (1 - bgBlend),
          filter: "blur(50px)",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Ambient blob — next (crossfade) */}
      {bgBlend > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              left: nextBg.blob1.x,
              top: nextBg.blob1.y,
              width: nextBg.blob1.size,
              height: nextBg.blob1.size,
              borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
              background: nextBg.blob1.color,
              opacity: nextBg.blob1.opacity * bgBlend,
              filter: "blur(60px)",
              transform: "translate(-50%, -50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: nextBg.blob2.x,
              top: nextBg.blob2.y,
              width: nextBg.blob2.size,
              height: nextBg.blob2.size,
              borderRadius: "55% 45% 40% 60% / 50% 60% 40% 50%",
              background: nextBg.blob2.color,
              opacity: nextBg.blob2.opacity * bgBlend,
              filter: "blur(50px)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </>
      )}

      {/* Subtle grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(26,58,40,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />

      {/* Chapter 1: Assign (0–135) */}
      <ChapterAssign localFrame={frame - 0} opacity={chapterFade(frame, 0)} />

      {/* Chapter 2: Watch (135–270) */}
      <ChapterWatch localFrame={frame - CHAPTER_LEN} opacity={chapterFade(frame, CHAPTER_LEN)} />

      {/* Chapter 3: Exam (270–405) */}
      <ChapterExam localFrame={frame - CHAPTER_LEN * 2} opacity={chapterFade(frame, CHAPTER_LEN * 2)} />

      {/* Chapter 4: Certificate (405–540) */}
      <ChapterCertificate
        localFrame={frame - CHAPTER_LEN * 3}
        opacity={chapterFade(frame, CHAPTER_LEN * 3)}
      />

      {/* Bottom chapter indicator */}
      <div
        style={{
          position: "absolute",
          left: 40,
          bottom: 32,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: DARK,
            opacity: 0.55,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          0{chapterIndex + 1} / 04
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {chapterLabels.map((label, i) => (
            <div
              key={label}
              style={{
                height: 3,
                width: i === chapterIndex ? 28 : 12,
                borderRadius: 999,
                background: i <= chapterIndex ? DARK : `${DARK}22`,
                transition: "width 200ms",
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: DARK,
            letterSpacing: "-0.01em",
          }}
        >
          {chapterLabels[chapterIndex]}
        </span>
      </div>

      {/* Brand watermark top-right */}
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: 0.5,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: `linear-gradient(135deg, ${BRAND}, ${DARK})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          D
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: DARK,
          }}
        >
          Devakent
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const STORY_FPS = 30;
export const STORY_DURATION = TOTAL;
export const STORY_CHAPTER_LEN = CHAPTER_LEN;
