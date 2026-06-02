"use client";

import dynamic from "next/dynamic";

// ssr:false ZORUNLU olarak "use client" wrapper içinde — Server Component'ten
// çağrılırsa Next three.js'i ana chunk'ta tutar, code-split bozulur.
const Scene = dynamic(
  () => import("./scene").then((m) => ({ default: m.Scene })),
  { ssr: false }
);

/** Fixed, tam ekran, pointer-events:none canvas katmanı (CSS: .l3d-scene-fixed). */
export function SceneClient() {
  return (
    <div className="l3d-scene-fixed" aria-hidden="true">
      <Scene />
    </div>
  );
}
