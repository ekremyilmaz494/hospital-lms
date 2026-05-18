"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { PlayerRef } from "@remotion/player";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, UserPlus, PlayCircle, ClipboardCheck, Award, type LucideIcon } from "lucide-react";
import { STORY_DURATION } from "@/remotion/story/StoryComposition";
import { useMobile } from "@/hooks/use-mobile";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

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
  Icon: LucideIcon;
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
    Icon: UserPlus,
  },
  {
    tag: "02 — İzleme",
    title: "İleri sarma yok, gerçek izleme var.",
    desc: "CloudFront CDN üzerinden 1080p akış. Video süresi veri tabanına saniye bazında kaydedilir — personel gerçekten izlediği zaman ilerler.",
    stats: [
      { label: "Video altyapısı", value: "AWS CloudFront" },
      { label: "Doğrulama", value: "Frame-level" },
    ],
    Icon: PlayCircle,
  },
  {
    tag: "03 — Sınav",
    title: "Anında değerlendirme, rastgele sorular.",
    desc: "Soru bankasından rastgele seçim, kopya önleme. Sonuç anlık. Başarısız olursa konfigüre edilebilir bekleme + yeniden deneme hakkı.",
    stats: [
      { label: "Soru tipi", value: "Çoktan seçmeli" },
      { label: "Kopya önleme", value: "Randomize + timer" },
    ],
    Icon: ClipboardCheck,
  },
  {
    tag: "04 — Sertifika",
    title: "QR doğrulamalı, KVKK onaylı.",
    desc: "Başarılı sonuç sonrası sertifika otomatik üretilir. Her sertifikada benzersiz QR kod — üçüncü taraf doğrulaması anında.",
    stats: [
      { label: "Format", value: "PDF + QR" },
      { label: "Geçerlilik", value: "Otomatik takip" },
    ],
    Icon: Award,
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

// Chapter 1'in panel enter spring'i frame ~30'da settle olur. Scroll progress
// 0'da Player frame 0 olursa kullanıcı boş kart görür — bu yüzden mapping'i
// frame 35'ten başlatıyoruz (her chapter'ın "okunabilir" orta bölümü).
const SETTLED_START = 35;
// GSAP pin distance: ~2.2 viewport. Her chapter ~0.55 viewport scroll.
const PIN_DISTANCE_VH = 2.2;

export function ScrollStorySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const shouldReduce = useReducedMotion();
  const isMobile = useMobile();

  // GSAP ScrollTrigger ile pin + scrub. `gsap.matchMedia` kullanıyoruz çünkü
  // React state'ine bağlı useGSAP cleanup'ı (önceki implementasyon) mobilde
  // hidrasyon penceresinde pin'i kuruyor, sonra revert ediyor — ama inline
  // padding/transform kalıntıları DOM'da kalıp scroll'u yutuyordu (kullanıcı
  // raporu: ikinci chapter'dan sonra ekran donuyor). matchMedia gerçek
  // viewport'u okur, mobilde pin HİÇ kurulmaz.
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: () => `+=${window.innerHeight * PIN_DISTANCE_VH}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const clamped = Math.max(0, Math.min(1, self.progress));
              const targetFrame = Math.floor(
                SETTLED_START + clamped * (STORY_DURATION - 1 - SETTLED_START),
              );
              playerRef.current?.seekTo(targetFrame);
              const chapter = Math.min(3, Math.floor(targetFrame / 135));
              setActiveChapter((prev) => (chapter !== prev ? chapter : prev));
            },
          });
        },
      );

      return () => mm.revert();
    },
    { dependencies: [] },
  );

  // Mount'ta Player'ı SETTLED_START'a getir — ScrollTrigger ilk update'ten
  // önce kullanıcı görürse boş kart bug'ı tekrarlamasın.
  useEffect(() => {
    playerRef.current?.pause();
    playerRef.current?.seekTo(SETTLED_START);
  }, []);

  const headerVisible = activeChapter < 3;
  const scrollHintVisible = activeChapter === 0;

  return (
    <section
      id="surec"
      ref={sectionRef}
      className="relative"
      style={{
        backgroundColor: "var(--landing-surface)",
        overflowX: "clip",
      }}
      aria-label="KlinoVax nasıl çalışır — atama, izleme, sınav, sertifika"
    >
      {/* Ambient blobs — static (parallax kaldırıldı, GSAP scrub ile çakışmasın) */}
      <div
        aria-hidden
        style={{
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
      <div
        aria-hidden
        style={{
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
              className="text-[28px] sm:text-3xl font-black leading-[1.05] tracking-tight"
              style={{ color: "#1a3a28" }}
            >
              Dört adımda kurumsal eğitim{" "}
              <span style={{ color: "var(--brand-600)" }}>döngüsü.</span>
            </h2>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "#4a7060" }}
            >
              Atama, izleme, sınav, sertifika — KlinoVax akışını adım adım.
            </p>
          </div>

          {/* Step rail — sol kenarda dikey bağlayıcı çizgi */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute left-[27px] top-3 bottom-3 w-px"
              style={{
                background:
                  "linear-gradient(180deg, rgba(13,150,104,0.35) 0%, rgba(13,150,104,0.1) 100%)",
              }}
            />

            <div className="space-y-4">
              {CHAPTERS.map((c, i) => {
                const Icon = c.Icon;
                const stepNumber = String(i + 1).padStart(2, "0");
                return (
                  <motion.div
                    key={c.tag}
                    initial={{ opacity: 0, x: shouldReduce ? 0 : -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                    className="relative pl-16"
                  >
                    {/* Numbered icon disk */}
                    <div
                      className="absolute left-0 top-0 w-[55px] h-[55px] rounded-2xl flex flex-col items-center justify-center shadow-md"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--brand-600) 0%, #1a3a28 100%)",
                        color: "#f5f0e6",
                        boxShadow:
                          "0 8px 20px -8px rgba(13,150,104,0.55), 0 0 0 4px var(--landing-surface)",
                      }}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.4} />
                      <span
                        className="text-[9px] font-black tracking-widest font-mono mt-0.5"
                        style={{ color: "rgba(245,240,230,0.7)" }}
                      >
                        {stepNumber}
                      </span>
                    </div>

                    <div
                      className="rounded-2xl p-5"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.92)",
                        border: "1px solid rgba(26,58,40,0.08)",
                        boxShadow: "0 12px 28px -18px rgba(26,58,40,0.25)",
                      }}
                    >
                      <p
                        className="text-[10px] font-black tracking-[0.2em] uppercase mb-2"
                        style={{ color: "var(--brand-600)" }}
                      >
                        {c.tag.split(" — ")[1]}
                      </p>
                      <h3
                        className="text-[19px] font-black leading-[1.15] tracking-tight mb-2"
                        style={{ color: "#1a3a28" }}
                      >
                        {c.title}
                      </h3>
                      <p
                        className="text-[13px] leading-relaxed mb-4"
                        style={{ color: "#4a7060" }}
                      >
                        {c.desc}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {c.stats.map((s) => (
                          <div
                            key={s.label}
                            className="p-2.5 rounded-xl"
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
                            <p
                              className="text-[12px] font-black leading-tight"
                              style={{ color: "#1a3a28" }}
                            >
                              {s.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              prefetch={false}
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

      {/* ── DESKTOP: GSAP pinned scroll story ── */}
      <div
        className={isMobile ? "hidden" : ""}
        style={{
          display: isMobile ? "none" : "flex",
          minHeight: shouldReduce ? "auto" : "100vh",
          alignItems: "center",
          paddingBlock: shouldReduce ? "56px" : "0",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          {/* Section header */}
          <div
            className="flex items-end justify-between mb-10 lg:mb-14"
            style={{
              opacity: headerVisible ? 1 : 0,
              transition: "opacity 400ms var(--landing-ease)",
            }}
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
                <span style={{ color: "var(--brand-600)" }}>Kaydırmaya başlayın.</span>
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
          </div>

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
                      // GSAP pin distance = window.innerHeight * PIN_DISTANCE_VH
                      const distance = window.innerHeight * PIN_DISTANCE_VH;
                      const target = sectionTop + distance * ((i + 0.15) / 4);
                      window.scrollTo({ top: target, behavior: shouldReduce ? "auto" : "smooth" });
                    }}
                    className="group flex items-center gap-2 cursor-pointer"
                  >
                    <div
                      className="h-[3px] rounded-full"
                      style={{
                        width: i === activeChapter ? 36 : 16,
                        backgroundColor:
                          i <= activeChapter ? "#1a3a28" : "rgba(26,58,40,0.18)",
                        transition: "width 300ms var(--landing-ease), background-color 300ms var(--landing-ease)",
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
                  prefetch={false}
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

            {/* Right: Player */}
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

          {/* Scroll hint — only at start (chapter 0) */}
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2"
            style={{
              opacity: scrollHintVisible ? 1 : 0,
              transition: "opacity 400ms var(--landing-ease)",
              pointerEvents: scrollHintVisible ? "auto" : "none",
            }}
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
          </div>
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
