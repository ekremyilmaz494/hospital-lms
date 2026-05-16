"use client";

import { useScroll, useTransform, type MotionValue } from "framer-motion";
import { type RefObject } from "react";

export function useScrollParallax(
  ref: RefObject<HTMLElement | null>,
  distance: number = 50,
): { y: MotionValue<number>; opacity: MotionValue<number> } {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  return { y, opacity };
}
