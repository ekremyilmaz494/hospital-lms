/**
 * Telefon ekranı içerikleri — Canvas2D ile çizilir, CanvasTexture olarak telefona basılır.
 * Her bölüm bir ekran. Scroll'da bölüm değiştikçe crossfade ile geçilir (sonraki artım).
 * Renkler marka token değerleriyle birebir (tokens.css --landing-*).
 *
 * Texture YALNIZCA ekranı çizer (beyaz yuvarlak dikdörtgen + UI). Dış köşeler
 * şeffaf; çerçeveyi 3B koyu gövde verir (ekran düzlemi gövdeden içeri alınmıştır).
 * Canvas oranı (W:H) ekran düzlemi oranına eşit → yuvarlak köşe dairesel kalır.
 */

export type ScreenKind =
  | "hero"
  | "exam"
  | "reports"
  | "mobile"
  | "discipline";

const C = {
  bg: "#ffffff",
  surface: "#f5f0e6",
  ink: "#1a3a28",
  inkSoft: "#4a7060",
  brand: "#0d9668",
  accent: "#f59e0b",
  rule: "rgba(26,58,40,0.10)",
  white: "#ffffff",
  bezel: "#0a0f0c",
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
  r: number,
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
  lineH: number,
): number {
  const words = text.split(" ");
  let line = "";
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
  line2: string,
): void {
  ctx.textAlign = "left";
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
  ctx.textAlign = "left";
  ctx.fillText("09:41", 56, y);
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
  text: string,
): void {
  roundRect(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y + h / 2 + 2);
  ctx.textBaseline = "alphabetic";
}

// ── HERO ───────────────────────────────────────────────────────────────────
function drawHero(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);

  ctx.textAlign = "center";
  ctx.font = `800 62px ${FONT}`;
  ctx.fillStyle = C.brand;
  ctx.fillText("KlinoVax", W / 2, 250);

  ctx.fillStyle = C.ink;
  ctx.font = `800 50px ${FONT}`;
  ctx.fillText("Eğitimin hazır.", W / 2, 360);

  // play daire
  const cx = W / 2;
  const cy = 720;
  ctx.beginPath();
  ctx.arc(cx, cy, 150, 0, Math.PI * 2);
  ctx.fillStyle = C.accent;
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.moveTo(cx - 45, cy - 70);
  ctx.lineTo(cx - 45, cy + 70);
  ctx.lineTo(cx + 80, cy);
  ctx.closePath();
  ctx.fill();

  pill(ctx, W / 2, 980, 380, 96, C.brand, C.white, "Eğitime Başla");

  // alt: referans
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("Özel Konya Devakent Hastanesi", W / 2, 1208);
  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = C.brand;
  ctx.fillText("güveniyor", W / 2, 1246);
}

// ── DISCIPLINE — ileri sarmasız video + ön/son sınav ────────────────────────
function drawDiscipline(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  sectionTitle(ctx, "KLİNİK DİSİPLİN", "Eğitim,", "disiplinle.");

  // Video çerçevesi (koyu)
  const vx = 56;
  const vy = 408;
  const vw = W - 112;
  const vh = 320;
  roundRect(ctx, vx, vy, vw, vh, 28);
  ctx.fillStyle = C.ink;
  ctx.fill();
  // Play üçgeni
  const pcx = W / 2;
  const pcy = vy + vh / 2 - 14;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.moveTo(pcx - 28, pcy - 38);
  ctx.lineTo(pcx - 28, pcy + 38);
  ctx.lineTo(pcx + 44, pcy);
  ctx.closePath();
  ctx.fill();
  // "İleri sarma kapalı" rozeti
  pill(ctx, W / 2, vy + vh - 78, 320, 60, C.accent, C.white, "İleri sarma kapalı");

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
  ctx.textAlign = "left";
  ctx.fillStyle = C.inkSoft;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText("%62 izlendi", bx, by + 58);

  // Ön/son sınav durum çipleri
  const chipY = by + 96;
  pill(ctx, W / 2 - 150, chipY, 260, 70, C.surface, C.brand, "Ön sınav ✓");
  pill(ctx, W / 2 + 150, chipY, 260, 70, C.surface, C.inkSoft, "Son sınav");
}

// ── REPORTS — otomatik denetim raporu ────────────────────────────────────────
function drawReports(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  sectionTitle(ctx, "DENETİME HAZIR", "Raporlar,", "otomatik.");

  // Bar grafiği
  const bx = 56;
  const baseY = 760;
  const bw = W - 112;
  const bars = [0.4, 0.62, 0.55, 0.8, 0.95];
  const gap = 28;
  const barW = (bw - gap * (bars.length - 1)) / bars.length;
  const maxH = 300;
  bars.forEach((v, i) => {
    const h = maxH * v;
    const x = bx + i * (barW + gap);
    roundRect(ctx, x, baseY - h, barW, h, 12);
    ctx.fillStyle = i === bars.length - 1 ? C.brand : C.surface;
    ctx.fill();
  });
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, baseY);
  ctx.lineTo(bx + bw, baseY);
  ctx.stroke();

  // Başarı oranı
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink;
  ctx.font = `800 72px ${FONT}`;
  ctx.fillText("%94", 56, 900);
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText("ortalama başarı oranı", 56, 944);

  // KVKK uyum rozeti
  pill(ctx, W / 2, 1060, 380, 84, C.surface, C.brand, "Denetime hazır");
}

// ── EXAM — otomatik değerlendirilen sınav ───────────────────────────────────
function drawExam(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  ctx.textAlign = "left";
  ctx.fillStyle = C.brand;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText("OTOMATİK SINAV", 56, 210);
  ctx.fillStyle = C.ink;
  ctx.font = `800 50px ${FONT}`;
  ctx.fillText("Soru 3 / 10", 56, 286);

  // Soru metni
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 32px ${FONT}`;
  wrapText(
    ctx,
    "Temel yaşam desteğinde kompresyon hızı kaç olmalı?",
    56,
    360,
    W - 112,
    44,
  );

  // Şıklar
  const opts = ["80–90 / dk", "100–120 / dk", "60–70 / dk", "140+ / dk"];
  const correct = 1;
  let oy = 520;
  opts.forEach((o, i) => {
    roundRect(ctx, 56, oy, W - 112, 96, 20);
    ctx.fillStyle = i === correct ? C.brand : C.surface;
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = i === correct ? C.white : C.ink;
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(o, 96, oy + 60);
    oy += 120;
  });

  // Otomatik değerlendirme notu
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("Anında otomatik değerlendirme", W / 2, oy + 36);
}

// ── MOBILE — her yerden erişim + sertifika ──────────────────────────────────
function drawMobile(ctx: CanvasRenderingContext2D): void {
  statusBar(ctx);
  sectionTitle(ctx, "HER YERDEN", "Cebinde,", "her an.");

  // Sertifika kartı
  const cx = 56;
  const cy = 440;
  const cw = W - 112;
  const ch = 420;
  roundRect(ctx, cx, cy, cw, ch, 28);
  ctx.fillStyle = C.surface;
  ctx.fill();

  // Onay dairesi + tik
  const ccx = W / 2;
  const ccy = cy + 150;
  ctx.beginPath();
  ctx.arc(ccx, ccy, 80, 0, Math.PI * 2);
  ctx.fillStyle = C.brand;
  ctx.fill();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(ccx - 36, ccy + 2);
  ctx.lineTo(ccx - 8, ccy + 32);
  ctx.lineTo(ccx + 42, ccy - 30);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = C.ink;
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText("Sertifika hazır", W / 2, cy + 300);
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("Eğitim tamamlandı", W / 2, cy + 346);

  // İndir butonu
  pill(ctx, W / 2, cy + ch + 48, 360, 96, C.accent, C.white, "Sertifikayı indir");

  // Etiket
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("Vardiyada · Evde · Serviste", W / 2, cy + ch + 156);
}

const DRAWERS: Record<ScreenKind, (ctx: CanvasRenderingContext2D) => void> = {
  hero: drawHero,
  exam: drawExam,
  reports: drawReports,
  mobile: drawMobile,
  discipline: drawDiscipline,
};

/** Verilen ekran türünü çizip <canvas> döndürür (CanvasTexture kaynağı). */
export function createScreenCanvas(kind: ScreenKind): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

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
  ctx.fillStyle = "rgba(26,58,40,0.32)";
  ctx.fill();

  return canvas;
}
