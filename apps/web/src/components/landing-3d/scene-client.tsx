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
 * Cinematic `main` bitince (showcase görünmeye başlayınca) canvas opacity'si
 * scrub ile 1→0 olur: telefon güven (son keyframe) bölümünde tam görünür kalır,
 * showcase opak zemini alttan yükselip telefonu örtmeden (aşağı "batma" görüntüsü
 * vermeden) zarifçe kaybolur. ScrollTrigger global olarak Lenis'e bağlı.
 */
export function SceneClient() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!document.querySelector(".l3d-showcase")) return;

    const st = ScrollTrigger.create({
      trigger: ".l3d-showcase",
      start: "top bottom", // showcase üstü viewport altına girince (main bitti)
      end: "top center", // showcase yarıya gelince fade tamam
      scrub: true,
      onUpdate: (self) => gsap.set(el, { autoAlpha: 1 - self.progress }),
    });
    return () => st.kill();
  }, []);

  return (
    <div ref={ref} className="l3d-scene-fixed" aria-hidden="true">
      <Scene />
    </div>
  );
}
