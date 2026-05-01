/**
 * Profesyonel sunum üreticisi — 6 layout tipi
 *
 * Layout'lar: cover | section | content | stat | two-col | quote | alert | closing
 *
 * Kullanım:
 *   cat input.json | node scripts/generate-pro.mjs
 *   node scripts/generate-pro.mjs scripts/input-kvkk-pro.json
 */

import PptxGenJS from 'pptxgenjs';
import { readFileSync, existsSync } from 'fs';

const inputArg = process.argv[2];
const raw =
  inputArg && existsSync(inputArg)
    ? readFileSync(inputArg, 'utf8')
    : readFileSync('/dev/stdin', 'utf8');
const data = JSON.parse(raw);

// ─── MARKA ───────────────────────────────────────────────────────────────────
const B = {
  primary: '0d9668',
  primaryDk: '0a7a52',
  accent: 'f59e0b',
  accentLt: 'fef3c7',
  dark: '0f172a',
  mid: '475569',
  light: 'f1f5f9',
  white: 'FFFFFF',
  alertBg: 'fffbeb',
  alertBdr: 'f59e0b',
  fTitle: 'Plus Jakarta Sans',
  fBody: 'Inter',
  hospital: data.hospital ?? 'Hastane LMS',
};

// ─── YARDIMCI ─────────────────────────────────────────────────────────────────
const hex = (c) => c.replace('#', '');

/** Üst header şeridi + sayfa no */
function addHeader(slide, title, pageNum, total, darkBg = false) {
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.0, fill: { color: B.primary } });
  // İnce aksant çizgisi header altında
  slide.addShape('rect', { x: 0, y: 1.0, w: '100%', h: 0.055, fill: { color: B.accent } });
  slide.addText(title, {
    x: 0.4,
    y: 0.08,
    w: 8.6,
    h: 0.82,
    fontSize: 23,
    bold: true,
    color: B.white,
    fontFace: B.fTitle,
    valign: 'middle',
  });
  if (total) {
    slide.addText(`${pageNum} / ${total}`, {
      x: 8.7,
      y: 0.22,
      w: 1.1,
      h: 0.45,
      fontSize: 11,
      color: 'aaddbb',
      fontFace: B.fBody,
      align: 'right',
    });
  }
}

/** Alt footer bar */
function addFooter(slide, label) {
  slide.addShape('rect', { x: 0, y: 5.3, w: '100%', h: 0.45, fill: { color: B.light } });
  slide.addText(label ?? B.hospital, {
    x: 0.4,
    y: 5.32,
    w: 9.2,
    h: 0.38,
    fontSize: 10,
    color: B.mid,
    fontFace: B.fBody,
  });
}

// ─── LAYOUT'LAR ───────────────────────────────────────────────────────────────

/** KAPAK */
function addCover(pptx, data) {
  const s = pptx.addSlide();

  // Sol alan — koyu yeşil
  s.addShape('rect', { x: 0, y: 0, w: 6.8, h: '100%', fill: { color: B.primaryDk } });
  // Sağ alan — açık
  s.addShape('rect', { x: 6.8, y: 0, w: 3.2, h: '100%', fill: { color: B.primary } });
  // Dikey dekoratif çizgiler
  s.addShape('rect', { x: 6.78, y: 0, w: 0.07, h: '100%', fill: { color: B.accent } });
  s.addShape('rect', { x: 6.85, y: 0, w: 0.025, h: '100%', fill: { color: B.white } });

  // Sol: yatay üst aksant çizgisi
  s.addShape('rect', { x: 0.5, y: 1.7, w: 1.2, h: 0.07, fill: { color: B.accent } });

  // Başlık
  s.addText(data.trainingTitle, {
    x: 0.5,
    y: 1.9,
    w: 5.9,
    h: 2.0,
    fontSize: 38,
    bold: true,
    color: B.white,
    fontFace: B.fTitle,
    wrap: true,
    lineSpacingMultiple: 1.15,
  });

  // Alt bilgi
  s.addText(B.hospital, {
    x: 0.5,
    y: 4.4,
    w: 5.9,
    h: 0.45,
    fontSize: 15,
    color: 'aaddbb',
    fontFace: B.fBody,
  });
  s.addText(new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' }), {
    x: 0.5,
    y: 4.9,
    w: 5.9,
    h: 0.35,
    fontSize: 12,
    color: '7bbf9a',
    fontFace: B.fBody,
  });

  // Sağ panel: büyük dekoratif numara/ikon
  s.addText('📋', {
    x: 7.0,
    y: 0.6,
    w: 2.8,
    h: 2.0,
    fontSize: 96,
    align: 'center',
    valign: 'middle',
  });
  s.addText('Eğitim Sunumu', {
    x: 7.0,
    y: 2.7,
    w: 2.8,
    h: 0.6,
    fontSize: 13,
    color: 'cceedd',
    fontFace: B.fBody,
    align: 'center',
    italic: true,
  });
  s.addText(`${data.slides.length} slayt`, {
    x: 7.0,
    y: 3.3,
    w: 2.8,
    h: 0.45,
    fontSize: 18,
    bold: true,
    color: B.accent,
    fontFace: B.fTitle,
    align: 'center',
  });
}

/** BÖLÜM AYIRICI */
function addSection(pptx, s) {
  const slide = pptx.addSlide();

  // Tam arkaplan
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: B.dark } });

  // Sol aksant dikey bant
  slide.addShape('rect', { x: 0, y: 0, w: 0.18, h: '100%', fill: { color: B.primary } });
  slide.addShape('rect', { x: 0.18, y: 0, w: 0.04, h: '100%', fill: { color: B.accent } });

  // Büyük soluk bölüm numarası (arka planda)
  if (s.sectionNumber) {
    slide.addText(s.sectionNumber, {
      x: 5.5,
      y: -0.3,
      w: 4.5,
      h: 5.0,
      fontSize: 220,
      bold: true,
      color: '1a2a1a',
      fontFace: B.fTitle,
      align: 'right',
      valign: 'middle',
    });
  }

  // Bölüm etiketi
  slide.addText('BÖLÜM ' + (s.sectionNumber ?? ''), {
    x: 0.6,
    y: 1.6,
    w: 5.5,
    h: 0.5,
    fontSize: 13,
    color: B.accent,
    fontFace: B.fBody,
    bold: true,
    charSpacing: 4,
  });
  // Yatay çizgi
  slide.addShape('rect', { x: 0.6, y: 2.2, w: 2.5, h: 0.05, fill: { color: B.primary } });

  // Bölüm başlığı
  slide.addText(s.title, {
    x: 0.6,
    y: 2.35,
    w: 7.0,
    h: 1.8,
    fontSize: 36,
    bold: true,
    color: B.white,
    fontFace: B.fTitle,
    wrap: true,
    lineSpacingMultiple: 1.2,
  });

  // Alt yazı
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 0.6,
      y: 4.5,
      w: 7.0,
      h: 0.6,
      fontSize: 16,
      color: '7a9a8a',
      fontFace: B.fBody,
      italic: true,
    });
  }

  if (s.speakerNotes) slide.addNotes(s.speakerNotes);
}

/** STANDART İÇERİK */
function addContent(pptx, s, pageNum, total) {
  const slide = pptx.addSlide();
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: B.white } });
  addHeader(slide, s.title, pageNum, total);
  addFooter(slide, B.hospital);

  // Sol ince aksant çizgisi (header altından footer'a)
  slide.addShape('rect', { x: 0, y: 1.055, w: 0.06, h: 4.25, fill: { color: B.primary } });

  const bullets = s.bullets ?? [];
  const itemH = bullets.length > 3 ? 0.78 : 0.92;
  const startY = 1.25;

  bullets.forEach((b, i) => {
    const y = startY + i * itemH;
    // Numara dairesi
    slide.addShape('ellipse', {
      x: 0.18,
      y: y + 0.04,
      w: 0.42,
      h: 0.42,
      fill: { color: B.primary },
      line: { color: B.primary },
    });
    slide.addText(String(i + 1), {
      x: 0.18,
      y: y + 0.02,
      w: 0.42,
      h: 0.44,
      fontSize: 14,
      bold: true,
      color: B.white,
      fontFace: B.fTitle,
      align: 'center',
      valign: 'middle',
    });
    // Metin
    slide.addText(b, {
      x: 0.75,
      y: y,
      w: 8.8,
      h: itemH - 0.05,
      fontSize: bullets.length > 3 ? 17 : 19,
      color: B.dark,
      fontFace: B.fBody,
      valign: 'middle',
      wrap: true,
      lineSpacingMultiple: 1.2,
    });
  });

  if (s.speakerNotes) slide.addNotes(s.speakerNotes);
}

/** İSTATİSTİK / HERO RAKAM */
function addStat(pptx, s, pageNum, total) {
  const slide = pptx.addSlide();
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: B.white } });
  addHeader(slide, s.title, pageNum, total);
  addFooter(slide, B.hospital);

  const st = s.stat ?? {};

  // Büyük stat değeri — hap şekli arka plan
  slide.addShape('rect', {
    x: 2.5,
    y: 1.4,
    w: 5.0,
    h: 1.8,
    fill: { color: B.primary },
    rectRadius: 0.3,
    line: { color: B.primary },
  });
  slide.addText(st.value ?? '—', {
    x: 2.5,
    y: 1.4,
    w: 5.0,
    h: 1.8,
    fontSize: 72,
    bold: true,
    color: B.white,
    fontFace: B.fTitle,
    align: 'center',
    valign: 'middle',
  });

  // Etiket
  slide.addText(st.label ?? '', {
    x: 1.5,
    y: 3.3,
    w: 7.0,
    h: 0.55,
    fontSize: 20,
    bold: true,
    color: B.dark,
    fontFace: B.fTitle,
    align: 'center',
  });

  // Bağlam
  if (st.context) {
    slide.addShape('rect', { x: 2.0, y: 3.95, w: 6.0, h: 0.06, fill: { color: B.accent } });
    slide.addText(st.context, {
      x: 1.5,
      y: 4.1,
      w: 7.0,
      h: 0.8,
      fontSize: 14,
      color: B.mid,
      fontFace: B.fBody,
      align: 'center',
      italic: true,
      wrap: true,
    });
  }

  if (s.speakerNotes) slide.addNotes(s.speakerNotes);
}

/** İKİ KOLON */
function addTwoCol(pptx, s, pageNum, total) {
  const slide = pptx.addSlide();
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: B.white } });
  addHeader(slide, s.title, pageNum, total);
  addFooter(slide, B.hospital);

  const cols = s.columns ?? [];
  const colW = 4.4;
  const offsets = [0.2, 5.0];
  const divX = 4.8;

  // Dikey ayırıcı
  slide.addShape('rect', { x: divX, y: 1.15, w: 0.04, h: 4.0, fill: { color: B.accent } });

  cols.slice(0, 2).forEach((col, ci) => {
    const ox = offsets[ci];

    // Kolon başlık arka planı
    slide.addShape('rect', {
      x: ox,
      y: 1.12,
      w: colW,
      h: 0.52,
      fill: { color: ci === 0 ? B.primary : B.primaryDk },
      rectRadius: 0.08,
      line: { color: ci === 0 ? B.primary : B.primaryDk },
    });
    slide.addText(col.heading ?? '', {
      x: ox + 0.1,
      y: 1.12,
      w: colW - 0.2,
      h: 0.52,
      fontSize: 14,
      bold: true,
      color: B.white,
      fontFace: B.fTitle,
      valign: 'middle',
    });

    const bullets = col.bullets ?? [];
    bullets.forEach((b, i) => {
      const y = 1.78 + i * 0.72;
      slide.addShape('rect', { x: ox, y: y + 0.13, w: 0.12, h: 0.12, fill: { color: B.accent } });
      slide.addText(b, {
        x: ox + 0.2,
        y,
        w: colW - 0.25,
        h: 0.68,
        fontSize: 15,
        color: B.dark,
        fontFace: B.fBody,
        valign: 'middle',
        wrap: true,
        lineSpacingMultiple: 1.15,
      });
    });
  });

  if (s.speakerNotes) slide.addNotes(s.speakerNotes);
}

/** ALINTI */
function addQuote(pptx, s) {
  const slide = pptx.addSlide();
  // Soluk gradient benzeri: iki dikdörtgen
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: B.light } });
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: B.primary } });
  slide.addShape('rect', { x: 0, y: 5.63, w: '100%', h: 0.12, fill: { color: B.primary } });

  // Büyük dekoratif tırnak işareti
  slide.addText('“', {
    x: 0.3,
    y: 0.3,
    w: 2.0,
    h: 2.0,
    fontSize: 160,
    color: B.primary,
    fontFace: B.fTitle,
    valign: 'top',
  });

  // Alıntı metni
  slide.addText(s.quote ?? '', {
    x: 1.0,
    y: 0.9,
    w: 8.0,
    h: 3.2,
    fontSize: 24,
    italic: true,
    color: B.dark,
    fontFace: B.fBody,
    wrap: true,
    valign: 'middle',
    lineSpacingMultiple: 1.5,
    align: 'left',
  });

  // Yatay çizgi + atıf
  slide.addShape('rect', { x: 1.0, y: 4.25, w: 1.5, h: 0.05, fill: { color: B.accent } });
  slide.addText(s.author ?? '', {
    x: 1.0,
    y: 4.4,
    w: 7.0,
    h: 0.4,
    fontSize: 14,
    bold: true,
    color: B.primary,
    fontFace: B.fTitle,
  });
  if (s.role) {
    slide.addText(s.role, {
      x: 1.0,
      y: 4.82,
      w: 7.0,
      h: 0.35,
      fontSize: 12,
      color: B.mid,
      fontFace: B.fBody,
    });
  }

  if (s.speakerNotes) slide.addNotes(s.speakerNotes);
}

/** UYARI / KRİTİK */
function addAlert(pptx, s, pageNum, total) {
  const slide = pptx.addSlide();
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: B.white } });
  addHeader(slide, s.title, pageNum, total);
  addFooter(slide, B.hospital);

  // Uyarı kutusu arka plan
  slide.addShape('rect', { x: 0.25, y: 1.15, w: 9.5, h: 3.95, fill: { color: B.alertBg } });
  // Sol kalın aksant
  slide.addShape('rect', { x: 0.25, y: 1.15, w: 0.18, h: 3.95, fill: { color: B.accent } });

  // ⚠ ikonu + başlık
  slide.addText('⚠  DİKKAT', {
    x: 0.6,
    y: 1.25,
    w: 8.8,
    h: 0.55,
    fontSize: 16,
    bold: true,
    color: B.accent,
    fontFace: B.fTitle,
  });

  const bullets = s.bullets ?? [];
  const itemH = bullets.length > 3 ? 0.72 : 0.84;

  bullets.forEach((b, i) => {
    const y = 1.9 + i * itemH;
    slide.addText('!', {
      x: 0.55,
      y: y + 0.08,
      w: 0.32,
      h: 0.32,
      fontSize: 13,
      bold: true,
      color: B.white,
      fontFace: B.fTitle,
      align: 'center',
      valign: 'middle',
    });
    // Kırmızımsı küçük daire
    slide.addShape('ellipse', {
      x: 0.55,
      y: y + 0.08,
      w: 0.32,
      h: 0.32,
      fill: { color: B.accent },
      line: { color: B.accent },
    });
    slide.addText('!', {
      x: 0.55,
      y: y + 0.07,
      w: 0.32,
      h: 0.33,
      fontSize: 13,
      bold: true,
      color: B.white,
      fontFace: B.fTitle,
      align: 'center',
      valign: 'middle',
    });
    slide.addText(b, {
      x: 1.0,
      y,
      w: 8.5,
      h: itemH - 0.05,
      fontSize: bullets.length > 3 ? 16 : 18,
      color: B.dark,
      fontFace: B.fBody,
      valign: 'middle',
      wrap: true,
      lineSpacingMultiple: 1.2,
    });
  });

  if (s.speakerNotes) slide.addNotes(s.speakerNotes);
}

/** KAPANIŞ */
function addClosing(pptx, hospital) {
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: B.dark } });
  // Üst aksant çizgisi
  s.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: B.primary } });
  // Alt aksant çizgisi
  s.addShape('rect', { x: 0, y: 5.63, w: '100%', h: 0.12, fill: { color: B.accent } });
  // Ortada dekoratif onay işareti kutusu
  s.addShape('rect', {
    x: 3.8,
    y: 0.85,
    w: 2.4,
    h: 2.4,
    fill: { color: B.primary },
    rectRadius: 0.25,
    line: { color: B.primary },
  });
  s.addText('✓', {
    x: 3.8,
    y: 0.85,
    w: 2.4,
    h: 2.4,
    fontSize: 80,
    color: B.white,
    fontFace: B.fTitle,
    align: 'center',
    valign: 'middle',
  });
  s.addText('Eğitim Tamamlandı', {
    x: 0,
    y: 3.45,
    w: '100%',
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: B.white,
    fontFace: B.fTitle,
    align: 'center',
  });
  s.addShape('rect', { x: 3.8, y: 4.28, w: 0.9, h: 0.055, fill: { color: B.primary } });
  s.addShape('rect', { x: 5.3, y: 4.28, w: 0.9, h: 0.055, fill: { color: B.accent } });
  s.addText('Sınav başlıyor — Başarılar dileriz', {
    x: 0,
    y: 4.5,
    w: '100%',
    h: 0.45,
    fontSize: 15,
    color: '7a9a8a',
    fontFace: B.fBody,
    align: 'center',
    italic: true,
  });
  s.addText(hospital, {
    x: 0,
    y: 5.15,
    w: '100%',
    h: 0.35,
    fontSize: 11,
    color: '3a5a4a',
    fontFace: B.fBody,
    align: 'center',
  });
}

// ─── ANA RENDER ───────────────────────────────────────────────────────────────
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Hospital LMS';
pptx.company = B.hospital;
pptx.subject = data.trainingTitle;
pptx.title = data.trainingTitle;

addCover(pptx, data);

// İçerik slaytları için sıralı numara (section slaytları sayılmaz)
let contentIdx = 0;
const contentTotal = data.slides.filter((s) => !['section', 'quote'].includes(s.layout)).length;

data.slides.forEach((s) => {
  const layout = s.layout ?? 'content';
  if (layout === 'section') {
    addSection(pptx, s);
  } else if (layout === 'stat') {
    contentIdx++;
    addStat(pptx, s, contentIdx, contentTotal);
  } else if (layout === 'two-col') {
    contentIdx++;
    addTwoCol(pptx, s, contentIdx, contentTotal);
  } else if (layout === 'quote') {
    addQuote(pptx, s);
  } else if (layout === 'alert') {
    contentIdx++;
    addAlert(pptx, s, contentIdx, contentTotal);
  } else {
    contentIdx++;
    addContent(pptx, s, contentIdx, contentTotal);
  }
});

addClosing(pptx, B.hospital);

const slug = data.trainingTitle
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .slice(0, 40);
const out = `scripts/output-pro-${slug}.pptx`;

pptx.writeFile({ fileName: out }).then(() => {
  const total = data.slides.length + 2;
  console.log(`\n✅  Sunum hazır: ${out}`);
  console.log(`    Toplam slayt : ${total}`);
  console.log(`    Konu         : ${data.trainingTitle}`);
  const counts = data.slides.reduce((a, s) => {
    const l = s.layout ?? 'content';
    a[l] = (a[l] ?? 0) + 1;
    return a;
  }, {});
  console.log(
    `    Layout dağılımı: ${Object.entries(counts)
      .map(([k, v]) => `${k}×${v}`)
      .join(', ')}\n`
  );
});
