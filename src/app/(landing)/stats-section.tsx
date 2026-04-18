"use client";

import { NumberTicker } from "@/components/ui/number-ticker";

const STATS = [
  { prefix: "", num: 6, suffix: "", label: "Entegre Modül" },
  { prefix: "", num: 22, suffix: "", label: "Veri Modeli" },
  { prefix: "", num: 100, suffix: "%", label: "KVKK & RLS Uyumlu" },
  { prefix: "7/", num: 24, suffix: "", label: "Kesintisiz Erişim" },
];

export function StatsSection() {
  return (
    <section id="platform" style={{ backgroundColor: "#1a3a28" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-2 md:grid-cols-4 gap-y-5 md:gap-y-0">
        {STATS.map(({ prefix, num, suffix, label }, i) => {
          // Mobile (2 cols): border on items in left column (i=0,2)
          // Desktop (4 cols): border on all except last
          const mobileBorder = i % 2 === 0;
          const desktopBorder = i < 3;
          return (
            <div
              key={label}
              className="relative text-center py-2 px-3 sm:px-4"
            >
              {/* Mobile 2-col border (right edge of left items) */}
              {mobileBorder && (
                <span
                  aria-hidden
                  className="md:hidden absolute top-1/2 -translate-y-1/2 right-0 h-10 w-px"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                />
              )}
              {/* Desktop 4-col border */}
              {desktopBorder && (
                <span
                  aria-hidden
                  className="hidden md:block absolute top-1/2 -translate-y-1/2 right-0 h-10 w-px"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                />
              )}
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                {prefix}
                <NumberTicker
                  value={num}
                  delay={i * 0.15}
                  className="text-2xl sm:text-3xl font-black text-white"
                />
                {suffix}
              </p>
              <p
                className="text-xs sm:text-sm mt-1 leading-tight"
                style={{ color: "#6dba92" }}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
