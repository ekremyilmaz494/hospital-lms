"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  Clock,
  Users,
  Award,
  Flame,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  HygieneIllustration,
  CprIllustration,
  PatientSafetyIllustration,
} from "./training-illustrations";
import { LiveActivityMarquee } from "./live-activity-marquee";

const EASE = [0.22, 1, 0.36, 1] as const;

type Training = {
  id: string;
  badge: { label: string; tone: "required" | "new" | "popular" };
  category: string;
  title: string;
  desc: string;
  duration: string;
  attendees: number;
  rating?: number;
  progress: number;
  featured?: "spotlight" | "normal";
  Illustration: React.ComponentType<{ className?: string; accent?: string }>;
  bg: string; // CSS gradient
  textOnDark?: boolean;
};

const TRAININGS: Training[] = [
  {
    id: "hijyen",
    badge: { label: "Haftanın Öne Çıkanı", tone: "required" },
    category: "Zorunlu · Hasta Güvenliği",
    title: "Hijyen & Enfeksiyon Kontrolü",
    desc:
      "WHO protokollerine uyumlu el hijyeni ve temas izolasyon prosedürleri. Hastane edinimli enfeksiyonları %40 azaltmak için kritik.",
    duration: "2 saat",
    attendees: 342,
    rating: 4.8,
    progress: 82,
    featured: "spotlight",
    Illustration: HygieneIllustration,
    bg: "linear-gradient(135deg, #1a3a28 0%, #0d2010 100%)",
    textOnDark: true,
  },
  {
    id: "cpr",
    badge: { label: "Yeni", tone: "new" },
    category: "Acil Tıp · Sertifikalı",
    title: "Acil Durum Müdahale & CPR",
    desc: "Hayat kurtaran temel yaşam desteği ve kalp-akciğer canlandırma.",
    duration: "4 saat",
    attendees: 218,
    rating: 4.9,
    progress: 45,
    Illustration: CprIllustration,
    bg: "linear-gradient(135deg, #fffaf0 0%, #fef3c7 100%)",
  },
  {
    id: "safety",
    badge: { label: "Popüler", tone: "popular" },
    category: "Hasta Güvenliği · Zorunlu",
    title: "Hasta Güvenliği Temel Prosedürleri",
    desc: "Kimliklendirme, ilaç güvenliği, düşme önleme ve iletişim.",
    duration: "3 saat",
    attendees: 289,
    rating: 4.7,
    progress: 94,
    Illustration: PatientSafetyIllustration,
    bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
  },
];

/** 3D tilt container — pointer-following perspective rotation. */
function TiltCard({
  children,
  className = "",
  intensity = 8,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const shouldReduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 160, damping: 22, mass: 0.5 };
  const rotateX = useSpring(
    useTransform(mouseY, [-0.5, 0.5], [intensity, -intensity]),
    springConfig,
  );
  const rotateY = useSpring(
    useTransform(mouseX, [-0.5, 0.5], [-intensity, intensity]),
    springConfig,
  );
  const shineX = useTransform(mouseX, [-0.5, 0.5], ["20%", "80%"]);
  const shineY = useTransform(mouseY, [-0.5, 0.5], ["20%", "80%"]);
  // Hook koşulsuz çağrılmalı (rules-of-hooks) — render kararı style'dan sonraki JSX'te
  const shineBackground = useTransform(
    [shineX, shineY],
    ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.15) 0%, transparent 50%)`,
  );

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduce) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        rotateX: shouldReduce ? 0 : rotateX,
        rotateY: shouldReduce ? 0 : rotateY,
        transformStyle: "preserve-3d",
        transformPerspective: 1200,
      }}
      className={className}
    >
      {/* Shine overlay that follows cursor */}
      {!shouldReduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay z-30"
          style={{ background: shineBackground }}
        />
      )}
      {children}
    </motion.div>
  );
}

function BadgePill({ tone, children }: { tone: Training["badge"]["tone"]; children: React.ReactNode }) {
  const styles: Record<Training["badge"]["tone"], { bg: string; fg: string; Icon: typeof Flame }> = {
    required: { bg: "#f59e0b", fg: "#1a3a28", Icon: Flame },
    new: { bg: "#0d9668", fg: "#ffffff", Icon: Sparkles },
    popular: { bg: "#1a3a28", fg: "#f5f0e6", Icon: ShieldCheck },
  };
  const s = styles[tone];
  const Icon = s.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.12em] uppercase"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      {children}
    </span>
  );
}

function MetaRow({
  duration,
  attendees,
  rating,
  onDark,
}: {
  duration: string;
  attendees: number;
  rating?: number;
  onDark?: boolean;
}) {
  const color = onDark ? "#6dba92" : "#4a7060";
  return (
    <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1 text-[12px] font-semibold" style={{ color }}>
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        <span>{duration}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" />
        <span>{attendees} kişi</span>
      </div>
      {rating !== undefined && (
        <div className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
          <span>
            {rating.toFixed(1)}{" "}
            <span className="opacity-60">/ 5</span>
          </span>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, onDark }: { value: number; onDark?: boolean }) {
  const bg = onDark ? "rgba(255,255,255,0.1)" : "rgba(26,58,40,0.1)";
  return (
    <div className="relative">
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: bg }}
      >
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(to right, #0d9668 0%, #6dba92 100%)",
            boxShadow: "0 0 12px rgba(13,150,104,0.4)",
          }}
        />
      </div>
      <div
        className="flex justify-between mt-2 text-[10px] font-black tracking-[0.14em] uppercase font-mono"
        style={{ color: onDark ? "#6dba92" : "#4a7060" }}
      >
        <span>Tamamlanma</span>
        <span>%{value}</span>
      </div>
    </div>
  );
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE, delay: custom * 0.12 },
  }),
};

export function FeaturedTrainingsSection() {
  const shouldReduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const spotlight = TRAININGS.find((t) => t.featured === "spotlight")!;
  const side = TRAININGS.filter((t) => t.featured !== "spotlight");

  return (
    <section
      ref={sectionRef}
      id="featured-trainings"
      className="relative py-14 sm:py-20 md:py-24 overflow-hidden"
      style={{ backgroundColor: "#f5f0e6" }}
      aria-label="Haftanın öne çıkan eğitimleri"
    >
      {/* Ambient blobs */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          left: "-8%",
          width: 520,
          height: 520,
          borderRadius: "62% 38% 70% 30% / 45% 58% 42% 55%",
          background: "radial-gradient(circle, rgba(13,150,104,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "5%",
          right: "-10%",
          width: 480,
          height: 480,
          borderRadius: "55% 45% 40% 60%",
          background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 sm:gap-6 mb-8 sm:mb-12"
        >
          <div>
            <p
              className="text-[10px] sm:text-xs font-black tracking-[0.22em] uppercase mb-3"
              style={{ color: "var(--brand-600)" }}
            >
              Öne Çıkanlar
            </p>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl xl:text-[2.75rem] font-black leading-[1.05] tracking-tight"
              style={{ color: "#1a3a28", maxWidth: 720 }}
            >
              Bu hafta dikkat çeken{" "}
              <span style={{ color: "var(--brand-600)" }}>eğitim koleksiyonu.</span>
            </h2>
            <p
              className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed max-w-[520px]"
              style={{ color: "#4a7060" }}
            >
              Personelinizin izlediği, tamamladığı ve sertifika aldığı kritik
              modüller — canlı performans verisi ile sıralı.
            </p>
          </div>

          {/* Quick stats — horizontal scroll on mobile to avoid overflow */}
          <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            {[
              { label: "Bu hafta tamamlanan", value: "847" },
              { label: "Aktif öğrenci", value: "218" },
              { label: "Yeni sertifika", value: "96" },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col justify-between p-4 rounded-2xl min-w-[110px] sm:min-w-[120px] flex-shrink-0"
                style={{
                  backgroundColor: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(26,58,40,0.06)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <p
                  className="text-[10px] font-black tracking-[0.14em] uppercase"
                  style={{ color: "#4a7060" }}
                >
                  {s.label}
                </p>
                <p
                  className="text-2xl font-black mt-2 font-mono"
                  style={{ color: "#1a3a28" }}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bento grid: 1 spotlight + 2 side cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6"
        >
          {/* SPOTLIGHT — takes 3 columns, full height */}
          <motion.div variants={cardVariants} custom={0} className="lg:col-span-3">
            <TiltCard
              className="relative h-full rounded-3xl overflow-hidden"
              intensity={5}
            >
              <div
                className="relative h-full min-h-[420px] sm:min-h-[480px] lg:min-h-[520px] p-6 sm:p-8 lg:p-10 flex flex-col"
                style={{
                  background: spotlight.bg,
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow:
                    "0 30px 60px -20px rgba(26,58,40,0.45), 0 0 0 1px rgba(26,58,40,0.05)",
                }}
              >
                {/* Glow orbs */}
                <div
                  aria-hidden
                  className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20"
                  style={{ backgroundColor: "#0d9668", filter: "blur(60px)" }}
                />
                <div
                  aria-hidden
                  className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full opacity-15"
                  style={{ backgroundColor: "#4ade80", filter: "blur(50px)" }}
                />

                {/* Top: illustration */}
                <div
                  className="relative -mx-6 sm:-mx-8 lg:-mx-10 -mt-6 sm:-mt-8 lg:-mt-10 mb-5 sm:mb-6 aspect-[4/2.4] overflow-hidden"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <spotlight.Illustration className="w-full h-full object-cover" />
                </div>

                {/* Content */}
                <div className="relative flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <BadgePill tone={spotlight.badge.tone}>{spotlight.badge.label}</BadgePill>
                    <span
                      className="text-[10px] font-black tracking-[0.14em] uppercase font-mono"
                      style={{ color: "#6dba92" }}
                    >
                      {spotlight.category}
                    </span>
                  </div>

                  <h3
                    className="text-xl sm:text-2xl md:text-[1.75rem] font-black leading-[1.1] tracking-tight mb-3"
                    style={{ color: "white" }}
                  >
                    {spotlight.title}
                  </h3>
                  <p
                    className="text-[15px] leading-relaxed mb-6 max-w-[520px]"
                    style={{ color: "#c3d8cb" }}
                  >
                    {spotlight.desc}
                  </p>

                  <div className="mb-6">
                    <MetaRow
                      duration={spotlight.duration}
                      attendees={spotlight.attendees}
                      rating={spotlight.rating}
                      onDark
                    />
                  </div>

                  <div className="mb-7">
                    <ProgressBar value={spotlight.progress} onDark />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-xs font-black tracking-[0.12em] uppercase transition-transform hover:scale-105"
                      style={{
                        backgroundColor: "#f59e0b",
                        color: "#1a3a28",
                        boxShadow: "0 12px 32px rgba(245,158,11,0.4)",
                      }}
                    >
                      Eğitime Başla <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    {/* Small avatar cluster */}
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {["A", "M", "F", "K"].map((l, i) => (
                          <div
                            key={l}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white"
                            style={{
                              background: ["#0d9668", "#1a3a28", "#b45309", "#0d9668"][i],
                              border: "2px solid #1a3a28",
                            }}
                          >
                            {l}
                          </div>
                        ))}
                      </div>
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: "#6dba92" }}
                      >
                        +{spotlight.attendees - 4} kişi
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* SIDE CARDS — stacked, 2 columns */}
          <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-6">
            {side.map((t, i) => (
              <motion.div
                key={t.id}
                variants={cardVariants}
                custom={i + 1}
                className="flex-1"
              >
                <TiltCard
                  className="relative h-full rounded-3xl overflow-hidden"
                  intensity={6}
                >
                  <div
                    className="relative h-full min-h-[220px] sm:min-h-[248px] p-5 sm:p-6 lg:p-7 flex flex-col"
                    style={{
                      background: t.bg,
                      border: "1px solid rgba(26,58,40,0.06)",
                      boxShadow:
                        "0 20px 40px -18px rgba(26,58,40,0.18), 0 0 0 1px rgba(26,58,40,0.04)",
                    }}
                  >
                    {/* Illustration — fills right portion */}
                    <div
                      aria-hidden
                      className="absolute -right-4 -top-4 w-[60%] h-[140%] pointer-events-none opacity-85"
                      style={{ maskImage: "linear-gradient(to left, black 40%, transparent 100%)", WebkitMaskImage: "linear-gradient(to left, black 40%, transparent 100%)" }}
                    >
                      <t.Illustration className="w-full h-full" />
                    </div>

                    <div className="relative flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <BadgePill tone={t.badge.tone}>{t.badge.label}</BadgePill>
                      </div>

                      <p
                        className="text-[10px] font-black tracking-[0.14em] uppercase mb-2"
                        style={{ color: "#4a7060" }}
                      >
                        {t.category}
                      </p>
                      <h3
                        className="text-xl font-black leading-[1.15] tracking-tight mb-2 max-w-[260px]"
                        style={{ color: "#1a3a28" }}
                      >
                        {t.title}
                      </h3>
                      <p
                        className="text-[13px] leading-relaxed mb-5 max-w-[280px]"
                        style={{ color: "#4a7060" }}
                      >
                        {t.desc}
                      </p>

                      <div className="mt-auto">
                        <MetaRow
                          duration={t.duration}
                          attendees={t.attendees}
                          rating={t.rating}
                        />
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <ProgressBar value={t.progress} />
                          </div>
                          <Link
                            href="/auth/login"
                            aria-label={`${t.title} eğitimine başla`}
                            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                            style={{
                              backgroundColor: "#1a3a28",
                              color: "#f5f0e6",
                              boxShadow: "0 8px 20px rgba(26,58,40,0.3)",
                            }}
                          >
                            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Live activity marquee */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
          className="mt-10 rounded-full"
          style={{
            border: "1px solid rgba(26,58,40,0.08)",
            backgroundColor: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(10px)",
          }}
        >
          <LiveActivityMarquee />
        </motion.div>
      </div>
    </section>
  );
}
