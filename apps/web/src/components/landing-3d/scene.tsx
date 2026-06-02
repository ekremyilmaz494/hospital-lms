"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { PhoneModel } from "./phone-model";
import { ProceduralEnvironment } from "./procedural-environment";

/**
 * R3F Canvas rig. Desktop (≥1024px) RIM ışık + high-perf + env intensity 1.2;
 * mobil (≤1023px) RIM yok + low-power + env intensity 1.0. IBL her iki yönde de
 * RoomEnvironment (network'süz) — harici HDR CDN bağımlılığı yok.
 * Sekme görünmezken frameloop "never" → render durur (pil/CPU tasarrufu).
 */
export function Scene() {
  const isMobile = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches,
    []
  );
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");

  useEffect(() => {
    const onVisibility = () =>
      setFrameloop(document.visibilityState === "hidden" ? "never" : "always");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <Canvas
      frameloop={frameloop}
      dpr={isMobile ? [0.85, 1.1] : [1, 2]}
      gl={{
        antialias: !isMobile,
        powerPreference: isMobile ? "low-power" : "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = isMobile ? 1.15 : 1.25;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      // Şeffaf: arkadaki hero-bg (ve diğer bölümlerde sayfa zemini) görünsün.
      style={{ background: "transparent" }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 4.5]} fov={32} />

      <ambientLight intensity={0.25} />
      {/* KEY */}
      <directionalLight position={[-6, 3, 5]} intensity={1.6} color="#ffffff" />
      {/* FILL — sıcak dolgu (bej zemine uyum) */}
      <directionalLight position={[5, 2, 4]} intensity={0.6} color="#fff7ed" />
      {/* RIM — emerald-tinted kenar ayrımı (sadece desktop) */}
      {!isMobile && (
        <directionalLight position={[3, 3, -6]} intensity={1.2} color="#d1fae5" />
      )}

      {/* IBL: RoomEnvironment (network'süz, PMREM). Desktop intensity 1.2, mobil 1.0.
          Harici HDR CDN'i (drei studio preset) bilinçli kullanılmıyor — offline/CDN-down
          durumunda landing page'i çökertir (useLoader rejection Suspense'i aşar). */}
      <ProceduralEnvironment intensity={isMobile ? 1.0 : 1.2} />

      <Suspense fallback={null}>
        <PhoneModel isMobile={isMobile} />
      </Suspense>
    </Canvas>
  );
}
