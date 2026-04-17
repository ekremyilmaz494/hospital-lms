"use client";

import { Player } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { HeroComposition } from "@/remotion/HeroComposition";

export function HeroPlayer() {
  const [reduced, setReduced] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[520px] mx-auto aspect-[4/3]"
      style={{ borderRadius: 24, overflow: "hidden" }}
    >
      <Player
        component={HeroComposition}
        durationInFrames={180}
        compositionWidth={800}
        compositionHeight={600}
        fps={30}
        autoPlay={!reduced}
        loop
        controls={false}
        style={{ width: "100%", height: "100%" }}
        clickToPlay={false}
        showVolumeControls={false}
        doubleClickToFullscreen={false}
        acknowledgeRemotionLicense
      />
    </div>
  );
}
