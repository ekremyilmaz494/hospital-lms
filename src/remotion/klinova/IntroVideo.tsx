import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { KLINOVA_COLORS, KLINOVA_TYPOGRAPHY } from "../../components/brand/tokens";
import { LogoReveal } from "./LogoReveal";
import { NovaStar } from "./components/NovaStar";

export const INTRO_DURATION = 900;
export const INTRO_FPS = 30;

/**
 * ══════════════════════════════════════════════════════════════════════
 * TODO(sen): Tanıtım videosunun senaryosunu burada yaz.
 *
 * Aşağıdaki iskelet 5 sahne bekliyor — her sahnenin başlık ve alt
 * metnini Klinova'nın gerçek satış argümanlarına göre doldur.
 *
 * Öneriler:
 *  - PROBLEM: Hastaneler personel eğitiminde neyle boğuşuyor?
 *    (kâğıt form, takip edilemeyen katılım, denetimde sertifika bulma zorluğu…)
 *  - ÇÖZÜM: Klinova bunu nasıl çözüyor?
 *    (otomatik atama, video eğitim, online sınav, sertifika…)
 *  - SONUÇ: Müşteri ne kazanıyor?
 *    (saat/ay tasarruf, %X denetim uyumu, sıfır kâğıt…)
 *  - CTA: Sonraki adım?
 *    (demo talebi, iletişim…)
 *
 * Kısa tut: her başlık max 5 kelime, alt metin max 12 kelime.
 * Sahneler 5-7 sn arası; okuma hızı: 150 kelime/dakika.
 * ══════════════════════════════════════════════════════════════════════
 */
const SCENE_SCRIPT = {
  problem: {
    title: "TODO: Hastanelerin yaşadığı sorun",
    body: "TODO: Örn. 'Personel eğitimi hâlâ kâğıt ve Excel ile takip ediliyor'",
  },
  solution: {
    title: "TODO: Klinova'nın çözümü",
    body: "TODO: Örn. 'Atama, video, sınav ve sertifika tek platformda'",
  },
  feature1: {
    title: "TODO: Öne çıkan özellik 1",
    body: "TODO: Örn. 'Otomatik atama ve hatırlatma'",
  },
  feature2: {
    title: "TODO: Öne çıkan özellik 2",
    body: "TODO: Örn. 'Denetime hazır sertifika arşivi'",
  },
  cta: {
    title: "TODO: Çağrı",
    body: "TODO: Örn. 'Ücretsiz demo için: klinova.com'",
  },
} as const;

export const IntroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: KLINOVA_COLORS.slate }}>
      <Sequence from={0} durationInFrames={150}>
        <LogoReveal tagline="Hastane personeli için dijital eğitim platformu" />
      </Sequence>

      <Sequence from={150} durationInFrames={180}>
        <Scene
          eyebrow="01 — Sorun"
          title={SCENE_SCRIPT.problem.title}
          body={SCENE_SCRIPT.problem.body}
          accent={KLINOVA_COLORS.cyanSoft}
        />
      </Sequence>

      <Sequence from={330} durationInFrames={180}>
        <Scene
          eyebrow="02 — Çözüm"
          title={SCENE_SCRIPT.solution.title}
          body={SCENE_SCRIPT.solution.body}
          accent={KLINOVA_COLORS.indigoSoft}
        />
      </Sequence>

      <Sequence from={510} durationInFrames={150}>
        <Scene
          eyebrow="03 — Özellik"
          title={SCENE_SCRIPT.feature1.title}
          body={SCENE_SCRIPT.feature1.body}
          accent={KLINOVA_COLORS.cyanSoft}
        />
      </Sequence>

      <Sequence from={660} durationInFrames={150}>
        <Scene
          eyebrow="04 — Özellik"
          title={SCENE_SCRIPT.feature2.title}
          body={SCENE_SCRIPT.feature2.body}
          accent={KLINOVA_COLORS.indigoSoft}
        />
      </Sequence>

      <Sequence from={810} durationInFrames={90}>
        <CTAScene title={SCENE_SCRIPT.cta.title} body={SCENE_SCRIPT.cta.body} />
      </Sequence>
    </AbsoluteFill>
  );
};

interface SceneProps {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
}

function Scene({ eyebrow, title, body, accent }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  const eyebrowTranslate = interpolate(enter, [0, 1], [20, 0]);
  const bodyOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${KLINOVA_COLORS.slate} 0%, ${KLINOVA_COLORS.slateMid} 100%)`,
        padding: "0 120px",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -100,
          top: -100,
          opacity: 0.15,
          transform: `scale(${0.8 + enter * 0.2})`,
        }}
      >
        <NovaStar size={400} color={accent} glowColor={accent} burstStartFrame={0} />
      </div>

      <div
        style={{
          opacity: enter,
          transform: `translateY(${eyebrowTranslate}px)`,
          fontFamily: KLINOVA_TYPOGRAPHY.mono,
          fontSize: 16,
          fontWeight: 500,
          color: accent,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: 24,
        }}
      >
        {eyebrow}
      </div>

      <div
        style={{
          opacity: enter,
          transform: `translateY(${eyebrowTranslate * 1.4}px)`,
          fontFamily: KLINOVA_TYPOGRAPHY.display,
          fontSize: 72,
          fontWeight: 700,
          color: KLINOVA_COLORS.white,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          maxWidth: 900,
          marginBottom: 24,
        }}
      >
        {title}
      </div>

      <div
        style={{
          opacity: bodyOpacity,
          fontFamily: KLINOVA_TYPOGRAPHY.body,
          fontSize: 26,
          fontWeight: 400,
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.4,
          maxWidth: 800,
        }}
      >
        {body}
      </div>
    </AbsoluteFill>
  );
}

function CTAScene({ title, body }: { title: string; body: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${KLINOVA_COLORS.indigoDeep} 0%, ${KLINOVA_COLORS.cyanDeep} 100%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: enter,
          transform: `scale(${0.9 + enter * 0.1})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: KLINOVA_TYPOGRAPHY.display,
            fontSize: 80,
            fontWeight: 800,
            color: KLINOVA_COLORS.white,
            letterSpacing: "-0.04em",
            marginBottom: 24,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: KLINOVA_TYPOGRAPHY.body,
            fontSize: 30,
            fontWeight: 500,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {body}
        </div>
      </div>
    </AbsoluteFill>
  );
}
