/**
 * Kullanım: node scripts/generate-from-json.mjs '<json>'
 * veya: cat sunum.json | node scripts/generate-from-json.mjs
 */

import PptxGenJS from 'pptxgenjs';
import { readFileSync } from 'fs';

const raw = process.argv[2] ?? readFileSync('/dev/stdin', 'utf8');
const data = JSON.parse(raw);

const BRAND = {
  primary: '#0d9668',
  accent: '#f59e0b',
  bg: '#f1f5f9',
  textDark: '#1e293b',
  textMid: '#475569',
  white: '#FFFFFF',
  fontTitle: 'Plus Jakarta Sans',
  fontBody: 'Inter',
  hospital: 'Örnek Devlet Hastanesi',
};

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Hospital LMS';
pptx.company = BRAND.hospital;
pptx.subject = data.trainingTitle;
pptx.title = data.trainingTitle;

// ── KAPAK ──────────────────────────────────────────────────────────────────
const cover = pptx.addSlide();
cover.addShape(pptx.ShapeType.rect, {
  x: 0,
  y: 0,
  w: '100%',
  h: '100%',
  fill: { color: BRAND.primary },
});
cover.addShape(pptx.ShapeType.rect, {
  x: 7.5,
  y: 0,
  w: 2.5,
  h: '100%',
  fill: { color: BRAND.accent },
});
cover.addText(data.trainingTitle, {
  x: 0.6,
  y: 1.2,
  w: 6.8,
  h: 2.0,
  fontSize: 38,
  bold: true,
  color: BRAND.white,
  fontFace: BRAND.fontTitle,
  wrap: true,
});
cover.addText(BRAND.hospital, {
  x: 0.6,
  y: 4.3,
  w: 6.8,
  h: 0.5,
  fontSize: 16,
  color: 'DDFFDD',
  fontFace: BRAND.fontBody,
});
cover.addText(new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' }), {
  x: 0.6,
  y: 4.85,
  w: 6.8,
  h: 0.4,
  fontSize: 13,
  color: 'AACCAA',
  fontFace: BRAND.fontBody,
});

// ── İÇERİK SLAYTLARI ───────────────────────────────────────────────────────
data.slides.forEach((slideData, idx) => {
  const slide = pptx.addSlide();

  // Arka plan
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: BRAND.white },
  });

  // Üst şerit
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.9,
    fill: { color: BRAND.primary },
  });

  // Sol aksant çizgisi
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.9,
    w: 0.07,
    h: 4.35,
    fill: { color: BRAND.accent },
  });

  // Alt ince çizgi
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 5.25,
    w: '100%',
    h: 0.05,
    fill: { color: BRAND.accent },
  });

  // Slayt no (üst şeritte sağ köşe)
  slide.addText(`${idx + 1} / ${data.slides.length}`, {
    x: 8.8,
    y: 0.1,
    w: 1.1,
    h: 0.55,
    fontSize: 11,
    color: 'AADDAA',
    fontFace: BRAND.fontBody,
    align: 'right',
  });

  // Başlık
  slide.addText(slideData.title, {
    x: 0.25,
    y: 0.08,
    w: 8.5,
    h: 0.7,
    fontSize: 22,
    bold: true,
    color: BRAND.white,
    fontFace: BRAND.fontTitle,
  });

  // Bullet'lar
  const bulletItems = slideData.bullets
    .map((b, i) => [
      {
        text: `${['①', '②', '③', '④'][i] ?? '•'} `,
        options: { bold: true, color: BRAND.primary, fontSize: 17, fontFace: BRAND.fontTitle },
      },
      {
        text: b + '\n',
        options: {
          fontSize: 16,
          color: BRAND.textDark,
          fontFace: BRAND.fontBody,
          paraSpaceAfter: 10,
        },
      },
    ])
    .flat();

  slide.addText(bulletItems, {
    x: 0.25,
    y: 1.05,
    w: 9.3,
    h: 4.1,
    valign: 'top',
    wrap: true,
  });

  // Speaker notes
  if (slideData.speakerNotes) {
    slide.addNotes(slideData.speakerNotes);
  }
});

// ── KAPANIŞ ────────────────────────────────────────────────────────────────
const closing = pptx.addSlide();
closing.addShape(pptx.ShapeType.rect, {
  x: 0,
  y: 0,
  w: '100%',
  h: '100%',
  fill: { color: BRAND.bg },
});
closing.addShape(pptx.ShapeType.rect, {
  x: 4.0,
  y: 2.6,
  w: 2.0,
  h: 0.07,
  fill: { color: BRAND.primary },
});
closing.addShape(pptx.ShapeType.rect, {
  x: 4.0,
  y: 3.15,
  w: 2.0,
  h: 0.07,
  fill: { color: BRAND.accent },
});
closing.addText('Teşekkürler', {
  x: 0,
  y: 1.3,
  w: '100%',
  h: 1.2,
  fontSize: 48,
  bold: true,
  color: BRAND.primary,
  fontFace: BRAND.fontTitle,
  align: 'center',
});
closing.addText('Eğitim tamamlandı — Sınav başlıyor', {
  x: 0,
  y: 3.35,
  w: '100%',
  h: 0.6,
  fontSize: 15,
  color: BRAND.textMid,
  fontFace: BRAND.fontBody,
  align: 'center',
});
closing.addText(BRAND.hospital, {
  x: 0,
  y: 4.9,
  w: '100%',
  h: 0.4,
  fontSize: 11,
  color: BRAND.textMid,
  fontFace: BRAND.fontBody,
  align: 'center',
});

// ── KAYDET ─────────────────────────────────────────────────────────────────
const slug = data.trainingTitle
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9\-]/g, '')
  .slice(0, 40);
const out = `scripts/output-${slug}.pptx`;
pptx.writeFile({ fileName: out }).then(() => {
  console.log(`\n✅ Sunum hazır: ${out}`);
  console.log(
    `   Slayt : ${data.slides.length + 2} (kapak + ${data.slides.length} içerik + kapanış)`
  );
  console.log(`   Konu  : ${data.trainingTitle}\n`);
});
