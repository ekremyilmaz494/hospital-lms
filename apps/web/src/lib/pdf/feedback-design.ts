/**
 * Feedback (Eğitim Değerlendirme) PDF renderer — resmî form formatı.
 *
 * Layout (A4 portrait, 210 × 297 mm, margin 12 mm):
 *  ┌──────────┬───────────────────────────────────────┬──────────┐
 *  │ Hospital │   EĞİTİM DEĞERLENDİRME ANKET FORMU    │ Bakanlık │
 *  │  Logo    │                                       │   Logo   │
 *  ├──────────┴──────────┬─────────┬─────────┬────────┴──────────┤
 *  │ Doküman Kodu        │ Yayın T.│ Rev. T. │ Rev. No │  Sayfa  │
 *  ├──────────────────────────────┬───────────────────────────────┤
 *  │ Eğitim Adı:                  │ Eğitim Tarihi:                │
 *  ├──────────────────────────────┼───────────────────────────────┤
 *  │ Eğitmen Adı:                 │ Katılımcı Adı-Soyadı:         │
 *  ├──────────────────────────────┴───────────────────────────────┤
 *  │ KATEGORİ ADI                                                  │
 *  │ ┌─┬─────────────────────────────────────┬───────────────┐    │
 *  │ │#│ Soru                                │ Puan (1-5)    │    │
 *  │ │1│ ...                                 │ ●  ○  ○  ○  ○ │    │  ← dolu daire = cevap
 *  │ │ ...                                                  │    │
 *  ├──────────────────────────────────────────────────────────────┤
 *  │ Toplam: 32/40 (4.00/5) · Geçti              14.05.2026       │
 *  └──────────────────────────────────────────────────────────────┘
 */
import { jsPDF } from 'jspdf'
import { TURKISH_FONT_FAMILY } from './helpers/font'

type RGB = readonly [number, number, number]

export const FB_COLORS = {
  BLACK: [0, 0, 0] as RGB,
  TEXT: [25, 28, 35] as RGB,
  MUTED: [110, 115, 125] as RGB,
  BORDER: [60, 60, 60] as RGB,
  BORDER_LIGHT: [180, 180, 180] as RGB,
  ACCENT: [13, 150, 104] as RGB,        // primary green
  WARNING: [245, 158, 11] as RGB,
  SUCCESS: [16, 185, 129] as RGB,
  ERROR: [239, 68, 68] as RGB,
  HEADER_BG: [245, 245, 244] as RGB,
  CATEGORY_BG: [240, 250, 246] as RGB,
} as const

export type LikertScore = 1 | 2 | 3 | 4 | 5 | null

export interface FeedbackItemDraw {
  text: string
  score: LikertScore               // null → cevaplanmamış (boş tüm daireler)
  questionType: 'likert_5' | 'yes_partial_no' | 'text'
  textAnswer?: string | null
}

export interface FeedbackCategoryDraw {
  name: string
  items: FeedbackItemDraw[]
}

export interface FeedbackDrawData {
  // Form metadata (sabit, dokümandan)
  formTitle: string                 // "EĞİTİM DEĞERLENDİRME ANKET FORMU"
  documentCode: string              // "EY.FR.03"
  publishedDate: string             // "07.01.2026"
  revisionDate: string              // "00"
  revisionNumber: string            // "00"
  pageNo: string                    // "1/1"

  // Dinamik metadata
  trainingTitle: string
  trainingDate: string
  instructorName: string | null
  participantName: string | null    // null → "Anonim"

  // Soru-cevaplar
  categories: FeedbackCategoryDraw[]

  // Footer
  isPassed: boolean | null
  overallScore: number | null       // 0-5 (Likert ortalaması)
  submittedDate: string

  // Logolar (base64 data URLs)
  organizationLogoDataUrl?: string | null
  ministryLogoDataUrl?: string | null
}

const setFill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2])
const setDraw = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
const setText = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2])

// ── Sayfa boyutu sabitleri (A4 portrait, mm) ─────────────────────────
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 12
const CONTENT_W = PAGE_W - MARGIN * 2  // 186 mm

/**
 * Logoyu hücre içine sığacak şekilde, EN-BOY ORANI KORUNARAK çizer (aspect-fit).
 *
 * `getImageProperties()` ile orijinal width/height alınır, hücre oranı ile
 * karşılaştırılarak iki eksenden hangisi sınırlayıcıysa ona göre fit yapılır.
 * Devakent gibi yatay logolarda hücre genişliği, bakanlık amblemi gibi kare
 * logolarda hücre yüksekliği sınırlayıcı olur — logo asla gerilmez/sıkışmaz.
 *
 * Eğer addImage veya getImageProperties başarısız olursa placeholder kutu/text çizilir.
 */
function drawLogoIntoCell(
  doc: jsPDF,
  dataUrl: string | null | undefined,
  x: number, y: number, w: number, h: number,
  placeholder: string,
) {
  const padding = 2
  const cellW = w - padding * 2
  const cellH = h - padding * 2

  if (dataUrl) {
    try {
      const fmt = dataUrl.includes('jpeg') || dataUrl.includes('jpg') ? 'JPEG' : 'PNG'
      // Orijinal piksel boyutlarını al — aspect ratio korunsun
      const props = doc.getImageProperties(dataUrl)
      const imgAspect = props.width / props.height
      const cellAspect = cellW / cellH

      let drawW: number
      let drawH: number
      if (imgAspect > cellAspect) {
        // Image hücreden daha geniş → genişlikle sınırla, yükseklik orantılı küçülsün
        drawW = cellW
        drawH = cellW / imgAspect
      } else {
        // Image hücreden daha yüksek (veya eşit) → yükseklikle sınırla
        drawH = cellH
        drawW = cellH * imgAspect
      }

      // Hücre ortasına yerleştir — boş kalan eksende eşit boşluk
      const fx = x + (w - drawW) / 2
      const fy = y + (h - drawH) / 2
      doc.addImage(dataUrl, fmt, fx, fy, drawW, drawH)
      return
    } catch {
      /* fallthrough → placeholder */
    }
  }

  // Placeholder: kesik çizgili kutu + ortalanmış küçük metin
  setDraw(doc, FB_COLORS.BORDER_LIGHT)
  doc.setLineDashPattern([0.6, 0.6], 0)
  doc.setLineWidth(0.2)
  doc.rect(x + padding, y + padding, cellW, cellH)
  doc.setLineDashPattern([], 0)

  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(7)
  setText(doc, FB_COLORS.MUTED)
  doc.text(placeholder, x + w / 2, y + h / 2 + 1, { align: 'center', baseline: 'middle' })
}

/**
 * Bir hücre çizer: kenarlık + label + value.
 * Label üstte küçük & gri, value altında bold & siyah.
 */
function drawLabeledCell(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  opts?: { valueBold?: boolean; valueFontSize?: number; align?: 'left' | 'center' },
) {
  setDraw(doc, FB_COLORS.BORDER)
  doc.setLineWidth(0.3)
  doc.rect(x, y, w, h)

  const align = opts?.align ?? 'left'
  const padding = 2
  const textX = align === 'center' ? x + w / 2 : x + padding

  // Label
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8)
  setText(doc, FB_COLORS.TEXT)
  doc.text(label, textX, y + 3.2, { align: align === 'center' ? 'center' : 'left' })

  // Value
  doc.setFont(TURKISH_FONT_FAMILY, opts?.valueBold === false ? 'normal' : 'bold')
  doc.setFontSize(opts?.valueFontSize ?? 9)
  setText(doc, FB_COLORS.TEXT)
  const valueY = y + h - 2
  const lines = doc.splitTextToSize(value, w - padding * 2) as string[]
  doc.text(lines[0] ?? '', textX, valueY, { align: align === 'center' ? 'center' : 'left' })
}

/**
 * Premium "puan işareti" — tablonun cevaplanmış hücresinin ortasına çizilir.
 *
 * Mimar: tıpkı resmi denetim formundaki gibi her puan sütunu (Çok Zayıf … Çok İyi)
 * ayrı bir tablo hücresi; cevap o hücrenin ortasında dolu yeşil daire + halo +
 * beyaz tick olarak işaretlenir. Tick vector path ile çizilir (fontun glyph
 * desteğine bağımlı değil).
 */
function drawScoreTick(doc: jsPDF, cx: number, cy: number) {
  const r = 2.6

  // ───── 5-KATMAN gradient simülasyonu (Linear/Stripe estetik) ─────
  // jsPDF gradient desteklemiyor; iç-içe yarı opak daireler ile yumuşak
  // glow + 3B fill illüzyonu yaratıyoruz.

  // 1. En dışta çok ince ambient shadow (drop-shadow simülasyonu)
  setFill(doc, [217, 242, 232] as RGB)        // emerald-50/60
  doc.circle(cx + 0.12, cy + 0.28, r + 0.85, 'F')

  // 2. Halo dış katman — soft glow
  setFill(doc, [209, 250, 223] as RGB)        // emerald-100
  doc.circle(cx, cy, r + 0.6, 'F')

  // 3. Halo iç katman — gradient orta tonu
  setFill(doc, [167, 240, 196] as RGB)        // emerald-200
  doc.circle(cx, cy, r + 0.28, 'F')

  // 4. Ana dolu daire — koyu emerald-600 (premium kontrast)
  setFill(doc, [5, 150, 105] as RGB)          // emerald-600
  doc.circle(cx, cy, r, 'F')

  // 5. Üst yarıdaki gloss highlight — daha açık emerald-500 ellipse.
  //    Doğru semicircle clipping mümkün değil; çok yassı ellipse ile
  //    "üst yarıda parlaklık" illüzyonu yaratıyoruz (Apple/Stripe pattern).
  setFill(doc, [16, 185, 129] as RGB)         // emerald-500
  doc.ellipse(cx, cy - r * 0.5, r * 0.78, r * 0.32, 'F')

  // ───── Beyaz vector tick (altın oran proportions) ─────
  setDraw(doc, [255, 255, 255] as RGB)
  doc.setLineWidth(0.9)
  doc.setLineCap('round')
  doc.setLineJoin('round')
  // Kısa segment (sol-üst → orta-alt) + uzun segment (orta-alt → sağ-üst)
  // Boyut oranı altın orana yakın: 1.15 : 2.55 ≈ 0.45 : 1.0
  doc.lines(
    [
      [1.15, 1.05],   // kısa diagonal
      [2.55, -2.55],  // uzun diagonal
    ],
    cx - 1.45, cy + 0.0,
    [1, 1],
    'S',
    false,
  )

  // Restore — sonraki çizimler etkilenmesin
  doc.setLineCap('butt')
  doc.setLineJoin('miter')
}

/**
 * Premium GEÇTİ / KALDI durum rozeti — footer'da kullanılır.
 *
 * Tasarım katmanları (Stripe/Linear pill pattern'i):
 *   1. Subtle outer shadow ring (drop-shadow simülasyonu, offset+0.3)
 *   2. Outer glow (renk-200 tonu)
 *   3. Main fill (renk-600 — koyu, kurumsal)
 *   4. Top gloss highlight (renk-500 — üst yarıda subtle parlaklık)
 *   5. Inline mini icon (beyaz daire + tick/X) soldan 4mm
 *   6. Letter-spaced bold text — `setCharSpace(0.4)`
 *
 * Boyut: 28×7mm full capsule (radius = h/2). KALDI için kırmızı palet.
 */
function drawStatusPill(doc: jsPDF, cx: number, cy: number, isPassed: boolean) {
  const w = 28
  const h = 7
  const radius = h / 2  // full capsule

  // Palet — passed: emerald, failed: rose-red
  const main: RGB     = isPassed ? [5, 150, 105]   : [185, 28, 28]
  const gloss: RGB    = isPassed ? [16, 185, 129]  : [220, 38, 38]
  const halo: RGB     = isPassed ? [167, 240, 196] : [254, 202, 202]
  const shadow: RGB   = isPassed ? [217, 242, 232] : [254, 226, 226]

  const left = cx - w / 2
  const top = cy - h / 2

  // 1. Subtle outer shadow (alt-sağa kayık)
  setFill(doc, shadow)
  doc.roundedRect(left - 0.25, top + 0.35, w + 0.5, h + 0.35, radius + 0.25, radius + 0.25, 'F')

  // 2. Halo glow
  setFill(doc, halo)
  doc.roundedRect(left - 0.4, top - 0.2, w + 0.8, h + 0.4, radius + 0.4, radius + 0.4, 'F')

  // 3. Main fill — koyu kurumsal ton
  setFill(doc, main)
  doc.roundedRect(left, top, w, h, radius, radius, 'F')

  // 4. Top gloss — üst yarıda hafif daha açık ton (parlaklık illüzyonu)
  setFill(doc, gloss)
  doc.roundedRect(left + 0.6, top + 0.5, w - 1.2, h * 0.42, radius - 0.6, radius - 0.6, 'F')

  // ───── İnline mini icon (soldan 4.2mm) ─────
  const iconCx = left + 4.2
  if (isPassed) {
    // Beyaz mini daire + içinde renk-600 tick (içe gömülü efekt)
    setFill(doc, [255, 255, 255] as RGB)
    doc.circle(iconCx, cy, 1.55, 'F')
    setDraw(doc, main)
    doc.setLineWidth(0.45)
    doc.setLineCap('round')
    doc.setLineJoin('round')
    doc.lines([[0.6, 0.55], [1.25, -1.4]], iconCx - 0.75, cy + 0.05, [1, 1], 'S', false)
  } else {
    // Beyaz mini daire + içinde renk-600 X
    setFill(doc, [255, 255, 255] as RGB)
    doc.circle(iconCx, cy, 1.55, 'F')
    setDraw(doc, main)
    doc.setLineWidth(0.55)
    doc.setLineCap('round')
    const xR = 0.9
    doc.line(iconCx - xR, cy - xR, iconCx + xR, cy + xR)
    doc.line(iconCx + xR, cy - xR, iconCx - xR, cy + xR)
  }
  doc.setLineCap('butt')
  doc.setLineJoin('miter')

  // ───── Letter-spaced bold text ─────
  const textX = iconCx + 3.4
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(9.2)
  setText(doc, [255, 255, 255] as RGB)
  doc.setCharSpace(0.45)
  doc.text(isPassed ? 'GEÇTİ' : 'KALDI', textX, cy + 1.05)
  doc.setCharSpace(0)
}

/**
 * Tüm form içeriğini A4 portrait sayfaya çizer. Tek sayfa garantisi:
 * - 8 likert sorusu + 3 kategori başlığı = ~110mm
 * - Header + meta + eğitim bilgileri = ~70mm
 * - Footer ~10mm
 * Toplam ≤ 200mm, margin'ler dahil 297-24=273mm pay var.
 */
export function drawFeedbackPage(doc: jsPDF, data: FeedbackDrawData) {
  setFill(doc, [255, 255, 255] as RGB)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  let y = MARGIN

  // ── 1. HEADER: 3-col table (logo | title | logo) ───────────────
  const headerH = 22
  const logoColW = 36
  const titleColW = CONTENT_W - logoColW * 2

  setDraw(doc, FB_COLORS.BORDER)
  doc.setLineWidth(0.4)

  // Sol logo hücresi
  doc.rect(MARGIN, y, logoColW, headerH)
  drawLogoIntoCell(doc, data.organizationLogoDataUrl, MARGIN, y, logoColW, headerH, 'HASTANE LOGO')

  // Orta başlık hücresi
  doc.rect(MARGIN + logoColW, y, titleColW, headerH)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(14)
  setText(doc, FB_COLORS.TEXT)
  doc.text(
    data.formTitle,
    MARGIN + logoColW + titleColW / 2,
    y + headerH / 2 + 1,
    { align: 'center', baseline: 'middle', maxWidth: titleColW - 4 },
  )

  // Sağ logo hücresi
  doc.rect(MARGIN + logoColW + titleColW, y, logoColW, headerH)
  drawLogoIntoCell(
    doc, data.ministryLogoDataUrl,
    MARGIN + logoColW + titleColW, y, logoColW, headerH,
    'BAKANLIK LOGO',
  )

  y += headerH

  // ── 2. META SATIRI: 5 sütun ────────────────────────────────────
  const metaH = 9
  const metaCols = [
    { label: 'Doküman Kodu:', value: data.documentCode, width: CONTENT_W * 0.24 },
    { label: 'Yayın Tarihi:', value: data.publishedDate, width: CONTENT_W * 0.22 },
    { label: 'Revizyon Tarihi:', value: data.revisionDate, width: CONTENT_W * 0.20 },
    { label: 'Revizyon No:', value: data.revisionNumber, width: CONTENT_W * 0.18 },
    { label: 'Sayfa No:', value: data.pageNo, width: CONTENT_W * 0.16 },
  ]
  let cx = MARGIN
  metaCols.forEach(col => {
    drawLabeledCell(doc, cx, y, col.width, metaH, col.label, col.value, { valueFontSize: 8.5 })
    cx += col.width
  })
  y += metaH

  // ── 3. EĞİTİM / KATILIMCI METADATA (2 satır x 2 sütun) ────────
  const infoH = 10
  const halfW = CONTENT_W / 2

  drawLabeledCell(doc, MARGIN, y, halfW, infoH, 'Eğitim Adı:', data.trainingTitle, { valueFontSize: 9 })
  drawLabeledCell(doc, MARGIN + halfW, y, halfW, infoH, 'Eğitim Tarihi:', data.trainingDate, { valueFontSize: 9 })
  y += infoH

  drawLabeledCell(doc, MARGIN, y, halfW, infoH, 'Eğitmen Adı:', data.instructorName ?? '—', { valueFontSize: 9 })
  drawLabeledCell(
    doc, MARGIN + halfW, y, halfW, infoH,
    'Katılımcı Adı-Soyadı:',
    data.participantName ?? 'Anonim',
    { valueFontSize: 9 },
  )
  y += infoH

  // ── 4. SORU TABLOSU: 7-sütunlu resmi denetim formatı ───────────
  // Sütunlar: # | Değerlendirme Kriteri | Çok Zayıf | Zayıf | Orta | İyi | Çok İyi
  const colNum = 7
  const scoreColCount = 5
  const scoreColW = 11
  const totalScoreW = scoreColCount * scoreColW           // 55 mm
  const colQuestion = CONTENT_W - colNum - totalScoreW    // 124 mm

  const SCORE_LABELS = ['Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Çok İyi']

  // Yardımcı: tablo dikey ayraçlarını çiz (header & body için)
  const drawColumnDividers = (yTop: number, yBot: number) => {
    setDraw(doc, FB_COLORS.BORDER)
    doc.setLineWidth(0.25)
    doc.line(MARGIN + colNum, yTop, MARGIN + colNum, yBot)
    doc.line(MARGIN + colNum + colQuestion, yTop, MARGIN + colNum + colQuestion, yBot)
    for (let i = 1; i < scoreColCount; i++) {
      const sx = MARGIN + colNum + colQuestion + i * scoreColW
      doc.line(sx, yTop, sx, yBot)
    }
  }

  // Tablo başlığı — 2 satırlı (label + parantezli puan)
  const tblHeaderH = 11
  setFill(doc, FB_COLORS.HEADER_BG)
  setDraw(doc, FB_COLORS.BORDER)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, tblHeaderH, 'FD')
  drawColumnDividers(y, y + tblHeaderH)

  // # ve "Değerlendirme Kriteri" — dikey ortala (iki satır boyunca)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8)
  setText(doc, FB_COLORS.TEXT)
  doc.text('#', MARGIN + colNum / 2, y + tblHeaderH / 2 + 1, { align: 'center', baseline: 'middle' })
  doc.text('Değerlendirme Kriteri', MARGIN + colNum + 2.5, y + tblHeaderH / 2 + 1, { baseline: 'middle' })

  // Puan sütun başlıkları: label üstte (7pt bold), parantezli rakam altta (6.5pt)
  for (let i = 0; i < scoreColCount; i++) {
    const cx = MARGIN + colNum + colQuestion + i * scoreColW + scoreColW / 2

    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(7)
    setText(doc, FB_COLORS.TEXT)
    doc.text(SCORE_LABELS[i], cx, y + 4.5, { align: 'center' })

    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    setText(doc, FB_COLORS.MUTED)
    doc.text(`(${i + 1})`, cx, y + 8.5, { align: 'center' })
  }
  y += tblHeaderH

  // Kategoriler ve sorular
  let globalIdx = 0
  data.categories.forEach((cat) => {
    // Kategori başlık satırı — tüm tabloyu kaplar
    const catH = 6.8
    setFill(doc, FB_COLORS.CATEGORY_BG)
    setDraw(doc, FB_COLORS.BORDER)
    doc.setLineWidth(0.3)
    doc.rect(MARGIN, y, CONTENT_W, catH, 'FD')
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(8.5)
    setText(doc, FB_COLORS.ACCENT)
    doc.text(cat.name.toUpperCase(), MARGIN + 2.5, y + catH / 2 + 1, { baseline: 'middle' })
    y += catH

    // Sorular
    cat.items.forEach((item) => {
      globalIdx++
      const rowH = 9

      // Satır zebra arkaplanı — çift sıralar için soft tint
      if (globalIdx % 2 === 0) {
        setFill(doc, [250, 250, 251] as RGB)
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F')
      }

      // Satır dış çerçevesi + dikey ayraçlar
      setDraw(doc, FB_COLORS.BORDER)
      doc.setLineWidth(0.25)
      doc.rect(MARGIN, y, CONTENT_W, rowH)
      drawColumnDividers(y, y + rowH)

      // Sıra no
      doc.setFont(TURKISH_FONT_FAMILY, 'bold')
      doc.setFontSize(8.5)
      setText(doc, FB_COLORS.TEXT)
      doc.text(String(globalIdx), MARGIN + colNum / 2, y + rowH / 2 + 1, { align: 'center', baseline: 'middle' })

      // Soru metni — 2 satıra kadar wrap
      doc.setFont(TURKISH_FONT_FAMILY, 'normal')
      doc.setFontSize(8.8)
      setText(doc, FB_COLORS.TEXT)
      const qLines = (doc.splitTextToSize(item.text, colQuestion - 5) as string[]).slice(0, 2)
      const linesCount = qLines.length
      const baseY = y + rowH / 2 - (linesCount - 1) * 1.7 + 0.9
      qLines.forEach((line, idx) => {
        doc.text(line, MARGIN + colNum + 2.5, baseY + idx * 3.4, { baseline: 'middle' })
      })

      // Puan işareti: cevaplanan sütunun ortasına drawScoreTick
      // yes_partial_no için score 5/3/1 zaten Çok İyi/Orta/Çok Zayıf sütununa düşer
      if (item.questionType !== 'text' && item.score !== null) {
        const colIdx = item.score - 1   // 1..5 → 0..4
        const cx = MARGIN + colNum + colQuestion + colIdx * scoreColW + scoreColW / 2
        const cy = y + rowH / 2
        drawScoreTick(doc, cx, cy)
      } else if (item.questionType === 'text') {
        // Serbest metin: 5 puan sütununa yayılmış italic gri metin
        const tx = MARGIN + colNum + colQuestion + 2
        doc.setFont(TURKISH_FONT_FAMILY, 'normal')
        doc.setFontSize(7.5)
        setText(doc, FB_COLORS.MUTED)
        const txt = (doc.splitTextToSize(item.textAnswer ?? '—', totalScoreW - 4) as string[])[0] ?? '—'
        doc.text(txt, tx, y + rowH / 2 + 1, { baseline: 'middle' })
      }

      y += rowH
    })
  })

  // ── 5. FOOTER: Toplam + tarih ──────────────────────────────────
  const footerH = 10
  setFill(doc, FB_COLORS.HEADER_BG)
  setDraw(doc, FB_COLORS.BORDER)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, footerH, 'FD')

  // Sol: Toplam puan + Geçti/Kaldı
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(9)
  setText(doc, FB_COLORS.TEXT)
  let footerLeft = `Genel Memnuniyet: `
  if (data.overallScore !== null) {
    footerLeft += `${data.overallScore.toFixed(2)} / 5.00`
  } else {
    footerLeft += '—'
  }
  doc.text(footerLeft, MARGIN + 3, y + footerH / 2 + 1, { baseline: 'middle' })

  // Orta: Premium GEÇTİ / KALDI rozeti (drawStatusPill helper)
  if (data.isPassed !== null) {
    drawStatusPill(doc, MARGIN + CONTENT_W / 2, y + footerH / 2, data.isPassed)
  }

  // Sağ: Yanıt tarihi
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(8.5)
  setText(doc, FB_COLORS.MUTED)
  doc.text(`Yanıt Tarihi: ${data.submittedDate}`, MARGIN + CONTENT_W - 3, y + footerH / 2 + 1, {
    align: 'right', baseline: 'middle',
  })
  y += footerH
  // Not: Ölçek anahtarı (1..5 label'ları) artık tablo header'ında olduğu için
  // footer altına ayrıca yazılmıyor — tekrar olmasın.
}
