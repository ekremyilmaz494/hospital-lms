import { Composition } from "remotion";
import { HeroComposition } from "./HeroComposition";
import { StoryComposition, STORY_DURATION, STORY_FPS } from "./story/StoryComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroHospitalLMS"
        component={HeroComposition}
        durationInFrames={180}
        fps={30}
        width={800}
        height={600}
      />
      <Composition
        id="StoryHospitalLMS"
        component={StoryComposition}
        durationInFrames={STORY_DURATION}
        fps={STORY_FPS}
        width={1200}
        height={900}
      />
    </>
  );
};
