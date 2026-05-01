/**
 * Demo: Yapay zeka JSON → pptxgenjs → .pptx
 *
 * Kullanım: node scripts/demo-presentation.mjs
 * Çıktı: scripts/output-demo.pptx
 */

import PptxGenJS from 'pptxgenjs';
import { writeFileSync } from 'fs';

// ─── 1. YAPAY ZEKA ÇIKTISI (Gerçekte OpenRouter'dan gelecek) ────────────────
// Bu JSON'u Claude/GPT'ye şu prompt ile üretiyoruz:
//
//  "Aşağıdaki eğitim metnini 6 slayta dönüştür. JSON döndür:
//   { slides: [{ title, bullets: string[], speakerNotes }] }
//   Maksimum 4 bullet per slayt."

const AI_JSON_OUTPUT = {
  trainingTitle: 'El Hijyeni ve Enfeksiyon Kontrolü',
  slides: [
    {
      title: 'Neden El Hijyeni?',
      bullets: [
        "Hastane enfeksiyonlarının %80'i ellerde taşınan mikroplardan kaynaklanır",
        'Doğru el yıkama enfeksiyon riskini %50 azaltır',
        "WHO'nun 'Beş An' protokolü: temas öncesi/sonrası, prosedür öncesi/sonrası, vücut sıvısı temasında",
      ],
      speakerNotes: 'İstatistikleri vurgula, kişisel sorumluluk hissini uyandır.',
    },
    {
      title: 'Alkol Bazlı El Antiseptiği',
      bullets: [
        '%60–95 alkol konsantrasyonu optimal etkinlik sağlar',
        'Görünür kir yoksa antiseptik tercih edilmeli',
        'Uygulama süresi: eller kuruyuncaya kadar ovalama (20–30 sn)',
      ],
      speakerNotes: 'Antiseptiğin sabun kadar etkili olmadığı durumları belirt.',
    },
    {
      title: '6 Adımda El Yıkama Tekniği',
      bullets: [
        '1. Avuç içleri — 2. El sırtı — 3. Parmak araları',
        '4. Parmak uçları — 5. Baş parmaklar — 6. Bilekler',
        'Süre: en az 20 saniye',
      ],
      speakerNotes: 'Katılımcılarla birlikte uygulamalı göster.',
    },
    {
      title: 'Kişisel Koruyucu Ekipman (KKE)',
      bullets: [
        'Eldiven: kan/vücut sıvısı temasında ZORUNLU',
        'Maske: solunum yolu enfeksiyonu şüphesinde FFP2',
        'Gözlük/siperlik: sıçrama riski olan prosedürlerde',
      ],
      speakerNotes:
        "KKE'nin sınırlarını da anlat — eldiven takılı iken çapraz kontaminasyon riski.",
    },
    {
      title: 'Sık Yapılan Hatalar',
      bullets: [
        'El yıkamadan önce eldiven giymek',
        'Antiseptik miktarını az kullanmak',
        'Tırnak altı ve baş parmağı atlamak',
      ],
      speakerNotes: 'Klinikte gözlemlenen gerçek vakalar varsa paylaş.',
    },
    {
      title: 'Özet & Hatırlatma',
      bullets: [
        'Her hasta temasında eller temiz olmalı',
        'Protokol gözetmeksizin kısa yol yok',
        'Şüphe durumunda: hem yıka hem antiseptik uygula',
      ],
      speakerNotes: 'Eğitim sonrası quiz yapılacağını hatırlat.',
    },
  ],
};

// ─── 2. HASTANE MARKA DEĞERLERİ (Gerçekte DB'den gelecek) ───────────────────
const BRAND = {
  primary: '#0d9668', // Hospital LMS primary green
  accent: '#f59e0b', // Accent amber
  bg: '#f1f5f9', // Light bg
  textDark: '#1e293b',
  textMid: '#475569',
  white: '#FFFFFF',
  fontTitle: 'Plus Jakarta Sans',
  fontBody: 'Inter',
  hospital: 'Örnek Devlet Hastanesi',
};

// ─── 3. PPTX ÜRET ───────────────────────────────────────────────────────────
const pptx = new PptxGenJS();

pptx.layout = 'LAYOUT_WIDE'; // 16:9
pptx.author = 'Hospital LMS';
pptx.company = BRAND.hospital;
pptx.subject = AI_JSON_OUTPUT.trainingTitle;
pptx.title = AI_JSON_OUTPUT.trainingTitle;

// ── KAPAK SLAYT ──────────────────────────────────────────────────────────────
const cover = pptx.addSlide();

// Arka plan gradient benzeri — iki dikdörtgen ile
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

// Başlık
cover.addText(AI_JSON_OUTPUT.trainingTitle, {
  x: 0.5,
  y: 1.5,
  w: 7,
  h: 1.5,
  fontSize: 36,
  bold: true,
  color: BRAND.white,
  fontFace: BRAND.fontTitle,
  wrap: true,
});

// Alt bilgi
cover.addText(BRAND.hospital, {
  x: 0.5,
  y: 4.5,
  w: 7,
  h: 0.5,
  fontSize: 16,
  color: 'DDDDDD',
  fontFace: BRAND.fontBody,
});
cover.addText(new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' }), {
  x: 0.5,
  y: 5.0,
  w: 7,
  h: 0.4,
  fontSize: 13,
  color: 'BBBBBB',
  fontFace: BRAND.fontBody,
});

// ── İÇERİK SLAYTLARI ─────────────────────────────────────────────────────────
AI_JSON_OUTPUT.slides.forEach((slideData, idx) => {
  const slide = pptx.addSlide();

  // Üst şerit
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.85,
    fill: { color: BRAND.primary },
  });

  // Sol kenar aksanı
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.85,
    w: 0.08,
    h: 4.4,
    fill: { color: BRAND.accent },
  });

  // Slayt numarası (üst şeritte)
  slide.addText(`${String(idx + 1).padStart(2, '0')} / ${AI_JSON_OUTPUT.slides.length}`, {
    x: 8.8,
    y: 0.05,
    w: 1.2,
    h: 0.6,
    fontSize: 11,
    color: 'CCEECC',
    fontFace: BRAND.fontBody,
    align: 'right',
  });

  // Başlık
  slide.addText(slideData.title, {
    x: 0.25,
    y: 0.05,
    w: 8.5,
    h: 0.65,
    fontSize: 22,
    bold: true,
    color: BRAND.white,
    fontFace: BRAND.fontTitle,
  });

  // Bullet'lar
  const bulletObjects = slideData.bullets.map((b) => ({
    text: b,
    options: {
      bullet: { code: '2022', indent: 20 },
      fontSize: 18,
      color: BRAND.textDark,
      fontFace: BRAND.fontBody,
      paraSpaceAfter: 10,
    },
  }));

  slide.addText(bulletObjects, {
    x: 0.3,
    y: 1.05,
    w: 9.2,
    h: 4.0,
    valign: 'top',
  });

  // Speaker notes
  if (slideData.speakerNotes) {
    slide.addNotes(slideData.speakerNotes);
  }
});

// ── KAPANIŞ SLAYT ─────────────────────────────────────────────────────────────
const closing = pptx.addSlide();
closing.addShape(pptx.ShapeType.rect, {
  x: 0,
  y: 0,
  w: '100%',
  h: '100%',
  fill: { color: BRAND.bg },
});
closing.addShape(pptx.ShapeType.rect, {
  x: 4.25,
  y: 2.5,
  w: 1.5,
  h: 0.08,
  fill: { color: BRAND.primary },
});
closing.addText('Teşekkürler', {
  x: 0,
  y: 1.5,
  w: '100%',
  h: 1.2,
  fontSize: 42,
  bold: true,
  color: BRAND.primary,
  fontFace: BRAND.fontTitle,
  align: 'center',
});
closing.addText('Eğitim tamamlandı — Sınav başlıyor', {
  x: 0,
  y: 3.0,
  w: '100%',
  h: 0.6,
  fontSize: 16,
  color: BRAND.textMid,
  fontFace: BRAND.fontBody,
  align: 'center',
});
closing.addText(BRAND.hospital, {
  x: 0,
  y: 4.8,
  w: '100%',
  h: 0.4,
  fontSize: 12,
  color: BRAND.textMid,
  fontFace: BRAND.fontBody,
  align: 'center',
});

// ── KAYDET ───────────────────────────────────────────────────────────────────
const OUTPUT = 'scripts/output-demo.pptx';
pptx.writeFile({ fileName: OUTPUT }).then(() => {
  console.log(`\n✅ Sunum oluşturuldu: ${OUTPUT}`);
  console.log(
    `   Slayt sayısı : ${AI_JSON_OUTPUT.slides.length + 2} (kapak + ${AI_JSON_OUTPUT.slides.length} içerik + kapanış)`
  );
  console.log(`   Eğitim       : ${AI_JSON_OUTPUT.trainingTitle}`);
  console.log(`   Hastane      : ${BRAND.hospital}`);
  console.log('\n📋 OpenRouter entegrasyonu için hangi modeli kullanacağını söyle.\n');
});
