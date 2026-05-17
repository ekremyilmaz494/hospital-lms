"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Landing'e özel smooth scroll wrapper. Yalnızca `/` landing route'unda mount
 * edilir; admin/staff panellerinde Lenis aktif değildir (sticky layout'larla
 * çakışmasın diye).
 *
 * `prefers-reduced-motion: reduce` aktifse Lenis kurulmaz — native scroll
 * davranışına düşer.
 */
export function LandingMotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.0,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
