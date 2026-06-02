"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type ProceduralEnvironmentProps = {
  /** scene.environmentIntensity değeri (mobilde 1.0). */
  intensity?: number;
};

/**
 * Mobil/tablet IBL kaynağı. HDR dosyası indirmeden (network maliyeti yok)
 * RoomEnvironment'ı PMREMGenerator ile prefiltered cube map'e çevirip
 * scene.environment'a bağlar. Hem desktop (intensity 1.2) hem mobil (1.0) bunu kullanır —
 * harici HDR CDN'i (drei studio preset) offline/CDN-down'da sayfayı çökertirdi.
 */
export function ProceduralEnvironment({ intensity = 1 }: ProceduralEnvironmentProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const renderTarget = pmrem.fromScene(room, 0.04);

    const prevEnv = scene.environment;
    // Three.js scene mutasyonu R3F'in standart IBL pattern'i — hook değeri kasıtlı değişir.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = renderTarget.texture;
     
    scene.environmentIntensity = intensity;

    return () => {
      scene.environment = prevEnv;
      renderTarget.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene, intensity]);

  return null;
}
