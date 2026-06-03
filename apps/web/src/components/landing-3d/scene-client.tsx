"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const MOBILE_QUERY = "(max-width: 768px)";

// ssr:false ZORUNLU olarak "use client" wrapper içinde — Server Component'ten
// çağrılırsa Next three.js'i ana chunk'ta tutar, code-split bozulur.
const Scene = dynamic(
  () => import("./scene").then((m) => ({ default: m.Scene })),
  { ssr: false }
);

/** Mobil/tablet (≤768px) fallback — ağır 3D yerine statik telefon mockup'ı.
 *  Pil/performans için three.js chunk'ı mobilde hiç yüklenmez. */
function MobilePhone() {
  return (
    <div className="l3d-mobile-phone">
      <div className="l3d-mobile-phone-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing-3d/screen-hero.webp" alt="" decoding="async" />
      </div>
    </div>
  );
}

/**
 * Fixed, tam ekran, pointer-events:none canvas katmanı (CSS: .l3d-scene-fixed).
 * Telefon güven (son keyframe) bölümüne kadar fixed kalır; cinematic `main` bitip
 * showcase görünmeye başlayınca canvas YUKARI ötelenir (yPercent 0→-100) → telefon,
 * güven içeriğiyle BİRLİKTE yukarı kayıp ekrandan çıkar (bölüme tutturulmuş gibi);
 * aşağı sarkıp "batarak silinme" görüntüsü vermez. ScrollTrigger global olarak Lenis'e bağlı.
 */
export function SceneClient() {
  const ref = useRef<HTMLDivElement>(null);
  // Mount sonrası belirlenir (SSR/hydration tutarlılığı). Mobilde 3D yerine statik telefon.
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    setMounted(true);
    // Cihaz döndürme / yeniden boyutlama → fallback ↔ 3D güncellensin.
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    // Mobilde telefon absolute → doğal scroll'la gider; transform'a gerek yok.
    if (isMobile) return;
    const el = ref.current;
    if (!el) return;
    if (!document.querySelector(".l3d-showcase")) return;

    const st = ScrollTrigger.create({
      trigger: ".l3d-showcase",
      start: "top bottom", // showcase üstü viewport altına girince (main/güven bitti)
      end: "top top", // showcase üste oturunca (bir viewport'luk geçiş)
      scrub: true,
      // Telefon (3D veya statik) içerikle senkron yukarı kayar → güven bölümüyle çıkar.
      onUpdate: (self) => gsap.set(el, { yPercent: -100 * self.progress }),
    });
    return () => st.kill();
  }, [isMobile]);

  return (
    <div ref={ref} className="l3d-scene-fixed" aria-hidden="true">
      {mounted && (isMobile ? <MobilePhone /> : <Scene />)}
    </div>
  );
}
