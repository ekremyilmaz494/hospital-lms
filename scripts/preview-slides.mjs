/**
 * JSON → HTML slaytları → PNG screenshot'lar
 * Kullanım: cat input-kvkk.json | node scripts/preview-slides.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('/dev/stdin', 'utf8'));
const OUT_DIR = 'scripts/preview';
mkdirSync(OUT_DIR, { recursive: true });

const BRAND = {
  primary: '#0d9668',
  accent: '#f59e0b',
  bg: '#f1f5f9',
  textDark: '#1e293b',
  textMid: '#475569',
  hospital: 'Örnek Devlet Hastanesi',
};

const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1280px; height: 720px; overflow: hidden;
         font-family: 'Inter', -apple-system, sans-serif; }
  .slide { width: 1280px; height: 720px; position: relative; background: white; }
  .h1 { font-family: 'Plus Jakarta Sans', sans-serif; }
`;

function coverHtml() {
  return `<!DOCTYPE html><html><head><style>${baseStyles}
    .cover { background: ${BRAND.primary}; width: 100%; height: 100%; position: relative; }
    .accent { position: absolute; right: 0; top: 0; width: 28%; height: 100%; background: ${BRAND.accent}; }
    .title { position: absolute; left: 60px; top: 200px; max-width: 760px;
             color: white; font-size: 56px; font-weight: 800; line-height: 1.15; }
    .hosp { position: absolute; left: 60px; top: 540px; color: #d4f7e4; font-size: 22px; }
    .date { position: absolute; left: 60px; top: 580px; color: #a8d9bd; font-size: 16px; }
  </style></head><body><div class="slide cover">
    <div class="accent"></div>
    <div class="title h1">${data.trainingTitle}</div>
    <div class="hosp">${BRAND.hospital}</div>
    <div class="date">${new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}</div>
  </div></body></html>`;
}

function contentHtml(s, i, total) {
  const bullets = s.bullets
    .map(
      (b, k) => `
    <li><span class="num">${['①', '②', '③', '④'][k] ?? '•'}</span><span class="txt">${b}</span></li>
  `
    )
    .join('');
  return `<!DOCTYPE html><html><head><style>${baseStyles}
    .top { position: absolute; top: 0; left: 0; right: 0; height: 110px; background: ${BRAND.primary}; }
    .left { position: absolute; top: 110px; left: 0; width: 9px; height: 560px; background: ${BRAND.accent}; }
    .bottom { position: absolute; bottom: 35px; left: 0; right: 0; height: 6px; background: ${BRAND.accent}; }
    .title { position: absolute; left: 32px; top: 28px; color: white; font-size: 32px; font-weight: 800; max-width: 1100px; }
    .pageno { position: absolute; right: 32px; top: 38px; color: #b6e6c8; font-size: 16px; font-weight: 500; }
    .body { position: absolute; left: 32px; top: 150px; right: 32px; bottom: 60px; }
    ul { list-style: none; }
    li { display: flex; gap: 18px; margin-bottom: 22px; align-items: flex-start; }
    .num { color: ${BRAND.primary}; font-weight: 800; font-size: 26px; min-width: 36px;
           font-family: 'Plus Jakarta Sans', sans-serif; }
    .txt { color: ${BRAND.textDark}; font-size: 22px; line-height: 1.5; }
  </style></head><body><div class="slide">
    <div class="top"></div><div class="left"></div><div class="bottom"></div>
    <div class="title h1">${s.title}</div>
    <div class="pageno">${i + 1} / ${total}</div>
    <div class="body"><ul>${bullets}</ul></div>
  </div></body></html>`;
}

function closingHtml() {
  return `<!DOCTYPE html><html><head><style>${baseStyles}
    .slide { background: ${BRAND.bg}; display: flex; flex-direction: column;
             align-items: center; justify-content: center; }
    .ty { color: ${BRAND.primary}; font-size: 76px; font-weight: 800; margin-bottom: 30px; }
    .bar { display: flex; gap: 6px; margin-bottom: 30px; }
    .bar div { width: 60px; height: 6px; }
    .b1 { background: ${BRAND.primary}; }
    .b2 { background: ${BRAND.accent}; }
    .sub { color: ${BRAND.textMid}; font-size: 22px; margin-bottom: 80px; }
    .hosp { color: ${BRAND.textMid}; font-size: 14px; position: absolute; bottom: 50px; }
  </style></head><body><div class="slide">
    <div class="ty h1">Teşekkürler</div>
    <div class="bar"><div class="b1"></div><div class="b2"></div></div>
    <div class="sub">Eğitim tamamlandı — Sınav başlıyor</div>
    <div class="hosp">${BRAND.hospital}</div>
  </div></body></html>`;
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

console.log('Slaytlar render ediliyor...');

// Kapak
await page.setContent(coverHtml(), { waitUntil: 'load' });
await page.screenshot({ path: `${OUT_DIR}/01-kapak.png` });

// İçerik
for (let i = 0; i < data.slides.length; i++) {
  await page.setContent(contentHtml(data.slides[i], i, data.slides.length), { waitUntil: 'load' });
  const num = String(i + 2).padStart(2, '0');
  await page.screenshot({
    path: `${OUT_DIR}/${num}-${data.slides[i].title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .slice(0, 30)}.png`,
  });
}

// Kapanış
const last = String(data.slides.length + 2).padStart(2, '0');
await page.setContent(closingHtml(), { waitUntil: 'load' });
await page.screenshot({ path: `${OUT_DIR}/${last}-kapanis.png` });

await browser.close();
console.log(`\n✅ ${data.slides.length + 2} PNG hazır: ${OUT_DIR}/`);
