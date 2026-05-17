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
    // Touch device'larda Lenis'i hiç kurma — native momentum scroll daha
    // doğal hissediyor. `pointer: coarse` mobile + tablet'i yakalar (width
    // bazlı detect iPad Pro'yu desktop sanma riski taşır).
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
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
