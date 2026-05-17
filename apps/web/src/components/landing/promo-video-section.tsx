"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, ShieldCheck } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Tanıtım video bölümü. Henüz video dosyası yüklenmemişse placeholder kart
 * gösterir; dosya `/public/promo/klinovax-tanitim.mp4` olarak eklenince
 * `VIDEO_SRC` aktif olur ve gerçek video oynatılır.
 */
const VIDEO_SRC: string | null = "/promo/klinovax-tanitim.mp4";
const POSTER_SRC = "/brand/klinova-hero-preview.png";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PromoVideoSection() {
  const shouldReduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [hasAutoplayed, setHasAutoplayed] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleTime = () => setCurrentTime(v.currentTime);
    const handleMeta = () => setDuration(v.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    v.addEventListener("timeupdate", handleTime);
    v.addEventListener("loadedmetadata", handleMeta);
    v.addEventListener("durationchange", handleMeta);
    v.addEventListener("play", handlePlay);
    v.addEventListener("pause", handlePause);
    v.addEventListener("ended", handlePause);
    return () => {
      v.removeEventListener("timeupdate", handleTime);
      v.removeEventListener("loadedmetadata", handleMeta);
      v.removeEventListener("durationchange", handleMeta);
      v.removeEventListener("play", handlePlay);
      v.removeEventListener("pause", handlePause);
      v.removeEventListener("ended", handlePause);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!isInView && !v.paused) {
      v.pause();
    }
  }, [isInView]);

  useEffect(() => {
    if (!VIDEO_SRC || shouldReduce || !isInView || hasAutoplayed) return;
    const v = videoRef.current;
    if (!v) return;
    v.play()
      .then(() => setHasAutoplayed(true))
      .catch(() => setIsPlaying(false));
  }, [shouldReduce, isInView, hasAutoplayed]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section
      id="tanitim"
      className="relative py-12 sm:py-20 overflow-hidden"
      style={{ backgroundColor: "var(--landing-surface)" }}
      aria-label="KlinoVax tanıtım videosu"
    >
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-10%",
          left: "-5%",
          width: "min(520px, 90vw)",
          height: "min(520px, 90vw)",
          borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
          background:
            "radial-gradient(circle, rgba(13,150,104,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-8 sm:mb-12"
        >
          <p
            className="text-[10px] sm:text-xs font-black tracking-[0.24em] uppercase mb-3"
            style={{ color: "var(--landing-brand)" }}
          >
            Tanıtım
          </p>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-[1.1]"
            style={{ color: "var(--landing-ink)" }}
          >
            Bir bakışta{" "}
            <span style={{ color: "var(--landing-brand)" }}>
              KlinoVax.
            </span>
          </h2>
          <p
            className="mt-3 text-sm sm:text-base mx-auto"
            style={{ color: "var(--landing-ink-soft)", maxWidth: 540 }}
          >
            Atama, video eğitim, sınav ve sertifika — gerçek personel
            arayüzleri üzerinden tek bakışta.
          </p>
        </motion.div>

        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: shouldReduce ? 0 : 24, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          className="relative rounded-3xl overflow-hidden group"
          style={{
            boxShadow: "var(--landing-shadow-spotlight)",
            border: "1px solid var(--landing-rule)",
            aspectRatio: "16 / 9",
            backgroundColor: "var(--landing-brand-deep)",
          }}
        >
          {VIDEO_SRC ? (
            <>
              <video
                ref={videoRef}
                src={VIDEO_SRC}
                poster={POSTER_SRC}
                muted={isMuted}
                playsInline
                preload="metadata"
                onClick={togglePlay}
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                aria-label="KlinoVax platform tanıtım videosu"
              />

              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(10,24,16,0.55) 60%, rgba(10,24,16,0.85) 100%)",
                }}
              />

              {!isPlaying && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                  style={{ backgroundColor: "rgba(10,24,16,0.18)" }}
                  aria-label="Oynat"
                >
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: "var(--landing-accent)",
                      color: "var(--landing-ink)",
                      boxShadow: "0 14px 44px rgba(245,158,11,0.55)",
                    }}
                  >
                    <Play
                      className="w-8 h-8 sm:w-10 sm:h-10 ml-1"
                      strokeWidth={2.4}
                    />
                  </motion.span>
                </button>
              )}

              <div className="absolute inset-x-0 bottom-0 z-20 px-4 sm:px-5 pb-4 sm:pb-5 pt-3 flex flex-col gap-2.5">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-3.5
                    [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.4)]
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-3.5
                    [&::-moz-range-thumb]:h-3.5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.4)]
                    [&::-moz-range-thumb]:cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--landing-accent) 0%, var(--landing-accent) ${progress}%, rgba(255,255,255,0.28) ${progress}%, rgba(255,255,255,0.28) 100%)`,
                  }}
                  aria-label="Video ilerleme"
                />

                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-xs sm:text-sm font-mono tabular-nums font-semibold"
                    style={{ color: "white" }}
                  >
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center backdrop-blur-md cursor-pointer"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.18)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        color: "white",
                      }}
                      aria-label={isMuted ? "Sesi aç" : "Sesi kapat"}
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      ) : (
                        <Volume2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer"
                      style={{
                        backgroundColor: "var(--landing-accent)",
                        color: "var(--landing-ink)",
                        boxShadow: "0 4px 12px rgba(245,158,11,0.4)",
                      }}
                      aria-label={isPlaying ? "Duraklat" : "Oynat"}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      ) : (
                        <Play className="w-4 h-4 sm:w-[18px] sm:h-[18px] ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <PlaceholderArt />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.2 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm"
          style={{ color: "var(--landing-ink-soft)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "var(--landing-brand)" }}
            />
            Gerçek dashboard
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            KVKK demosu
          </span>
        </motion.div>
      </div>
    </section>
  );
}

function PlaceholderArt() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
      style={{
        background:
          "linear-gradient(135deg, var(--landing-brand-deep) 0%, #0a1810 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-6"
        style={{
          backgroundColor: "var(--landing-accent)",
          boxShadow: "0 12px 40px rgba(245,158,11,0.45)",
        }}
      >
        <Play
          className="w-8 h-8 sm:w-10 sm:h-10 ml-1"
          style={{ color: "var(--landing-ink)" }}
          strokeWidth={2.4}
        />
      </div>
      <p
        className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-white/70"
      >
        Yakında
      </p>
      <p
        className="mt-2 text-base sm:text-lg font-bold max-w-md"
        style={{ color: "white" }}
      >
        Tanıtım videosu hazırlanıyor.
      </p>
      <p
        className="mt-1 text-xs sm:text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Video yüklendiğinde otomatik aktif olur.
      </p>
    </div>
  );
}
