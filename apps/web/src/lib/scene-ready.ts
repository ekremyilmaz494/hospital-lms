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
 *
 * Derin link (`/#egitim`): preloader `lockScroll()` ile sayfayı en üste alır; bu yüzden
 * başka sayfadan `/#egitim`'e client navigasyonunda Next'in hash kaydırması ezilir ve
 * kullanıcı hero'da kalır. `getDeepLinkTarget` + `scrollToDeepLinkTarget` kilit açıldıktan
 * SONRA hedef bölüme anlık atlamayı sağlar (bkz. PhoneModel, LoadingScreen).
 */

const TEXTURES_READY = 'klinovax:texturesReady';
const INTRO_START = 'klinovax:introStart';

let texturesReadyFired = false;
let introStartFired = false;
/**
 * Derin link "silahlı" mı? `lockScroll()` (sayfa girişi: ilk yükleme veya başka sayfadan
 * client navigasyon) silahlar; hedefe başarıyla inilince (`scrollToDeepLinkTarget`) bozulur.
 * Böylece URL'de kalan bayat hash (ör. header'dan tıklanan `/#kanit`) sonradan 768px sınırını
 * geçen resize'ın tetiklediği Scene remount'unda kullanıcıyı eski bölüme geri atmaz.
 */
let deepLinkArmed = false;

const isBrowser = (): boolean => typeof window !== 'undefined';

/** html+body overflow:hidden + scrollTo(0,0). Preloader mount'unda çağrılır. */
export function lockScroll(): void {
  if (!isBrowser()) return;
  deepLinkArmed = true;
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

/** Hero zaten sayfanın başı; `#hero` derin link sayılmaz (giriş animasyonu korunur). */
const HERO_SECTION_ID = 'hero';

/**
 * `location.hash` değerini bölüm id'sine çevirir (saf fonksiyon).
 * `''`, `'#'` ve `'#hero'` → `null` (derin link yok). Bozuk yüzde-kodlaması
 * (`'#%E0%A4%A'`) `decodeURIComponent` hatası verir → `null`.
 *
 * @param hash `window.location.hash` biçiminde (başında `#` olabilir) metin.
 * @returns Bölüm id'si veya derin link yoksa `null`.
 */
export function parseDeepLinkHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!id || id === HERO_SECTION_ID) return null;
  return id;
}

/**
 * Geçerli URL'deki derin link hedefinin id'sini döner. Her çağrıda `location.hash`
 * okunur — bu modül client navigasyonda yaşamaya devam ettiğinden SONUÇ CACHE'LENMEZ.
 *
 * Yalnızca (a) sayfa girişinde silahlanmışsa (`lockScroll` çağrılmış, hedefe henüz inilmemiş)
 * ve (b) hedef eleman DOM'da varsa döner. Eleman yoksa (`/#iletisim`, `/#fbclid=...`)
 * `null` döner; aksi halde giriş animasyonu atlanır ama kaydırma da yapılamazdı.
 */
export function getDeepLinkTarget(): string | null {
  if (!isBrowser() || !deepLinkArmed) return null;
  const id = parseDeepLinkHash(window.location.hash);
  if (!id) return null;
  return document.getElementById(id) ? id : null;
}

/**
 * Derin link hedefi bölüme ANLIK atlar (animasyonsuz). `html { scroll-behavior: smooth }`
 * global olduğundan geçici olarak `auto`'ya çekilir; aksi halde atlama yerine uzun bir
 * kayma olur ve telefon timeline'ı bölümlerin üstünden geçerdi.
 *
 * Idempotent: hedef yoksa veya element bulunamazsa hiçbir şey yapmaz.
 * @returns Kaydırma yapıldıysa `true`.
 */
export function scrollToDeepLinkTarget(): boolean {
  const id = getDeepLinkTarget();
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const root = document.documentElement;
  const prev = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  try {
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
  } finally {
    root.style.scrollBehavior = prev;
  }
  // Hedefe inildi: bu sayfa girişinin derin linki tüketildi (bayat hash'e karşı).
  deepLinkArmed = false;
  return true;
}
