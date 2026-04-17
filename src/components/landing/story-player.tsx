"use client";

import { Player, type PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import { StoryComposition, STORY_DURATION, STORY_FPS } from "@/remotion/story/StoryComposition";

export function StoryPlayer({ playerRef }: { playerRef: RefObject<PlayerRef | null> }) {
  return (
    <Player
      ref={playerRef}
      component={StoryComposition}
      durationInFrames={STORY_DURATION}
      compositionWidth={1200}
      compositionHeight={900}
      fps={STORY_FPS}
      autoPlay={false}
      loop={false}
      controls={false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      showVolumeControls={false}
      style={{ width: "100%", aspectRatio: "4 / 3" }}
      acknowledgeRemotionLicense
    />
  );
}
