/**
 * Denetim formu PDF'leri için paylaşılan kurumsal "chrome" (başlık, info band,
 * stat kartları, tablo başlığı, footer) ve durum/renk sabitleri.
 *
 * `completion-report` route'undaki yönetici başlık tasarımından türetilmiştir; Eğitim
 * Duyuru Formu ve Eğitim Kayıt Sicil Formu builder'ları bu helper'ları paylaşır.
 * Çağıran, `applyTurkishFont(doc)`'u BU helper'ları çağırmadan önce çalıştırmalıdır.
 */
import type { jsPDF } from 'jspdf'
import { TURKISH_FONT_FAMILY } from './helpers/font'
import { mimeToPdfFormat } from './helpers/logo'

export type RGB = [number, number, number]

export const PRIMARY:    RGB = [13, 150, 104]
export const PRIMARY_DK: RGB = [6, 95, 70]
export const SURFACE:    RGB = [248, 250, 252]
export const BORDER:     RGB = [226, 232, 240]
export const TEXT_MUT:   RGB = [100, 116, 139]
export const TEXT_MAIN:  RGB = [15, 23, 42]
export const SUCCESS_BG: RGB = [220, 252, 231]
export const ERROR_BG:   RGB = [254, 226, 226]
export const ERROR_FG:   RGB = [220, 38, 38]
export const WARN_BG:    RGB = [254, 243, 199]
export const WARN_FG:    RGB = [180, 120, 0]
export const INFO_BG:    RGB = [239, 246, 255]
export const INFO_FG:    RGB = [37, 99, 235]
export const WHITE:      RGB = [255, 255, 255]

/** TrainingAssignment.status → görünen etiket + renk. */
export const STATUS_MAP: Record<string, { label: string; bg: RGB; color: RGB }> = {
  passed:      { label: 'Başarılı',     bg: SUCCESS_BG, color: PRIMARY },
  failed:      { label: 'Başarısız',    bg: ERROR_BG,   color: ERROR_FG },
  in_progress: { label: 'Devam Ediyor', bg: WARN_BG,    color: WARN_FG },
  assigned:    { label: 'Atandı',       bg: INFO_BG,    color: INFO_FG },
  locked:      { label: 'Kilitli',      bg: ERROR_BG,   color: ERROR_FG },
}

/** TR kısa tarih: 28.06.2026 */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** TR uzun tarih: 28 Haziran 2026 */
export function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** TR tarih+saat: 28.06.2026 14:35 */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export interface MetaRow { label: string; value: string }

export interface HeaderOptions {
  eyebrow: string
  title: string
  subtitle: string
  logoDataUrl: string | null
  metaRows: MetaRow[]
  /** Opsiyonel rozet (örn. "ZORUNLU EĞİTİM"). */
  tag?: string | null
}

/**
 * Kurumsal başlık: logo tile + eyebrow + başlık + alt başlık + sağda metadata stack.
 * Başlığın bittiği Y koordinatını (mm) döndürür.
 */
export function drawAuditFormHeader(doc: jsPDF, opts: HeaderOptions): number {
  const W = doc.internal.pageSize.getWidth()
  const HDR_H = 44

  // Üst altın hairline + ana panel + alt ince çizgi
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 0, W, 1, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.rect(0, 1, W, HDR_H - 1, 'F')
  doc.setFillColor(...PRIMARY)
  doc.rect(0, HDR_H, W, 0.6, 'F')

  // Logo tile — gerçek en-boy oranına göre boyutlanır (çekiştirme yok)
  const tileX = 12
  const tileY = 8
  const TILE_PAD = 3
  let tileW = 28
  let tileH = 28
  let logoFit: { url: string; fmt: 'PNG' | 'JPEG'; w: number; h: number } | null = null
  if (opts.logoDataUrl) {
    try {
      const props = doc.getImageProperties(opts.logoDataUrl)
      tileH = 24
      const maxLogoH = tileH - TILE_PAD * 2
      const maxLogoW = 42
      const scale = Math.min(maxLogoW / props.width, maxLogoH / props.height)
      const w = props.width * scale
      const h = props.height * scale
      tileW = Math.max(28, w + TILE_PAD * 2)
      logoFit = { url: opts.logoDataUrl, fmt: mimeToPdfFormat(opts.logoDataUrl), w, h }
    } catch {
      logoFit = null
    }
  }

  doc.setFillColor(...WHITE)
  doc.roundedRect(tileX, tileY, tileW, tileH, 2, 2, 'F')
  if (logoFit) {
    try {
      doc.addImage(
        logoFit.url, logoFit.fmt,
        tileX + (tileW - logoFit.w) / 2, tileY + (tileH - logoFit.h) / 2,
        logoFit.w, logoFit.h, undefined, 'FAST',
      )
    } catch {
      logoFit = null
    }
  }
  if (!logoFit) {
    doc.setTextColor(...PRIMARY_DK)
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(18)
    doc.text((opts.subtitle.charAt(0) || 'K').toUpperCase(), tileX + tileW / 2, tileY + tileH / 2 + 2.8, {
      align: 'center',
    })
  }

  // Logo ↔ başlık ayırıcı
  doc.setLineWidth(0.2)
  doc.setDrawColor(120, 180, 150)
  doc.line(tileX + tileW + 6, tileY + 2, tileX + tileW + 6, tileY + tileH - 2)

  // Eyebrow
  const textX = tileX + tileW + 11
  doc.setTextColor(245, 200, 120)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(7)
  doc.setCharSpace(0.6)
  doc.text(opts.eyebrow, textX, tileY + 4.5)
  doc.setCharSpace(0)

  // Başlık (hero, en çok 2 satır)
  doc.setTextColor(...WHITE)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(15)
  const titleLines = doc.splitTextToSize(opts.title, W - textX - 64) as string[]
  const visibleTitle = titleLines.slice(0, 2)
  doc.text(visibleTitle, textX, tileY + 11)

  // Alt başlık
  const subY = tileY + 11 + visibleTitle.length * 5.6 + 1
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(195, 230, 215)
  doc.text(opts.subtitle, textX, subY)

  // Opsiyonel rozet
  if (opts.tag) {
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(6.8)
    const tagPad = 3.2
    const tagW = doc.getTextWidth(opts.tag) + tagPad * 2
    const tagY = subY + 2.5
    doc.setDrawColor(245, 200, 120)
    doc.setLineWidth(0.3)
    doc.setFillColor(...PRIMARY_DK)
    doc.roundedRect(textX, tagY, tagW, 5.2, 2.6, 2.6, 'D')
    doc.setTextColor(245, 200, 120)
    doc.text(opts.tag, textX + tagW / 2, tagY + 3.5, { align: 'center' })
  }

  // Sağda metadata stack (en çok 3 satır temiz sığar)
  const metaRight = W - 12
  const metaLabelColor: RGB = [160, 210, 190]
  opts.metaRows.slice(0, 3).forEach((row, i) => {
    const rowTop = tileY + 3.8 + i * 12.2
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...metaLabelColor)
    doc.setCharSpace(0.5)
    doc.text(row.label, metaRight, rowTop, { align: 'right' })
    doc.setCharSpace(0)
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...WHITE)
    const val = doc.splitTextToSize(row.value, 60)[0] as string
    doc.text(val, metaRight, rowTop + 5.2, { align: 'right' })
    if (i < Math.min(opts.metaRows.length, 3) - 1) {
      doc.setDrawColor(80, 130, 110)
      doc.setLineWidth(0.2)
      doc.line(metaRight - 36, rowTop + 7.7, metaRight, rowTop + 7.7)
    }
  })

  return HDR_H
}

export interface InfoCol { label: string; value: string }

/** Başlık altı bilgi şeridi (eşit kolonlar + dikey ayırıcılar). Şeridin altındaki Y'yi döndürür. */
export function drawInfoBand(doc: jsPDF, cols: InfoCol[], y: number): number {
  const W = doc.internal.pageSize.getWidth()
  const H = 16
  doc.setFillColor(...SURFACE)
  doc.rect(0, y, W, H, 'F')
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(0, y, W, y)
  doc.line(0, y + H, W, y + H)

  const colW = W / cols.length
  cols.forEach((col, i) => {
    const cx = colW * i + colW / 2
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(col.label, cx, y + 5.5, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT_MAIN)
    const truncated = doc.splitTextToSize(col.value, colW - 4)[0] as string
    doc.text(truncated, cx, y + 11.5, { align: 'center' })
    if (i < cols.length - 1) {
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.3)
      doc.line(colW * (i + 1), y + 3, colW * (i + 1), y + 13)
    }
  })
  return y + H
}

export interface StatCard { label: string; value: string; bg: RGB; color: RGB }

/** Eşit genişlikte stat kartları satırı. Kartların altındaki Y'yi döndürür. */
export function drawStatCards(doc: jsPDF, cards: StatCard[], y: number): number {
  const W = doc.internal.pageSize.getWidth()
  const gap = 2
  const cardW = (W - 20 - gap * (cards.length - 1)) / cards.length
  const cardH = 18
  cards.forEach((c, i) => {
    const cx = 10 + i * (cardW + gap)
    doc.setFillColor(...c.bg)
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F')
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...c.color)
    doc.text(c.value, cx + cardW / 2, y + 10, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(c.label, cx + cardW / 2, y + 15, { align: 'center' })
  })
  return y + cardH
}

/** Yeşil tablo başlığı bandı. Bandın altındaki Y'yi döndürür. */
export function drawTableTitleBand(doc: jsPDF, title: string, y: number): number {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(10, y, W - 20, 7, 1, 1, 'F')
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text(title, W / 2, y + 4.7, { align: 'center' })
  return y + 7
}

/** Tüm sayfalara alt bilgi (kurum · orta metin · sayfa x/y). */
export function drawAuditFooter(doc: jsPDF, opts: { orgName: string; centerText: string }): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...SURFACE)
    doc.rect(0, H - 10, W, 10, 'F')
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.3)
    doc.line(0, H - 10, W, H - 10)
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(doc.splitTextToSize(opts.orgName, 70)[0] as string, 10, H - 4)
    doc.text(doc.splitTextToSize(opts.centerText, 90)[0] as string, W / 2, H - 4, { align: 'center' })
    doc.text(`Sayfa ${p} / ${totalPages}`, W - 10, H - 4, { align: 'right' })
  }
}
