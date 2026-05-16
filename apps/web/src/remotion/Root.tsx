import { Composition } from "remotion";
import { HeroComposition } from "./HeroComposition";
import { StoryComposition, STORY_DURATION, STORY_FPS } from "./story/StoryComposition";
import {
  IntroVideo,
  INTRO_DURATION,
  INTRO_FPS,
  LogoReveal,
  LOGO_REVEAL_DURATION,
  LOGO_REVEAL_FPS,
  SplashScreen,
  SPLASH_DURATION,
  SPLASH_FPS,
} from "./klinova";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KlinovaLogoReveal"
        component={LogoReveal}
        durationInFrames={LOGO_REVEAL_DURATION}
        fps={LOGO_REVEAL_FPS}
        width={1920}
        height={1080}
        defaultProps={{ tagline: "Hastane personeli için dijital eğitim platformu" }}
      />
      <Composition
        id="KlinovaSplash"
        component={SplashScreen}
        durationInFrames={SPLASH_DURATION}
        fps={SPLASH_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="KlinovaIntro"
        component={IntroVideo}
        durationInFrames={INTRO_DURATION}
        fps={INTRO_FPS}
        width={1920}
        height={1080}
      />

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
