"use client";

import { useState, useEffect } from "react";

/**
 * SSR-safe hook that returns true when the viewport width is at or below
 * the given breakpoint (default 767px → matches Tailwind's `md` boundary).
 *
 * Uses `matchMedia` instead of `resize` events for better performance —
 * the browser only fires the callback when the media query result changes,
 * rather than on every pixel of resize.
 */
export function useMobile(breakpoint = 767): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
