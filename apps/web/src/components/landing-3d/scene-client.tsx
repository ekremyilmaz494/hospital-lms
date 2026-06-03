"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ssr:false ZORUNLU olarak "use client" wrapper içinde — Server Component'ten
// çağrılırsa Next three.js'i ana chunk'ta tutar, code-split bozulur.
const Scene = dynamic(
  () => import("./scene").then((m) => ({ default: m.Scene })),
  { ssr: false }
);

/**
 * Fixed, tam ekran, pointer-events:none canvas katmanı (CSS: .l3d-scene-fixed).
 * Telefon güven (son keyframe) bölümüne kadar fixed kalır; cinematic `main` bitip
 * showcase görünmeye başlayınca canvas YUKARI ötelenir (yPercent 0→-100) → telefon,
 * güven içeriğiyle BİRLİKTE yukarı kayıp ekrandan çıkar (bölüme tutturulmuş gibi);
 * aşağı sarkıp "batarak silinme" görüntüsü vermez. ScrollTrigger global olarak Lenis'e bağlı.
 */
export function SceneClient() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!document.querySelector(".l3d-showcase")) return;

    const st = ScrollTrigger.create({
      trigger: ".l3d-showcase",
      start: "top bottom", // showcase üstü viewport altına girince (main/güven bitti)
      end: "top top", // showcase üste oturunca (bir viewport'luk geçiş)
      scrub: true,
      // Canvas içerikle senkron yukarı kayar → telefon güven bölümüyle birlikte çıkar.
      onUpdate: (self) => gsap.set(el, { yPercent: -100 * self.progress }),
    });
    return () => st.kill();
  }, []);

  return (
    <div ref={ref} className="l3d-scene-fixed" aria-hidden="true">
      <Scene />
    </div>
  );
}
