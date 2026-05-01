/**
 * JSON → HTML slaytları → PNG screenshot'lar
 * Kullanım: node scripts/preview-slides.mjs scripts/input-kvkk-pro.json
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const inputArg = process.argv[2];
const raw =
  inputArg && existsSync(inputArg)
    ? readFileSync(inputArg, 'utf8')
    : readFileSync('/dev/stdin', 'utf8');
const data = JSON.parse(raw);

const OUT_DIR = 'scripts/preview';
mkdirSync(OUT_DIR, { recursive: true });

const B = {
  primary: '#0d9668',
  primaryDk: '#0a7a52',
  accent: '#f59e0b',
  accentLt: '#fef3c7',
  dark: '#0f172a',
  mid: '#475569',
  light: '#f1f5f9',
  white: '#FFFFFF',
  fTitle: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
  fBody: "'Inter', 'Segoe UI', sans-serif",
  hospital: data.hospital ?? 'Hastane LMS',
};

const base = `
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; background:white;
       font-family:${B.fBody}; -webkit-font-smoothing:antialiased; }
.slide { width:1280px; height:720px; position:relative; }
`;

/* ── HEADER ─────────────────────────────────────────────────── */
const header = (title, cur, tot) => `
  <div style="position:absolute;top:0;left:0;right:0;height:100px;background:${B.primary};display:flex;align-items:center;padding:0 40px;">
    <span style="font-family:${B.fTitle};font-size:26px;font-weight:800;color:white;flex:1;">${title}</span>
    ${tot ? `<span style="font-size:13px;color:#aaddbb;">${cur} / ${tot}</span>` : ''}
  </div>
  <div style="position:absolute;top:100px;left:0;right:0;height:6px;background:${B.accent};"></div>`;

/* ── FOOTER ─────────────────────────────────────────────────── */
const footer = () => `
  <div style="position:absolute;bottom:0;left:0;right:0;height:48px;background:${B.light};
              display:flex;align-items:center;padding:0 40px;">
    <span style="font-size:11px;color:${B.mid};">${B.hospital}</span>
  </div>`;

/* ── KAPAK ───────────────────────────────────────────────────── */
function coverHtml() {
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;left:0;top:0;width:680px;height:100%;background:${B.primaryDk};"></div>
    <div style="position:absolute;left:680px;top:0;right:0;height:100%;background:${B.primary};"></div>
    <div style="position:absolute;left:678px;top:0;width:7px;height:100%;background:${B.accent};"></div>
    <div style="position:absolute;left:50px;top:170px;width:120px;height:7px;background:${B.accent};"></div>
    <div style="position:absolute;left:50px;top:190px;width:610px;font-family:${B.fTitle};font-size:46px;font-weight:800;color:white;line-height:1.15;">${data.trainingTitle}</div>
    <div style="position:absolute;left:50px;top:440px;font-size:16px;color:#aaddbb;">${B.hospital}</div>
    <div style="position:absolute;left:50px;top:475px;font-size:13px;color:#7bbf9a;">${new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}</div>
    <div style="position:absolute;left:700px;top:60px;right:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:580px;">
      <div style="font-size:110px;line-height:1;">📋</div>
      <div style="font-size:14px;color:#cceedd;margin-top:12px;font-style:italic;">Eğitim Sunumu</div>
      <div style="font-size:22px;font-weight:700;color:${B.accent};margin-top:8px;">${data.slides.length} slayt</div>
    </div>
  </div></body></html>`;
}

/* ── BÖLÜM AYIRICI ───────────────────────────────────────────── */
function sectionHtml(s) {
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;inset:0;background:${B.dark};"></div>
    <div style="position:absolute;top:0;left:0;width:18px;height:100%;background:${B.primary};"></div>
    <div style="position:absolute;top:0;left:18px;width:4px;height:100%;background:${B.accent};"></div>
    ${s.sectionNumber ? `<div style="position:absolute;right:-20px;top:-40px;font-family:${B.fTitle};font-size:280px;font-weight:800;color:#1a2a1a;line-height:1;pointer-events:none;">${s.sectionNumber}</div>` : ''}
    <div style="position:absolute;left:60px;top:165px;font-size:13px;font-weight:700;color:${B.accent};letter-spacing:4px;">BÖLÜM ${s.sectionNumber ?? ''}</div>
    <div style="position:absolute;left:60px;top:195px;width:250px;height:5px;background:${B.primary};"></div>
    <div style="position:absolute;left:60px;top:215px;width:700px;font-family:${B.fTitle};font-size:42px;font-weight:800;color:white;line-height:1.2;">${s.title}</div>
    ${s.subtitle ? `<div style="position:absolute;left:60px;top:450px;width:700px;font-size:18px;color:#7a9a8a;font-style:italic;">${s.subtitle}</div>` : ''}
  </div></body></html>`;
}

/* ── STANDART İÇERİK ────────────────────────────────────────── */
function contentHtml(s, cur, tot) {
  const bullets = s.bullets ?? [];
  const itemH = bullets.length > 3 ? 78 : 93;
  const startY = 130;
  const fs = bullets.length > 3 ? 18 : 21;
  const items = bullets
    .map(
      (b, i) => `
    <div style="position:absolute;top:${startY + i * itemH}px;left:22px;right:40px;display:flex;align-items:flex-start;gap:16px;">
      <div style="min-width:40px;height:40px;border-radius:50%;background:${B.primary};display:flex;align-items:center;justify-content:center;
                  font-family:${B.fTitle};font-size:16px;font-weight:800;color:white;flex-shrink:0;margin-top:4px;">${i + 1}</div>
      <div style="font-size:${fs}px;color:${B.dark};line-height:1.4;padding-top:6px;">${b}</div>
    </div>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;inset:0;background:white;"></div>
    <div style="position:absolute;top:106px;left:0;width:6px;height:566px;background:${B.primary};"></div>
    ${header(s.title, cur, tot)}
    ${footer()}
    ${items}
  </div></body></html>`;
}

/* ── İSTATİSTİK ─────────────────────────────────────────────── */
function statHtml(s, cur, tot) {
  const st = s.stat ?? {};
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;inset:0;background:white;"></div>
    ${header(s.title, cur, tot)}
    ${footer()}
    <div style="position:absolute;top:140px;left:250px;right:250px;height:180px;background:${B.primary};border-radius:20px;
                display:flex;align-items:center;justify-content:center;">
      <span style="font-family:${B.fTitle};font-size:88px;font-weight:800;color:white;line-height:1;">${st.value ?? '—'}</span>
    </div>
    <div style="position:absolute;top:340px;left:80px;right:80px;text-align:center;font-family:${B.fTitle};font-size:22px;font-weight:700;color:${B.dark};">${st.label ?? ''}</div>
    <div style="position:absolute;top:390px;left:300px;right:300px;height:5px;background:${B.accent};border-radius:3px;"></div>
    ${st.context ? `<div style="position:absolute;top:410px;left:100px;right:100px;text-align:center;font-size:15px;color:${B.mid};font-style:italic;line-height:1.5;">${st.context}</div>` : ''}
  </div></body></html>`;
}

/* ── İKİ KOLON ───────────────────────────────────────────────── */
function twoColHtml(s, cur, tot) {
  const cols = (s.columns ?? []).slice(0, 2);
  const colHtml = cols
    .map(
      (col, ci) => `
    <div style="position:absolute;top:106px;${ci === 0 ? 'left:0;width:618px' : 'left:662px;width:618px'};bottom:48px;">
      <div style="height:52px;background:${ci === 0 ? B.primary : B.primaryDk};display:flex;align-items:center;padding:0 20px;">
        <span style="font-family:${B.fTitle};font-size:16px;font-weight:700;color:white;">${col.heading ?? ''}</span>
      </div>
      ${(col.bullets ?? [])
        .map(
          (b, i) => `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:10px 20px;border-bottom:1px solid ${B.light};">
          <div style="width:12px;height:12px;background:${B.accent};flex-shrink:0;margin-top:5px;border-radius:2px;"></div>
          <span style="font-size:16px;color:${B.dark};line-height:1.4;">${b}</span>
        </div>`
        )
        .join('')}
    </div>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;inset:0;background:white;"></div>
    ${header(s.title, cur, tot)}
    <div style="position:absolute;top:106px;left:620px;width:22px;bottom:48px;background:${B.accent};opacity:0.3;"></div>
    ${colHtml}
    ${footer()}
  </div></body></html>`;
}

/* ── ALINTI ──────────────────────────────────────────────────── */
function quoteHtml(s) {
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;inset:0;background:${B.light};"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:12px;background:${B.primary};"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:12px;background:${B.accent};"></div>
    <div style="position:absolute;top:20px;left:30px;font-family:${B.fTitle};font-size:180px;color:${B.primary};opacity:0.15;line-height:1;">"</div>
    <div style="position:absolute;top:80px;left:100px;right:100px;bottom:160px;display:flex;align-items:center;">
      <p style="font-size:26px;font-style:italic;color:${B.dark};line-height:1.6;text-align:left;">${s.quote ?? ''}</p>
    </div>
    <div style="position:absolute;bottom:100px;left:100px;width:140px;height:5px;background:${B.accent};border-radius:3px;"></div>
    <div style="position:absolute;bottom:60px;left:100px;font-family:${B.fTitle};font-size:16px;font-weight:700;color:${B.primary};">${s.author ?? ''}</div>
    ${s.role ? `<div style="position:absolute;bottom:36px;left:100px;font-size:13px;color:${B.mid};">${s.role}</div>` : ''}
  </div></body></html>`;
}

/* ── UYARI ───────────────────────────────────────────────────── */
function alertHtml(s, cur, tot) {
  const bullets = s.bullets ?? [];
  const itemH = bullets.length > 3 ? 72 : 85;
  const fs = bullets.length > 3 ? 17 : 20;
  const items = bullets
    .map(
      (b, i) => `
    <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:${itemH - 24}px;">
      <div style="min-width:32px;height:32px;border-radius:50%;background:${B.accent};display:flex;align-items:center;justify-content:center;
                  font-weight:800;color:white;font-size:16px;flex-shrink:0;margin-top:3px;">!</div>
      <span style="font-size:${fs}px;color:${B.dark};line-height:1.4;">${b}</span>
    </div>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;inset:0;background:white;"></div>
    ${header(s.title, cur, tot)}
    ${footer()}
    <div style="position:absolute;top:116px;left:24px;right:24px;bottom:58px;background:#fffbeb;border-radius:4px;">
      <div style="position:absolute;top:0;left:0;width:18px;height:100%;background:${B.accent};border-radius:4px 0 0 4px;"></div>
      <div style="position:absolute;top:12px;left:30px;right:20px;font-family:${B.fTitle};font-size:15px;font-weight:700;color:${B.accent};letter-spacing:2px;">⚠  DİKKAT — YÜKSEK RİSK</div>
      <div style="position:absolute;top:50px;left:30px;right:20px;bottom:16px;">${items}</div>
    </div>
  </div></body></html>`;
}

/* ── KAPANIŞ ─────────────────────────────────────────────────── */
function closingHtml() {
  return `<!DOCTYPE html><html><head><style>${base}</style></head><body><div class="slide">
    <div style="position:absolute;inset:0;background:${B.dark};"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:12px;background:${B.primary};"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:12px;background:${B.accent};"></div>
    <div style="position:absolute;top:85px;left:50%;transform:translateX(-50%);width:200px;height:200px;background:${B.primary};border-radius:24px;
                display:flex;align-items:center;justify-content:center;">
      <span style="font-size:90px;line-height:1;">✓</span>
    </div>
    <div style="position:absolute;top:310px;left:0;right:0;text-align:center;font-family:${B.fTitle};font-size:38px;font-weight:800;color:white;">Eğitim Tamamlandı</div>
    <div style="position:absolute;top:370px;left:50%;transform:translateX(-50%);display:flex;gap:8px;">
      <div style="width:80px;height:5px;background:${B.primary};border-radius:3px;"></div>
      <div style="width:80px;height:5px;background:${B.accent};border-radius:3px;"></div>
    </div>
    <div style="position:absolute;top:400px;left:0;right:0;text-align:center;font-size:17px;color:#7a9a8a;font-style:italic;">Sınav başlıyor — Başarılar dileriz</div>
    <div style="position:absolute;bottom:28px;left:0;right:0;text-align:center;font-size:12px;color:#3a5a4a;">${B.hospital}</div>
  </div></body></html>`;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

console.log('Slaytlar render ediliyor...');

const shot = async (html, name) => {
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: `${OUT_DIR}/${name}` });
  process.stdout.write('.');
};

await shot(coverHtml(), '00-kapak.png');

let ci = 0;
const contentTotal = data.slides.filter((s) => !['section', 'quote'].includes(s.layout)).length;

for (let i = 0; i < data.slides.length; i++) {
  const s = data.slides[i];
  const lay = s.layout ?? 'content';
  const idx = String(i + 1).padStart(2, '0');
  const slug =
    s.title
      ?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 28) ?? lay;
  const name = `${idx}-${slug}.png`;

  if (lay === 'section') await shot(sectionHtml(s), name);
  else if (lay === 'stat') {
    ci++;
    await shot(statHtml(s, ci, contentTotal), name);
  } else if (lay === 'two-col') {
    ci++;
    await shot(twoColHtml(s, ci, contentTotal), name);
  } else if (lay === 'quote') await shot(quoteHtml(s), name);
  else if (lay === 'alert') {
    ci++;
    await shot(alertHtml(s, ci, contentTotal), name);
  } else {
    ci++;
    await shot(contentHtml(s, ci, contentTotal), name);
  }
}

await shot(closingHtml(), `${String(data.slides.length + 1).padStart(2, '0')}-kapanis.png`);

await browser.close();
console.log(`\n\n✅ ${data.slides.length + 2} PNG → ${OUT_DIR}/\n`);
