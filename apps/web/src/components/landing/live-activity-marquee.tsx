"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Award, CheckCircle2, GraduationCap, Users, Clock } from "lucide-react";

type Activity = {
  icon: typeof Award;
  text: string;
  accent: "green" | "amber" | "dark";
  time: string;
};

const ACTIVITIES: Activity[] = [
  { icon: Award, text: "Ayşe Y. 'CPR' sertifikasını aldı", accent: "amber", time: "2 dk önce" },
  { icon: CheckCircle2, text: "Mehmet K. sınavı %96 ile tamamladı", accent: "green", time: "8 dk önce" },
  { icon: GraduationCap, text: "Fatma S. yeni bir eğitime başladı", accent: "dark", time: "15 dk önce" },
  { icon: Users, text: "342 kişi bu hafta Hijyen eğitimini tamamladı", accent: "green", time: "bugün" },
  { icon: Award, text: "Kadir D. 'Hasta Güvenliği' sertifikasını aldı", accent: "amber", time: "32 dk önce" },
  { icon: Clock, text: "Acil Tıp eğitimi 14 yeni personele atandı", accent: "dark", time: "1 saat önce" },
  { icon: CheckCircle2, text: "Selma B. 3 eğitimi üst üste tamamladı", accent: "green", time: "1 saat önce" },
];

const ACCENT_STYLES: Record<Activity["accent"], { bg: string; fg: string; iconBg: string }> = {
  green: { bg: "#0d96680a", fg: "#1a3a28", iconBg: "#0d9668" },
  amber: { bg: "#f59e0b12", fg: "#1a3a28", iconBg: "#f59e0b" },
  dark: { bg: "#1a3a2808", fg: "#1a3a28", iconBg: "#1a3a28" },
};

export function LiveActivityMarquee() {
  const shouldReduce = useReducedMotion();
  // Duplicate the list so the loop is seamless
  const duplicated = [...ACTIVITIES, ...ACTIVITIES];

  return (
    <div className="relative overflow-hidden py-2" aria-label="Canlı platform aktivitesi">
      {/* Left & right fade masks */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to right, #f5f0e6 0%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to left, #f5f0e6 0%, transparent 100%)",
        }}
      />

      {/* Indicator dot */}
      <div
        className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2"
        style={{ color: "#4a7060" }}
      >
        <span className="relative flex w-2 h-2">
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: "#0d9668", animation: shouldReduce ? "none" : "livePulse 2s ease-out infinite" }}
          />
          <span
            className="relative w-2 h-2 rounded-full"
            style={{ backgroundColor: "#0d9668" }}
          />
        </span>
        <span className="text-[10px] font-black tracking-[0.18em] uppercase">Canlı</span>
      </div>

      {/* Marquee track */}
      <motion.div
        initial={{ x: 0 }}
        animate={shouldReduce ? { x: 0 } : { x: "-50%" }}
        transition={{
          duration: 42,
          ease: "linear",
          repeat: Infinity,
        }}
        className="flex gap-3 pl-32 w-max"
      >
        {duplicated.map((a, i) => {
          const s = ACCENT_STYLES[a.accent];
          const Icon = a.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2 rounded-full whitespace-nowrap"
              style={{
                backgroundColor: s.bg,
                border: "1px solid rgba(26,58,40,0.06)",
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: s.iconBg }}
              >
                <Icon className="w-3 h-3 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-[13px] font-semibold" style={{ color: s.fg }}>
                {a.text}
              </p>
              <span className="text-[10px] font-mono opacity-60" style={{ color: s.fg }}>
                · {a.time}
              </span>
            </div>
          );
        })}
      </motion.div>

      <style>{`
        @keyframes livePulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(2.8); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
