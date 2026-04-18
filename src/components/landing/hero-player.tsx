"use client";

import { Player } from "@remotion/player";
import { HeroComposition } from "@/remotion/HeroComposition";

const HERO_FPS = 30;
const HERO_END_FRAME = 165;

/**
 * Landing page hero görseli — HeroHospitalLMS (HeroComposition) Remotion
 * kompozisyonunu canlı oynatır.
 *
 * durationInFrames 165'te kesildi (tam 180 değil) çünkü HeroComposition'ın
 * son 15 frame'i bir exit fade — landing loop'ta ekran solmasın.
 * loop=true ile 5.5sn'de bir baştan başlar, ziyaretçi sürekli canlı görsel görür.
 */
export function HeroPlayer() {
  return (
    <div
      className="relative w-full max-w-[780px] mx-auto aspect-[4/3]"
      style={{
        borderRadius: 32,
        overflow: "hidden",
        boxShadow:
          "0 50px 100px -30px rgba(26,58,40,0.55), 0 0 0 1px rgba(26,58,40,0.1)",
      }}
    >
      <Player
        component={HeroComposition}
        compositionWidth={800}
        compositionHeight={600}
        durationInFrames={HERO_END_FRAME}
        fps={HERO_FPS}
        autoPlay
        loop
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
