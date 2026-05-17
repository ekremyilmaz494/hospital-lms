"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
  /** Maksimum perspektif rotasyonu derecesi. */
  intensity?: number;
};

/**
 * Pointer-following 3D perspective rotation kartı. Landing'in tüm bento
 * showcase'lerinde reuse edilir (IndustryShowcase, FeaturedTrainings, vb.).
 * `prefers-reduced-motion` saygılı.
 */
export function TiltCard({
  children,
  className = "",
  intensity = 8,
}: TiltCardProps) {
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
  const shineBackground = useTransform(
    [shineX, shineY],
    ([x, y]) =>
      `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.15) 0%, transparent 50%)`,
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
