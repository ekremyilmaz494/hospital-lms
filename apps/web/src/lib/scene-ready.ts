/**
 * LoadingScreen ↔ HeartModel koordinasyon sözleşmesi.
 *
 * Beş fazlı akış (3D landing):
 *   Phase 1  page mount      → lockScroll()        (preloader açılır, scroll kilitli)
 *   Phase 2  GLB loaded      → HeartModel mount
 *   Phase 3  materials ready → markTexturesReady() → LoadingScreen fade-out başlatır
 *   Phase 4  fade complete   → markIntroStart()    → HeartModel intro turntable oynatır
 *   Phase 5  intro complete  → unlockScroll() + scroll timeline kurulur
 *
 * Event'ler `{ once: true }`. Geç abone olunursa (event zaten ateşlendiyse)
 * `queueMicrotask` ile callback anında tetiklenir — yarış koşulu yok.
 * Tüm fonksiyonlar SSR-safe (`typeof window` guard).
 */

const TEXTURES_READY = 'klinovax:texturesReady';
const INTRO_START = 'klinovax:introStart';

let texturesReadyFired = false;
let introStartFired = false;

const isBrowser = (): boolean => typeof window !== 'undefined';

/** html+body overflow:hidden + scrollTo(0,0). Preloader mount'unda çağrılır. */
export function lockScroll(): void {
  if (!isBrowser()) return;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  window.scrollTo(0, 0);
}

/** Scroll kilidini açar. Intro tamamlanınca çağrılır. */
export function unlockScroll(): void {
  if (!isBrowser()) return;
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

/** Materyaller hazır — preloader'a kapanma sinyali. */
export function markTexturesReady(): void {
  if (!isBrowser() || texturesReadyFired) return;
  texturesReadyFired = true;
  window.dispatchEvent(new CustomEvent(TEXTURES_READY));
}

/** Preloader bu event'i bekler. Geç abone olursa anında tetiklenir. */
export function onTexturesReady(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  if (texturesReadyFired) {
    queueMicrotask(cb);
    return () => {};
  }
  window.addEventListener(TEXTURES_READY, cb, { once: true });
  return () => window.removeEventListener(TEXTURES_READY, cb);
}

/** Preloader fade tamamlandı — HeartModel intro'yu başlatabilir. */
export function markIntroStart(): void {
  if (!isBrowser() || introStartFired) return;
  introStartFired = true;
  window.dispatchEvent(new CustomEvent(INTRO_START));
}

/** HeartModel bu event'i bekler. Geç abone olursa anında tetiklenir. */
export function onIntroStart(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  if (introStartFired) {
    queueMicrotask(cb);
    return () => {};
  }
  window.addEventListener(INTRO_START, cb, { once: true });
  return () => window.removeEventListener(INTRO_START, cb);
}
