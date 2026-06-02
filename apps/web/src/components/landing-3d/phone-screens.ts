/**
 * Telefon ekranı içerikleri — Canvas2D ile çizilir, CanvasTexture olarak telefona basılır.
 * Her bölüm bir ekran. Scroll'da bölüm değiştikçe crossfade ile geçilir (sonraki artım).
 * Renkler marka token değerleriyle birebir (tokens.css --landing-*).
 *
 * Texture YALNIZCA ekranı çizer (beyaz yuvarlak dikdörtgen + UI). Dış köşeler
 * şeffaf; çerçeveyi 3B koyu gövde verir (ekran düzlemi gövdeden içeri alınmıştır).
 * Canvas oranı (W:H) ekran düzlemi oranına eşit → yuvarlak köşe dairesel kalır.
 */

export type ScreenKind = 'hero' | 'exam' | 'reports' | 'mobile' | 'discipline' | 'trust';

const C = {
  bg: '#ffffff',
  surface: '#f5f0e6',
  ink: '#1a3a28',
  inkSoft: '#4a7060',
  brand: '#0d9668',
  accent: '#f59e0b',
  rule: 'rgba(26,58,40,0.10)',
  white: '#ffffff',
  bezel: '#0a0f0c',
};

// Ekran düzlemi oranı (phone-model FRAME ile uyumlu): 0.44 : 0.94.
const W = 620;
const H = 1324;
// Ekran yuvarlak köşesi (gövde iç köşesi = PHONE_R - FRAME, px'e çevrili).
const SCREEN_R = 94;
// Aktif ekran ile gövde kenarı arasındaki koyu çerçeve (gerçek iPhone bezel'i).
// İnce ve üniform — ekran genişliğinin ~%1.6'sı.
const BEZEL = 10;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
): number {
  const words = text.split(' ');
  let line = '';
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY;
}

/** Sol-üst bölüm başlığı (eyebrow + iki satır display). */
function sectionTitle(
  ctx: CanvasRenderingContext2D,
  eyebrow: string,
  line1: string,
  line2: string
): void {
  ctx.textAlign = 'left';
  ctx.fillStyle = C.brand;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(eyebrow, 56, 210);
  ctx.fillStyle = C.ink;
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText(line1, 56, 286);
  ctx.fillText(line2, 56, 350);
}

function statusBar(ctx: CanvasRenderingContext2D): void {
  const y = 92;
  ctx.fillStyle = C.inkSoft;
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('09:41', 56, y);
  // sağ: batarya glifi
  const bx = W - 56;
  ctx.fillRect(bx - 44, y - 22, 40, 20);
  ctx.fillStyle = C.bg;
  ctx.fillRect(bx - 42, y - 20, 30, 16);
  ctx.fillStyle = C.inkSoft;
  ctx.fillRect(bx - 40, y - 18, 24, 12);
}

function pill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  h: number,
  bg: string,
  fg: string,
  text: string
): void {
  roundRect(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic';
}

// ── Ekran görselleri (fal.ai) — async yüklenir, drawImage ile basılır ────────
const SCREEN_IMAGES: Partial<Record<ScreenKind, string>> = {
  hero: '/landing-3d/screen-hero.webp',
  discipline: '/landing-3d/screen-video.webp',
  reports: '/landing-3d/screen-report.webp',
  exam: '/landing-3d/screen-exam.webp',
  mobile: '/landing-3d/screen-cert.webp',
  trust: '/logos/devakent.png',
};
const imageCache = new Map<string, HTMLImageElement>();

/** Ekran görsellerini önyükle; tümü çözülünce (veya hata) resolve eder. */
export function preloadScreenImages(): Promise<void> {
  const urls = Array.from(new Set(Object.values(SCREEN_IMAGES)));
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            imageCache.set(url, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);
}

/** Yuvarlak köşeli kutuya görseli "cover" (kırparak doldur) çizer. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const ir = img.width / img.height;
  const tr = w / h;
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > tr) {
    dh = h;
    dw = h * ir;
    dx = x - (dw - w) / 2;
    dy = y;
  } else {
    dw = w;
    dh = w / ir;
    dx = x;
    dy = y - (dh - h) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Görseli kutuya "contain" (tamamı sığar, kırpılmaz) ortalı çizer — logolar için. */
function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const ir = img.width / img.height;
  const tr = w / h;
  let dw: number, dh: number;
  if (ir > tr) {
    dw = w;
    dh = w / ir;
  } else {
    dh = h;
    dw = h * ir;
  }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Görsel üstüne amber play butonu (daire + üçgen). */
function playButton(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.accent;
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy - r * 0.45);
  ctx.lineTo(cx - r * 0.3, cy + r * 0.45);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.closePath();
  ctx.fill();
}

// ── HERO ───────────────────────────────────────────────────────────────────
function drawHero(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);

  ctx.textAlign = 'center';
  ctx.font = `800 62px ${FONT}`;
  ctx.fillStyle = C.brand;
  ctx.fillText('KlinoVax', W / 2, 250);

  ctx.fillStyle = C.ink;
  ctx.font = `800 50px ${FONT}`;
  ctx.fillText('Eğitimin hazır.', W / 2, 360);

  // Video thumbnail kartı (fal.ai görseli) + play
  const tx = 56;
  const ty = 432;
  const tw = W - 112;
  const th = 430;
  const heroImg = imageCache.get(SCREEN_IMAGES.hero ?? '');
  if (heroImg) {
    drawImageCover(ctx, heroImg, tx, ty, tw, th, 28);
  } else {
    roundRect(ctx, tx, ty, tw, th, 28);
    ctx.fillStyle = C.surface;
    ctx.fill();
  }
  playButton(ctx, W / 2, ty + th / 2, 76);

  pill(ctx, W / 2, 980, 380, 96, C.brand, C.white, 'Eğitime Başla');

  // alt: referans
  ctx.textAlign = 'center';
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('Özel Devakent Hastanesi', W / 2, 1208);
  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = C.brand;
  ctx.fillText('güveniyor', W / 2, 1246);
}

// ── DISCIPLINE — ileri sarmasız video + ön/son sınav ────────────────────────
function drawDiscipline(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  sectionTitle(ctx, 'KLİNİK DİSİPLİN', 'Eğitim,', 'disiplinle.');

  // Video çerçevesi — fal.ai eğitim görseli (yoksa koyu zemin)
  const vx = 56;
  const vy = 408;
  const vw = W - 112;
  const vh = 320;
  const vidImg = imageCache.get(SCREEN_IMAGES.discipline ?? '');
  if (vidImg) {
    drawImageCover(ctx, vidImg, vx, vy, vw, vh, 28);
    // alt kısma okunabilirlik için hafif koyu gradyan
    ctx.save();
    roundRect(ctx, vx, vy, vw, vh, 28);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, vy + vh - 120, 0, vy + vh);
    grad.addColorStop(0, 'rgba(10,15,12,0)');
    grad.addColorStop(1, 'rgba(10,15,12,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(vx, vy + vh - 120, vw, 120);
    ctx.restore();
  } else {
    roundRect(ctx, vx, vy, vw, vh, 28);
    ctx.fillStyle = C.ink;
    ctx.fill();
  }
  // Play butonu
  playButton(ctx, W / 2, vy + vh / 2 - 14, 54);
  // "İleri sarma kapalı" rozeti
  pill(ctx, W / 2, vy + vh - 78, 320, 60, C.accent, C.white, 'İleri sarma kapalı');

  // İlerleme çubuğu
  const bx = 56;
  const by = vy + vh + 54;
  const bw = W - 112;
  roundRect(ctx, bx, by, bw, 16, 8);
  ctx.fillStyle = C.rule;
  ctx.fill();
  roundRect(ctx, bx, by, bw * 0.62, 16, 8);
  ctx.fillStyle = C.brand;
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = C.inkSoft;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('%62 izlendi', bx, by + 58);

  // Ön/son sınav durum çipleri
  const chipY = by + 96;
  pill(ctx, W / 2 - 150, chipY, 260, 70, C.surface, C.brand, 'Ön sınav ✓');
  pill(ctx, W / 2 + 150, chipY, 260, 70, C.surface, C.inkSoft, 'Son sınav');
}

// ── REPORTS — otomatik denetim raporu ────────────────────────────────────────
function drawReports(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  sectionTitle(ctx, 'DENETİME HAZIR', 'Raporlar,', 'otomatik.');

  // Analitik görseli (fal.ai) — yoksa açık zemin
  const bx = 56;
  const bw = W - 112;
  const iy = 408;
  const ih = 360;
  const img = imageCache.get(SCREEN_IMAGES.reports ?? '');
  if (img) {
    drawImageCover(ctx, img, bx, iy, bw, ih, 28);
  } else {
    roundRect(ctx, bx, iy, bw, ih, 28);
    ctx.fillStyle = C.surface;
    ctx.fill();
  }

  // Başarı oranı
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = `800 80px ${FONT}`;
  ctx.fillText('%94', bx, iy + ih + 112);
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('ortalama başarı oranı', bx, iy + ih + 156);

  // KVKK uyum rozeti
  pill(ctx, W / 2, iy + ih + 232, 380, 84, C.surface, C.brand, 'Denetime hazır');
}

// ── EXAM — otomatik değerlendirilen sınav ───────────────────────────────────
function drawExam(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.brand;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('OTOMATİK SINAV', 56, 182);

  // Banner görseli (fal.ai)
  const bx = 56;
  const bw = W - 112;
  const iy = 210;
  const ih = 224;
  const img = imageCache.get(SCREEN_IMAGES.exam ?? '');
  if (img) {
    drawImageCover(ctx, img, bx, iy, bw, ih, 28);
  } else {
    roundRect(ctx, bx, iy, bw, ih, 28);
    ctx.fillStyle = C.surface;
    ctx.fill();
  }

  ctx.fillStyle = C.ink;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('Soru 3 / 10', 56, iy + ih + 62);

  // Soru metni
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 30px ${FONT}`;
  wrapText(
    ctx,
    'Temel yaşam desteğinde kompresyon hızı kaç olmalı?',
    56,
    iy + ih + 116,
    W - 112,
    42
  );

  // Şıklar
  const opts = ['80–90 / dk', '100–120 / dk', '60–70 / dk', '140+ / dk'];
  const correct = 1;
  let oy = iy + ih + 196;
  opts.forEach((o, i) => {
    roundRect(ctx, 56, oy, W - 112, 88, 18);
    ctx.fillStyle = i === correct ? C.brand : C.surface;
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = i === correct ? C.white : C.ink;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(o, 92, oy + 54);
    oy += 104;
  });

  // Otomatik değerlendirme notu
  ctx.textAlign = 'center';
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('Anında otomatik değerlendirme', W / 2, oy + 30);
}

// ── MOBILE — her yerden erişim + sertifika ──────────────────────────────────
function drawMobile(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  sectionTitle(ctx, 'HER YERDEN', 'Cebinde,', 'her an.');

  // Sertifika kartı — fal.ai görseli + alt gradyan + beyaz metin
  const cx = 56;
  const cy = 432;
  const cw = W - 112;
  const ch = 470;
  const img = imageCache.get(SCREEN_IMAGES.mobile ?? '');
  if (img) {
    drawImageCover(ctx, img, cx, cy, cw, ch, 28);
    ctx.save();
    roundRect(ctx, cx, cy, cw, ch, 28);
    ctx.clip();
    const g = ctx.createLinearGradient(0, cy + ch - 200, 0, cy + ch);
    g.addColorStop(0, 'rgba(10,15,12,0)');
    g.addColorStop(1, 'rgba(10,15,12,0.78)');
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy + ch - 200, cw, 200);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = C.white;
    ctx.font = `700 42px ${FONT}`;
    ctx.fillText('Sertifika hazır', cx + 36, cy + ch - 64);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `500 26px ${FONT}`;
    ctx.fillText('Eğitim tamamlandı', cx + 36, cy + ch - 26);
  } else {
    roundRect(ctx, cx, cy, cw, ch, 28);
    ctx.fillStyle = C.surface;
    ctx.fill();
  }

  // İndir butonu
  pill(ctx, W / 2, cy + ch + 46, 360, 96, C.accent, C.white, 'Sertifikayı indir');

  // Etiket
  ctx.textAlign = 'center';
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('Vardiyada · Evde · Serviste', W / 2, cy + ch + 152);
}

// ── TRUST — sahada kanıtlı referans (Devakent logosu) ───────────────────────
function drawTrust(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  sectionTitle(ctx, 'GÜVENİYOR', 'Sahada', 'kanıtlı.');

  // Logo kartı — Devakent logosu (contain, kırpmasız), açık zemin.
  const cx = 56;
  const cy = 430;
  const cw = W - 112;
  const ch = 300;
  roundRect(ctx, cx, cy, cw, ch, 28);
  ctx.fillStyle = C.surface;
  ctx.fill();
  const logo = imageCache.get(SCREEN_IMAGES.trust ?? '');
  if (logo) {
    drawImageContain(ctx, logo, cx + 64, cy + 84, cw - 128, ch - 168);
  }

  // Hastane adı (iki satır, ortalı).
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('Özel', W / 2, cy + ch + 96);
  ctx.fillText('Devakent Hastanesi', W / 2, cy + ch + 144);

  // Etiket — uçtan uca eğitim tercihi.
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('Sağlık kurumlarının uçtan uca', W / 2, cy + ch + 200);
  ctx.fillText('eğitim tercihi', W / 2, cy + ch + 238);

  // Rozet — aktif kullanım.
  pill(ctx, W / 2, cy + ch + 296, 360, 84, C.brand, C.white, 'Aktif kullanımda');
}

const DRAWERS: Record<ScreenKind, (ctx: CanvasRenderingContext2D) => void> = {
  hero: drawHero,
  exam: drawExam,
  reports: drawReports,
  mobile: drawMobile,
  discipline: drawDiscipline,
  trust: drawTrust,
};

/** Verilen ekran türünü mevcut bir canvas'a çizer (görsel yüklenince yeniden çağrılır). */
export function drawScreen(canvas: HTMLCanvasElement, kind: ScreenKind): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Şeffaf zemin — dış köşeler boş (3B gövde köşeden görünür).
  ctx.clearRect(0, 0, W, H);

  // Bezel — cam altı koyu çerçeve, tüm ön yüzü kaplar (yuvarlak köşeli).
  ctx.save();
  roundRect(ctx, 0, 0, W, H, SCREEN_R);
  ctx.clip();
  ctx.fillStyle = C.bezel;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Aktif ekran — bezel kadar içeride, beyaz, UI clip'li.
  ctx.save();
  roundRect(ctx, BEZEL, BEZEL, W - 2 * BEZEL, H - 2 * BEZEL, SCREEN_R - BEZEL);
  ctx.clip();
  ctx.fillStyle = C.bg;
  ctx.fillRect(BEZEL, BEZEL, W - 2 * BEZEL, H - 2 * BEZEL);
  (DRAWERS[kind] ?? drawHero)(ctx);
  ctx.restore();

  // Dynamic Island — ekran üstünde ortada.
  const islandW = 196;
  const islandH = 52;
  roundRect(ctx, W / 2 - islandW / 2, 40, islandW, islandH, islandH / 2);
  ctx.fillStyle = C.bezel;
  ctx.fill();

  // Home indicator — alt orta ince çubuk (gerçek iOS ekranı).
  const hiW = 150;
  const hiH = 9;
  roundRect(ctx, W / 2 - hiW / 2, H - 34, hiW, hiH, hiH / 2);
  ctx.fillStyle = 'rgba(26,58,40,0.32)';
  ctx.fill();
}

/** Verilen ekran türünü çizip yeni bir <canvas> döndürür (CanvasTexture kaynağı). */
export function createScreenCanvas(kind: ScreenKind): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  drawScreen(canvas, kind);
  return canvas;
}
