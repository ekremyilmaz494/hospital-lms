"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion, useMotionValueEvent } from "framer-motion";
import type { PlayerRef } from "@remotion/player";
import { ArrowRight } from "lucide-react";
import { STORY_CHAPTER_LEN, STORY_DURATION } from "@/remotion/story/StoryComposition";
import { useMobile } from "@/hooks/use-mobile";

const StoryPlayer = dynamic(
  () => import("./story-player").then((m) => m.StoryPlayer),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full aspect-[4/3] rounded-3xl"
        style={{
          background: "linear-gradient(145deg, #ece7d7 0%, #f5f0e6 100%)",
          border: "1px solid rgba(26,58,40,0.06)",
        }}
      />
    ),
  },
);

type Chapter = {
  tag: string;
  title: string;
  desc: string;
  stats: { label: string; value: string }[];
};

const CHAPTERS: Chapter[] = [
  {
    tag: "01 — Atama",
    title: "Eğitimi dakikalar içinde ata.",
    desc: "Departman ya da birey bazlı seçim. Zorunlu eğitim etiketi, son teslim tarihi ve otomatik bildirim — hepsi tek ekranda.",
    stats: [
      { label: "Ortalama atama süresi", value: "< 2 dk" },
      { label: "Bildirim kanalı", value: "E-posta + Uygulama" },
    ],
  },
  {
    tag: "02 — İzleme",
    title: "İleri sarma yok, gerçek izleme var.",
    desc: "CloudFront CDN üzerinden 1080p akış. Video süresi veri tabanına saniye bazında kaydedilir — personel gerçekten izlediği zaman ilerler.",
    stats: [
      { label: "Video altyapısı", value: "AWS CloudFront" },
      { label: "Doğrulama", value: "Frame-level" },
    ],
  },
  {
    tag: "03 — Sınav",
    title: "Anında değerlendirme, rastgele sorular.",
    desc: "Soru bankasından rastgele seçim, kopya önleme. Sonuç anlık. Başarısız olursa konfigüre edilebilir bekleme + yeniden deneme hakkı.",
    stats: [
      { label: "Soru tipi", value: "Çoktan seçmeli" },
      { label: "Kopya önleme", value: "Randomize + timer" },
    ],
  },
  {
    tag: "04 — Sertifika",
    title: "QR doğrulamalı, KVKK onaylı.",
    desc: "Başarılı sonuç sonrası sertifika otomatik üretilir. Her sertifikada benzersiz QR kod — üçüncü taraf doğrulaması anında.",
    stats: [
      { label: "Format", value: "PDF + QR" },
      { label: "Geçerlilik", value: "Otomatik takip" },
    ],
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function ScrollStorySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const shouldReduce = useReducedMotion();
  const isMobile = useMobile();
  const disableScrollStory = shouldReduce || isMobile;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Smooth parallax shifts for background shapes
  const blobY = useTransform(scrollYProgress, [0, 1], [0, shouldReduce ? 0 : -200]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, shouldReduce ? 0 : 150]);
  // Header stays fully visible throughout — only fades out near the very end as user leaves the section
  const headerOpacity = useTransform(scrollYProgress, [0, 0.92, 1], [1, 1, 0]);
  const scrollHintOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  // Drive the Remotion player frame from scroll progress
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const clamped = Math.max(0, Math.min(1, latest));
    const targetFrame = Math.floor(clamped * (STORY_DURATION - 1));
    playerRef.current?.seekTo(targetFrame);

    const chapter = Math.min(3, Math.floor(clamped * 4));
    if (chapter !== activeChapter) setActiveChapter(chapter);
  });

  // Set initial frame on mount
  useEffect(() => {
    playerRef.current?.pause();
    playerRef.current?.seekTo(0);
  }, []);

  return (
    <section
      id="nasil-calisir"
      ref={sectionRef}
      className="relative"
      style={{
        height: disableScrollStory ? "auto" : "400vh",
        backgroundColor: "#f5f0e6",
      }}
      aria-label="Devakent LMS nasıl çalışır"
    >
      {/* Ambient blobs — parallax */}
      <motion.div
        aria-hidden
        style={{
          y: blobY,
          position: "absolute",
          top: "10%",
          left: "5%",
          width: 560,
          height: 560,
          borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
          background: "radial-gradient(circle, rgba(13,150,104,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <motion.div
        aria-hidden
        style={{
          y: blobY2,
          position: "absolute",
          top: "60%",
          right: "5%",
          width: 480,
          height: 480,
          borderRadius: "55% 45% 40% 60% / 50% 60% 40% 50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* ── MOBILE: vertical chapter stack ── */}
      {isMobile && (
        <div className="relative py-14 sm:py-16 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="mb-10">
            <p
              className="text-[10px] font-black tracking-[0.2em] uppercase mb-2"
              style={{ color: "var(--brand-600)" }}
            >
              Nasıl Çalışır
            </p>
            <h2
              className="text-2xl sm:text-3xl font-black leading-[1.05] tracking-tight"
              style={{ color: "#1a3a28" }}
            >
              Dört adımda hastane eğitim{" "}
              <span style={{ color: "var(--brand-600)" }}>döngüsü.</span>
            </h2>
          </div>

          <div className="space-y-4">
            {CHAPTERS.map((c, i) => (
              <motion.div
                key={c.tag}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, ease: EASE, delay: i * 0.05 }}
                className="relative rounded-3xl p-5 sm:p-6"
                style={{
                  backgroundColor: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(26,58,40,0.08)",
                  boxShadow: "0 12px 28px -18px rgba(26,58,40,0.25)",
                }}
              >
                <div
                  className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full mb-4"
                  style={{
                    backgroundColor: "rgba(13,150,104,0.1)",
                    color: "var(--brand-600)",
                    border: "1px solid rgba(13,150,104,0.25)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: "var(--brand-600)" }}
                  />
                  {c.tag}
                </div>
                <h3
                  className="text-xl sm:text-2xl font-black leading-[1.1] tracking-tight mb-3"
                  style={{ color: "#1a3a28" }}
                >
                  {c.title}
                </h3>
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: "#4a7060" }}
                >
                  {c.desc}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {c.stats.map((s) => (
                    <div
                      key={s.label}
                      className="p-3 rounded-2xl"
                      style={{
                        backgroundColor: "rgba(13,150,104,0.06)",
                        border: "1px solid rgba(13,150,104,0.12)",
                      }}
                    >
                      <p
                        className="text-[9px] font-black tracking-widest uppercase mb-1"
                        style={{ color: "#4a7060" }}
                      >
                        {s.label}
                      </p>
                      <p className="text-[13px] font-black leading-tight" style={{ color: "#1a3a28" }}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-7 h-12 rounded-full text-sm font-black uppercase tracking-wide"
              style={{
                backgroundColor: "#f59e0b",
                color: "#1a3a28",
                boxShadow: "0 8px 24px rgba(245,158,11,0.35)",
              }}
            >
              Hemen Başla <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── DESKTOP: sticky scroll story ── */}
      <div
        className={isMobile ? "hidden" : disableScrollStory ? "" : "sticky top-0"}
        style={{
          height: disableScrollStory ? "auto" : "100vh",
          display: isMobile ? "none" : "flex",
          alignItems: "center",
          paddingBlock: disableScrollStory ? "56px" : "0",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          {/* Section header */}
          <motion.div
            style={{ opacity: shouldReduce ? 1 : headerOpacity }}
            className="flex items-end justify-between mb-10 lg:mb-14"
          >
            <div>
              <p
                className="text-xs font-bold tracking-[0.2em] uppercase mb-2"
                style={{ color: "var(--brand-600)" }}
              >
                Nasıl Çalışır
              </p>
              <h2
                className="text-3xl md:text-4xl xl:text-[2.75rem] font-black leading-[1.05] tracking-tight"
                style={{ color: "#1a3a28", maxWidth: 640 }}
              >
                Dört ekranda anlatılan hikâye.
                <span style={{ color: "var(--brand-600)" }}> Kaydırmaya başlayın.</span>
              </h2>
            </div>
            <div
              className="hidden lg:flex items-center gap-2 text-xs font-bold tracking-widest uppercase"
              style={{ color: "#4a7060" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "var(--brand-600)" }}
              />
              Scroll etkileşimli
            </div>
          </motion.div>

          {/* Content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-10 xl:gap-16 items-center">
            {/* Left: rotating text */}
            <div className="min-h-[440px] flex flex-col justify-center">
              {/* Chapter tag */}
              <motion.div
                key={`tag-${activeChapter}`}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.24em] uppercase px-4 py-1.5 rounded-full border w-fit mb-7"
                style={{ color: "var(--brand-600)", borderColor: "var(--brand-600)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "var(--brand-600)" }}
                />
                {CHAPTERS[activeChapter].tag}
              </motion.div>

              {/* Title */}
              <motion.h3
                key={`title-${activeChapter}`}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="text-3xl md:text-4xl xl:text-[2.5rem] font-black leading-[1.08] tracking-tight mb-5"
                style={{ color: "#1a3a28" }}
              >
                {CHAPTERS[activeChapter].title}
              </motion.h3>

              {/* Description */}
              <motion.p
                key={`desc-${activeChapter}`}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE, delay: 0.05 }}
                className="text-base leading-relaxed max-w-[480px] mb-8"
                style={{ color: "#4a7060" }}
              >
                {CHAPTERS[activeChapter].desc}
              </motion.p>

              {/* Stats grid */}
              <motion.div
                key={`stats-${activeChapter}`}
                initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
                className="grid grid-cols-2 gap-3 max-w-[440px] mb-8"
              >
                {CHAPTERS[activeChapter].stats.map((s) => (
                  <div
                    key={s.label}
                    className="p-4 rounded-2xl"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(26,58,40,0.06)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <p
                      className="text-[10px] font-black tracking-widest uppercase mb-1.5"
                      style={{ color: "#4a7060" }}
                    >
                      {s.label}
                    </p>
                    <p className="text-sm font-black" style={{ color: "#1a3a28" }}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </motion.div>

              {/* Chapter timeline */}
              <div className="flex items-center gap-3 mt-4">
                {CHAPTERS.map((c, i) => (
                  <button
                    key={c.tag}
                    type="button"
                    aria-label={`${c.tag}'e git`}
                    onClick={() => {
                      const section = sectionRef.current;
                      if (!section) return;
                      const rect = section.getBoundingClientRect();
                      const sectionTop = window.scrollY + rect.top;
                      const sectionHeight = section.offsetHeight - window.innerHeight;
                      const target = sectionTop + sectionHeight * (i / 4) + 10;
                      window.scrollTo({ top: target, behavior: shouldReduce ? "auto" : "smooth" });
                    }}
                    className="group flex items-center gap-2 cursor-pointer"
                  >
                    <div
                      className="h-[3px] rounded-full transition-all duration-300"
                      style={{
                        width: i === activeChapter ? 36 : 16,
                        backgroundColor:
                          i <= activeChapter ? "#1a3a28" : "rgba(26,58,40,0.18)",
                      }}
                    />
                  </button>
                ))}
                <span
                  className="ml-2 text-[10px] font-black tracking-widest uppercase font-mono"
                  style={{ color: "#4a7060" }}
                >
                  0{activeChapter + 1} / 04
                </span>
              </div>

              {/* CTA (only visible on last chapter) */}
              <motion.div
                animate={{
                  opacity: activeChapter === 3 ? 1 : 0.55,
                  scale: activeChapter === 3 ? 1 : 0.98,
                }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mt-8"
              >
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-black uppercase tracking-wide transition-transform hover:scale-105"
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#1a3a28",
                    boxShadow: "0 8px 32px rgba(245,158,11,0.35)",
                  }}
                >
                  Hemen Başla <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>

            {/* Right: Sticky player */}
            <div className="relative">
              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  boxShadow:
                    "0 40px 80px rgba(26,58,40,0.18), 0 0 0 1px rgba(26,58,40,0.04)",
                }}
              >
                <StoryPlayer playerRef={playerRef} />
              </div>

              {/* Floating chapter badge */}
              <motion.div
                key={`badge-${activeChapter}`}
                initial={{ opacity: 0, y: shouldReduce ? 0 : -8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="absolute -top-3 -left-3 px-4 py-2 rounded-2xl text-xs font-black tracking-widest uppercase"
                style={{
                  backgroundColor: "#1a3a28",
                  color: "#f5f0e6",
                  boxShadow: "0 12px 24px rgba(26,58,40,0.3)",
                }}
              >
                {CHAPTERS[activeChapter].tag.split(" — ")[1]}
              </motion.div>
            </div>
          </div>

          {/* Scroll hint — only at start */}
          <motion.div
            style={{ opacity: scrollHintOpacity }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2"
            aria-hidden
          >
            <span
              className="text-[10px] font-black tracking-widest uppercase"
              style={{ color: "#4a7060" }}
            >
              Kaydır
            </span>
            <div
              className="w-[2px] h-10 rounded-full overflow-hidden relative"
              style={{ backgroundColor: "rgba(26,58,40,0.1)" }}
            >
              <div
                className="absolute inset-x-0 top-0 h-4 rounded-full"
                style={{
                  backgroundColor: "#1a3a28",
                  animation: shouldReduce ? "none" : "scrollHintDrop 1.8s ease-in-out infinite",
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes scrollHintDrop {
          0% { transform: translateY(-100%); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(120%); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
