import ExcelJS from 'exceljs'
import type { jsPDF } from 'jspdf'
import { TURKISH_FONT_FAMILY } from '@/lib/pdf/helpers/font'
import { mimeToPdfFormat } from '@/lib/pdf/helpers/logo'

/**
 * Rapor dışa aktarma görsel katmanı — Excel + PDF stilleri. TEK kaynak: hem admin
 * per-hastane export'u (`admin/reports/export/route.ts`) hem grup konsolide export'u
 * (`group/reports/export/route.ts`) aynı marka stilini kullansın (drift yok).
 */

// ── Brand renkleri (PDF — RGB tuple) ──
export const BRAND_PRIMARY: [number, number, number] = [13, 150, 104] // #0d9668
export const BRAND_ACCENT: [number, number, number] = [245, 158, 11]
export const COLOR_SUCCESS: [number, number, number] = [22, 163, 74]
export const COLOR_WARNING: [number, number, number] = [202, 138, 4]
export const COLOR_DANGER: [number, number, number] = [220, 38, 38]
export const COLOR_MUTED: [number, number, number] = [100, 116, 139]
export const COLOR_BORDER: [number, number, number] = [226, 232, 240]
export const COLOR_SURFACE_ALT: [number, number, number] = [248, 250, 252]

// ── Excel renkleri (ARGB — alpha önde) ──
export const XL = {
  primary: 'FF0D9668',
  primaryLight: 'FFECFDF5',
  accent: 'FFF59E0B',
  success: 'FF16A34A',
  successBg: 'FFECFDF5',
  warning: 'FFCA8A04',
  warningBg: 'FFFEF9C3',
  danger: 'FFDC2626',
  dangerBg: 'FFFEE2E2',
  muted: 'FF64748B',
  text: 'FF0F172A',
  border: 'FFE2E8F0',
  zebra: 'FFF8FAFC',
}

// ── Excel helpers ──

export function sanitizeCell(value: unknown): string | number {
  if (typeof value === 'number') return value
  const str = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`
  return str
}

/**
 * Bir worksheet'e kurumsal rapor başlığı ekler: hastane adı, rapor başlığı,
 * tarih + filtre bilgisi + (varsa) kırpma uyarısı. Her zaman 1-4. satırları
 * kullanır, 5. satır boş bırakılır — data header'ı 6. satıra düşer.
 */
export function addWorkbookMetadata(
  ws: ExcelJS.Worksheet,
  orgName: string,
  sectionTitle: string,
  meta: { dateLabel: string; filterLabel?: string; truncationLabel?: string },
  colSpan: number,
) {
  // Başlık satırı (kurum)
  const r1 = ws.addRow([orgName])
  r1.height = 26
  r1.font = { bold: true, size: 16, color: { argb: XL.primary }, name: 'Arial' }
  ws.mergeCells(r1.number, 1, r1.number, colSpan)
  r1.alignment = { vertical: 'middle' }

  // Alt başlık (section title)
  const r2 = ws.addRow([sectionTitle])
  r2.height = 20
  r2.font = { bold: true, size: 12, color: { argb: XL.text }, name: 'Arial' }
  ws.mergeCells(r2.number, 1, r2.number, colSpan)

  // Tarih + filtre
  const metaParts = [meta.dateLabel]
  if (meta.filterLabel) metaParts.push(meta.filterLabel)
  const r3 = ws.addRow([metaParts.join('   ·   ')])
  r3.font = { size: 10, color: { argb: XL.muted }, italic: true, name: 'Arial' }
  ws.mergeCells(r3.number, 1, r3.number, colSpan)

  // Kırpma uyarısı
  if (meta.truncationLabel) {
    const r4 = ws.addRow([`⚠ ${meta.truncationLabel}`])
    r4.font = { size: 10, bold: true, color: { argb: XL.danger }, name: 'Arial' }
    ws.mergeCells(r4.number, 1, r4.number, colSpan)
  }

  ws.addRow([]) // Boşluk
}

/**
 * Veri header satırına brand stili uygular. Row numarasını verirsen o satır
 * stilize edilir; aksi halde bir sonraki eklenen satır kullanılır.
 */
export function styleHeaderRow(row: ExcelJS.Row, bgColor: string = XL.primary) {
  row.height = 28
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
  row.alignment = { horizontal: 'center', vertical: 'middle' }
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: XL.border } },
      bottom: { style: 'medium', color: { argb: XL.text } },
      left: { style: 'thin', color: { argb: XL.border } },
      right: { style: 'thin', color: { argb: XL.border } },
    }
  })
}

export function applyZebraStripes(ws: ExcelJS.Worksheet, startRow: number, endRow: number, colCount: number) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    row.height = 20
    if ((r - startRow) % 2 === 1) {
      for (let c = 1; c <= colCount; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.zebra } }
      }
    }
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: XL.border } },
      }
      if (!cell.font) cell.font = { name: 'Arial', size: 10 }
    })
  }
}

export function colorRateCell(cell: ExcelJS.Cell, rate: number) {
  if (rate >= 80) cell.font = { bold: true, color: { argb: XL.success }, name: 'Arial' }
  else if (rate >= 60) cell.font = { bold: true, color: { argb: XL.warning }, name: 'Arial' }
  else cell.font = { bold: true, color: { argb: XL.danger }, name: 'Arial' }
}

/**
 * Excel sheet adı için güvenli isim üretir (max 31 karakter, yasak karakterler yok,
 * boş değil). Aynı isimden birden fazla olursa `used` seti ile numara ekleyerek
 * benzersizleştirir (iki hastane aynı ada kısalırsa çakışmasın).
 */
export function sanitizeSheetName(raw: string, used: Set<string>): string {
  // Excel yasak: \ / ? * [ ] :  — ayrıca max 31 karakter, boş olamaz.
  let base = (raw || 'Hastane').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Hastane'
  if (!used.has(base)) { used.add(base); return base }
  let n = 2
  while (used.has(`${base.slice(0, 27)} (${n})`)) n++
  base = `${base.slice(0, 27)} (${n})`
  used.add(base)
  return base
}

// ── PDF helpers ──

/**
 * Kapak sayfası: ortalanmış brand banner, kurum adı, section başlığı,
 * tarih + filtre + (varsa) kırpma uyarısı. A4 landscape (297 x 210mm) üzerinde çalışır.
 */
export function renderCoverPage(
  doc: jsPDF,
  orgName: string,
  sectionTitle: string,
  dateLabel: string,
  filterLabel: string | null,
  truncationLabel: string | null,
  logoDataUrl: string | null,
) {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  // Üst brand şerit
  doc.setFillColor(...BRAND_PRIMARY)
  doc.rect(0, 0, pw, 32, 'F')
  // Accent çizgi
  doc.setFillColor(...BRAND_ACCENT)
  doc.rect(0, 32, pw, 1.5, 'F')

  // Kurum logosu — brand şeridin sol üstünde beyaz tile (varsa)
  if (logoDataUrl) {
    try {
      const props = doc.getImageProperties(logoDataUrl)
      const maxH = 20, maxW = 52
      const scale = Math.min(maxW / props.width, maxH / props.height)
      const lw = props.width * scale
      const lh = props.height * scale
      const pad = 3
      const tileW = lw + pad * 2
      const tileH = lh + pad * 2
      const tileX = 12
      const tileY = (32 - tileH) / 2
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(tileX, tileY, tileW, tileH, 2, 2, 'F')
      doc.addImage(logoDataUrl, mimeToPdfFormat(logoDataUrl), tileX + pad, tileY + pad, lw, lh, undefined, 'FAST')
    } catch {
      // logo çizilemedi — logosuz devam
    }
  }

  // "Rapor" etiketi
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('KURUMSAL RAPOR', pw / 2, 14, { align: 'center' })

  // Kurum adı (üst)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text(orgName, pw / 2, 24, { align: 'center' })

  // Orta blok — section başlığı
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(26)
  doc.setTextColor(15, 23, 42)
  doc.text(sectionTitle, pw / 2, ph / 2 - 8, { align: 'center' })

  // İnce divider
  const divY = ph / 2 - 2
  doc.setDrawColor(...BRAND_PRIMARY)
  doc.setLineWidth(0.6)
  doc.line(pw / 2 - 30, divY, pw / 2 + 30, divY)

  // Tarih
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(`Rapor Tarihi: ${dateLabel}`, pw / 2, ph / 2 + 8, { align: 'center' })

  // Filtre
  if (filterLabel) {
    doc.setFontSize(10)
    doc.text(filterLabel, pw / 2, ph / 2 + 16, { align: 'center' })
  }

  // Kırpma uyarısı
  if (truncationLabel) {
    doc.setFontSize(10)
    doc.setTextColor(...COLOR_DANGER)
    doc.text(`⚠ ${truncationLabel}`, pw / 2, ph / 2 + (filterLabel ? 26 : 18), { align: 'center' })
  }

  // Alt notu — gizlilik + kurumsal
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR_MUTED)
  doc.text('Gizli · Kurumsal İç Kullanım', pw / 2, ph - 14, { align: 'center' })
}

/**
 * 2. sayfadan itibaren her sayfaya header şerit + footer ekler. Cover (sayfa 1) atlanır.
 */
export function renderChrome(doc: jsPDF, orgName: string, sectionTitle: string, dateLabel: string) {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const total = doc.getNumberOfPages()

  for (let p = 2; p <= total; p++) {
    doc.setPage(p)

    // Header şerit
    doc.setFillColor(...BRAND_PRIMARY)
    doc.rect(0, 0, pw, 2, 'F')

    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(orgName, 10, 9)
    doc.text(sectionTitle, pw - 10, 9, { align: 'right' })

    doc.setDrawColor(...COLOR_BORDER)
    doc.setLineWidth(0.1)
    doc.line(10, 11, pw - 10, 11)

    // Footer
    const footerY = ph - 8
    doc.line(10, footerY - 4, pw - 10, footerY - 4)
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(`${dateLabel} · Gizli`, 10, footerY)
    doc.text(`Sayfa ${p} / ${total}`, pw - 10, footerY, { align: 'right' })
  }
}

/**
 * KPI kartı çizer: renkli başlık + büyük değer. 4-6 kart yan yana dizilir.
 * Kartlar cover page ile karışmasın diye yeni sayfada çağrılmalı.
 */
export function renderKpiCards(
  doc: jsPDF,
  cards: Array<{ label: string; value: string; color: [number, number, number] }>,
  startY: number,
): number {
  const pw = doc.internal.pageSize.getWidth()
  const margin = 10
  const gap = 4
  const cardH = 28
  const cardW = (pw - margin * 2 - gap * (cards.length - 1)) / cards.length

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + gap)

    // Kart arka planı
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...COLOR_BORDER)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD')

    // Üst renk şeridi
    doc.setFillColor(...card.color)
    doc.roundedRect(x, startY, cardW, 3, 2, 2, 'F')
    // Köşe overlap'i maskele
    doc.setFillColor(...card.color)
    doc.rect(x, startY + 1, cardW, 2, 'F')

    // Label
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(card.label.toUpperCase(), x + 4, startY + 11)

    // Değer
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text(card.value, x + 4, startY + 22)
  })

  return startY + cardH + 8
}

/**
 * Bir section başlığı (içerik sayfasında üst) çizer, startY döndürür.
 */
export function renderSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text(text, 10, y)

  // Alt çizgi
  doc.setDrawColor(...BRAND_PRIMARY)
  doc.setLineWidth(0.4)
  doc.line(10, y + 1.5, 45, y + 1.5)

  return y + 6
}
