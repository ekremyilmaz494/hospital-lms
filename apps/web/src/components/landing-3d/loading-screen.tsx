"use client";

import { useEffect, useState } from "react";
import {
  lockScroll,
  markIntroStart,
  onTexturesReady,
  unlockScroll,
} from "@/lib/scene-ready";

const READY_DELAY = 280; // texturesReady → fade başlangıcı
const READY_DELAY_REDUCED = 500;
const FADE_TO_INTRO = 520; // fade (0.5s) tamamlanınca markIntroStart
// Failsafe: 3D sahne hiç sinyal vermezse (WebGL yok, init başarısız, GL context loss)
// kullanıcı sonsuz loading'de kilitlenmesin — sayfa graceful degrade etsin.
const FAILSAFE_TIMEOUT = 8000;

/**
 * Preloader + scroll kilidi. Bar GERÇEK progress göstermez — CSS sweep'tir;
 * hazır sinyali `klinovax:texturesReady` event'idir. drei/three import ETMEZ
 * (ana bundle'ı şişirmemek için).
 */
export function LoadingScreen() {
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    lockScroll();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let fadeTimer = 0;
    let removeTimer = 0;
    let settled = false;

    const off = onTexturesReady(() => {
      settled = true;
      window.clearTimeout(failsafeTimer);
      fadeTimer = window.setTimeout(
        () => {
          setFading(true);
          removeTimer = window.setTimeout(() => {
            setHidden(true);
            markIntroStart();
          }, FADE_TO_INTRO);
        },
        reduced ? READY_DELAY_REDUCED : READY_DELAY
      );
    });

    // 3D sahne sinyal vermezse zorla aç + scroll kilidini kaldır (degrade).
    const failsafeTimer = window.setTimeout(() => {
      if (settled) return;
      setFading(true);
      window.setTimeout(() => {
        setHidden(true);
        markIntroStart();
        unlockScroll();
      }, FADE_TO_INTRO);
    }, FAILSAFE_TIMEOUT);

    return () => {
      off();
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      window.clearTimeout(failsafeTimer);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`l3d-loading${fading ? " is-fading" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="l3d-loading-inner">
        <span className="l3d-loading-logo">KlinoVax</span>
        <span className="l3d-loading-label">3D DENEYİM HAZIRLANIYOR</span>
        <span className="l3d-loading-bar">
          <span className="l3d-loading-bar-fill" />
        </span>
      </div>
      <span className="sr-only">Yükleniyor</span>
    </div>
  );
}
