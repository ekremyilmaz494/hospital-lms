"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, ShieldCheck } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Tanıtım video bölümü. Henüz video dosyası yüklenmemişse placeholder kart
 * gösterir; dosya `/public/promo/klinovax-tanitim.mp4` olarak eklenince
 * `VIDEO_SRC` aktif olur ve gerçek video oynatılır.
 *
 * Yükleme talimatı:
 *   1. Tanıtım video dosyasını H.264 MP4 olarak hazırla (30-60s, 1080p, <15MB).
 *   2. `apps/web/public/promo/klinovax-tanitim.mp4` olarak kaydet.
 *   3. (Opsiyonel) İlk frame'i poster.jpg olarak `public/promo/poster.jpg`'e koy.
 *   4. `VIDEO_SRC` constant'ını `/promo/klinovax-tanitim.mp4` yap.
 */
const VIDEO_SRC: string | null = "/promo/klinovax-tanitim.mp4";
const POSTER_SRC = "/brand/klinova-hero-preview.png";

export function PromoVideoSection() {
  const shouldReduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (!VIDEO_SRC || shouldReduce) return;
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => setIsPlaying(false));
  }, [shouldReduce]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

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
                loop
                playsInline
                preload="none"
                className="absolute inset-0 w-full h-full object-cover"
                aria-label="KlinoVax platform tanıtım videosu"
              />
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 60%, rgba(10,24,16,0.45) 100%)",
                }}
              />

              <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center backdrop-blur-md"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "white",
                  }}
                  aria-label={isMuted ? "Sesi aç" : "Sesi kapat"}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--landing-accent)",
                    color: "var(--landing-ink)",
                    boxShadow: "0 6px 20px rgba(245,158,11,0.4)",
                  }}
                  aria-label={isPlaying ? "Duraklat" : "Oynat"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
                  )}
                </button>
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
