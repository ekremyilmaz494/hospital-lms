"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { markTexturesReady, onIntroStart, unlockScroll } from "@/lib/scene-ready";
import {
  SCROLL_STATES,
  MOBILE_SCALE_FACTOR,
  MOBILE_POSITION_FACTOR,
} from "./scroll-states";
import { createScreenCanvas, type ScreenKind } from "./phone-screens";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const MODEL_URL = "/models/iphone.glb";

// Her SCROLL_STATES keyframe'ine bir ekran. Bölüm metniyle hizalı:
// hero → closeup(disiplin) → front(rapor) → top(sınav) → back(mobil) → final(hero/CTA).
const STATE_SCREENS: ScreenKind[] = [
  "hero",
  "discipline",
  "reports",
  "exam",
  "mobile",
  "hero",
];
const SCREEN_KINDS: ScreenKind[] = [
  "hero",
  "discipline",
  "reports",
  "exam",
  "mobile",
];

type ScreenController = (progress: number) => void;

const INTRO_Y_OFFSET = 2.5;
const INTRO_DURATION = 3.6;
const HERO_TEXT_REVEAL_AT = 1.8;
const MOBILE_Y_LIFT = 0.3;

// GLB dünya-frame'i (runtime ölçüm): ekran normali +X, uzun eksen +Y (model zaten
// dik). Ekranı kameraya (+Z) çevirmek için yaw; hero.y (π-0.70) parent'ta uygulandığı
// için onu da telafi eder: Ry(π-0.70 + yaw)·(+X) = +Z → yaw = 0.70 + π/2.
const MODEL_YAW = 0.7 - Math.PI / 2;

type ResolvedState = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

function resolveState(i: number, isMobile: boolean): ResolvedState {
  const s = SCROLL_STATES[i];
  if (!isMobile) {
    return { position: s.position, rotation: s.rotation, scale: s.scale };
  }
  return {
    position: [
      s.position[0] * MOBILE_POSITION_FACTOR,
      s.position[1] * MOBILE_POSITION_FACTOR + MOBILE_Y_LIFT,
      s.position[2] * MOBILE_POSITION_FACTOR,
    ],
    rotation: s.rotation,
    scale: s.scale * MOBILE_SCALE_FACTOR,
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Gerçek iPhone GLB modeli. Ekran (`screen.001` materyali) KlinoVax CanvasTexture
 * ile değiştirilir; model merkezlenip max-boyutu ≈ 1 birime ölçeklenir
 * (SCROLL_STATES model-bağımsız kalsın).
 */
type GlbPhoneProps = {
  controllerRef: React.MutableRefObject<ScreenController | null>;
};

function GlbPhone({ controllerRef }: GlbPhoneProps) {
  const { scene } = useGLTF(MODEL_URL);

  // Her ekran türü için bir CanvasTexture. flipY/center/rotation: overlay UV'sinde
  // içerik 180° ters + ayna çıkıyor → düzeltir.
  const screenTextures = useMemo(() => {
    const map = new Map<ScreenKind, THREE.CanvasTexture>();
    for (const kind of SCREEN_KINDS) {
      const tex = new THREE.CanvasTexture(createScreenCanvas(kind));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.flipY = false;
      tex.center.set(0.5, 0.5);
      tex.rotation = Math.PI;
      tex.needsUpdate = true;
      map.set(kind, tex);
    }
    return map;
  }, []);

  const { object, center, scale, overlayBase, overlayTop } = useMemo(() => {
    const root = scene.clone(true);
    let screenMesh: THREE.Mesh | null = null;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as (THREE.Material & { name?: string }) | undefined;
      const name = (mat?.name || mesh.name || "").toLowerCase();
      if (name.includes("screen")) {
        screenMesh = mesh;
      } else if (name.includes("glass") && !name.includes("lensing")) {
        // Ön cam transmissive → arkayı gösterip ekranı örtüyor; gizle.
        mesh.visible = false;
      }
    });

    // Ekranı ayrı opak düzlem(ler) olarak bindir. GLB ekran mesh'inin UV'leri modele
    // özgü (içeriğimizi yanlış eşler) → bunun yerine TEMİZ 0–1 UV'li PlaneGeometry
    // kullan. İki düzlem (base + top) üst üste: crossfade için top'un opacity'sini
    // scroll ilerlemesiyle sürürüz. top hafif daha dışarıda (z-fighting yok).
    let base: THREE.Mesh | null = null;
    let top: THREE.Mesh | null = null;
    const sm = screenMesh as THREE.Mesh | null;
    if (sm && sm.parent) {
      sm.geometry.computeBoundingBox();
      const bb = sm.geometry.boundingBox;
      if (bb) {
        const w = bb.max.y - bb.min.y;
        const h = bb.max.z - bb.min.z;
        const cx = (bb.max.x + bb.min.x) / 2;
        const cy = (bb.max.y + bb.min.y) / 2;
        const cz = (bb.max.z + bb.min.z) / 2;
        const makePlane = (outward: number) => {
          const g = new THREE.PlaneGeometry(w, h);
          // normal +Z → yerel X, yükseklik(+Y) → yerel Z, genişlik(+X) → yerel Y
          g.rotateX(Math.PI / 2);
          g.rotateZ(Math.PI / 2);
          // ekran merkezine taşı; normal (-X dışa) boyunca hafif öne
          g.translate(cx - outward, cy, cz);
          return g;
        };
        const baseMat = new THREE.MeshBasicMaterial({
          map: screenTextures.get(STATE_SCREENS[0]) ?? null,
          toneMapped: false,
          side: THREE.DoubleSide,
          // Canvas köşeleri rgba(0,0,0,0): transparent olmazsa alfa yok sayılıp
          // köşeler opak SİYAH render edilir (telefon köşelerindeki üçgenler).
          transparent: true,
        });
        const topMat = new THREE.MeshBasicMaterial({
          map: screenTextures.get(STATE_SCREENS[1]) ?? null,
          toneMapped: false,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        });
        base = new THREE.Mesh(makePlane(0.006), baseMat);
        top = new THREE.Mesh(makePlane(0.0066), topMat);
        sm.updateMatrix();
        base.applyMatrix4(sm.matrix);
        top.applyMatrix4(sm.matrix);
        base.renderOrder = 2;
        top.renderOrder = 3;
        sm.parent.add(base);
        sm.parent.add(top);
        sm.visible = false;
      }
    }

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const c = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(c);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return {
      object: root,
      center: c,
      scale: 1 / maxDim,
      overlayBase: base as THREE.Mesh | null,
      overlayTop: top as THREE.Mesh | null,
    };
  }, [scene, screenTextures]);

  // Scroll ilerlemesini ekran crossfade'ine bağla. controllerRef üzerinden
  // PhoneModel'in tek ScrollTrigger'ı bunu her update'te çağırır.
  useEffect(() => {
    markTexturesReady();
    if (!overlayBase || !overlayTop) return;
    const baseMat = overlayBase.material as THREE.MeshBasicMaterial;
    const topMat = overlayTop.material as THREE.MeshBasicMaterial;
    const seg = SCROLL_STATES.length - 1;
    let lastCur = -1;

    // Crossfade'i segment ortasında dar bir pencereye sıkıştır: her bölüm
    // yerleşikken (frac ~0 veya ~1) tek ekran net; blend yalnız telefon
    // bölümler arası hareket halindeyken kısa sürer → çift-pozlama/çakışma yok.
    const FADE_HALF = 0.1; // toplam geçiş genişliği = 0.2 (segment'in %20'si)
    const setProgress: ScreenController = (progress) => {
      const t = Math.max(0, Math.min(1, progress)) * seg;
      const cur = Math.min(Math.floor(t), seg - 1);
      const frac = t - cur;
      if (cur !== lastCur) {
        baseMat.map = screenTextures.get(STATE_SCREENS[cur]) ?? null;
        topMat.map = screenTextures.get(STATE_SCREENS[cur + 1]) ?? null;
        baseMat.needsUpdate = true;
        topMat.needsUpdate = true;
        lastCur = cur;
      }
      let opacity: number;
      if (frac <= 0.5 - FADE_HALF) opacity = 0;
      else if (frac >= 0.5 + FADE_HALF) opacity = 1;
      else opacity = (frac - (0.5 - FADE_HALF)) / (2 * FADE_HALF);
      topMat.opacity = opacity;
    };

    setProgress(0);
    controllerRef.current = setProgress;
    return () => {
      controllerRef.current = null;
    };
  }, [overlayBase, overlayTop, screenTextures, controllerRef]);

  useEffect(() => {
    const textures = screenTextures;
    return () => textures.forEach((t) => t.dispose());
  }, [screenTextures]);

  return (
    <group rotation={[0, MODEL_YAW, 0]}>
      <group scale={scale}>
        <group position={[-center.x, -center.y, -center.z]}>
          <primitive object={object} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);

type PhoneModelProps = {
  isMobile: boolean;
};

export function PhoneModel({ isMobile }: PhoneModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const screenCtrlRef = useRef<ScreenController | null>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const reduced = prefersReducedMotion();
    const hero = resolveState(0, isMobile);
    group.position.set(hero.position[0], hero.position[1], hero.position[2]);
    group.scale.setScalar(hero.scale);
    group.rotation.set(
      hero.rotation[0],
      hero.rotation[1] + (reduced ? 0 : INTRO_Y_OFFSET),
      hero.rotation[2]
    );
  }, [isMobile]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const reduced = prefersReducedMotion();
    const hero = resolveState(0, isMobile);
    const offFns: Array<() => void> = [];

    const ctx = gsap.context(() => {
      const buildScrollTimeline = () => {
        const tl = gsap.timeline({
          defaults: { duration: 1, ease: "none" },
          scrollTrigger: {
            trigger: "main",
            start: "top top",
            end: "bottom bottom",
            scrub: 1.5,
            invalidateOnRefresh: true,
            onUpdate: (self) => screenCtrlRef.current?.(self.progress),
          },
        });
        for (let i = 1; i < SCROLL_STATES.length; i++) {
          const s = resolveState(i, isMobile);
          const at = i - 1;
          tl.to(group.position, { x: s.position[0], y: s.position[1], z: s.position[2] }, at);
          tl.to(group.rotation, { x: s.rotation[0], y: s.rotation[1], z: s.rotation[2] }, at);
          tl.to(group.scale, { x: s.scale, y: s.scale, z: s.scale }, at);
        }
        ScrollTrigger.refresh();
      };

      if (reduced) {
        gsap.set("[data-hero-text]", { opacity: 1, y: 0 });
        offFns.push(
          onIntroStart(() => {
            unlockScroll();
            buildScrollTimeline();
          })
        );
        return;
      }

      gsap.set("[data-hero-text]", { opacity: 0, y: 22 });
      const intro = gsap.timeline({
        paused: true,
        onComplete: () => {
          unlockScroll();
          buildScrollTimeline();
        },
      });
      intro.to(
        group.rotation,
        { y: hero.rotation[1], duration: INTRO_DURATION, ease: "sine.inOut" },
        0
      );
      intro.to(
        "[data-hero-text]",
        { opacity: 1, y: 0, stagger: 0.12, duration: 0.85, ease: "power2.out" },
        HERO_TEXT_REVEAL_AT
      );
      offFns.push(onIntroStart(() => intro.play()));
    });

    return () => {
      offFns.forEach((off) => off());
      ctx.revert();
    };
  }, [isMobile]);

  return (
    <group ref={groupRef}>
      <GlbPhone controllerRef={screenCtrlRef} />
    </group>
  );
}
