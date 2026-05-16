import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from '@/lib/pdf/helpers/font'
import { fetchLogoAsDataUrl, mimeToPdfFormat } from '@/lib/pdf/helpers/logo'
import { BRAND } from '@/lib/brand'

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

type RGB = [number, number, number]

const PRIMARY:    RGB = [13, 150, 104]
const PRIMARY_DK: RGB = [6, 95, 70]
const SURFACE:    RGB = [248, 250, 252]
const BORDER:     RGB = [226, 232, 240]
const TEXT_MUT:   RGB = [100, 116, 139]
const TEXT_MAIN:  RGB = [15, 23, 42]
const SUCCESS_BG: RGB = [220, 252, 231]
const ERROR_BG:   RGB = [254, 226, 226]
const ERROR_FG:   RGB = [220, 38, 38]
const WARN_BG:    RGB = [254, 243, 199]
const WARN_FG:    RGB = [180, 120, 0]
const INFO_BG:    RGB = [239, 246, 255]
const INFO_FG:    RGB = [37, 99, 235]
const WHITE:      RGB = [255, 255, 255]

const STATUS_MAP: Record<string, { label: string; bg: RGB; color: RGB }> = {
  passed:      { label: 'Başarılı',     bg: SUCCESS_BG, color: PRIMARY },
  failed:      { label: 'Başarısız',    bg: ERROR_BG,   color: ERROR_FG },
  in_progress: { label: 'Devam Ediyor', bg: WARN_BG,    color: WARN_FG },
  assigned:    { label: 'Atandı',       bg: INFO_BG,    color: INFO_FG },
  locked:      { label: 'Kilitli',      bg: ERROR_BG,   color: ERROR_FG },
}

/** PDF Tamamlama Raporu — kurumsal kimlikli personel listesi + imza alanları */
export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params

  const allowed = await checkRateLimit(`report:pdf:${dbUser.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla rapor isteği. Lütfen bekleyin.', 429)

  try {

  const training = await prisma.training.findFirst({
    where: { id, organizationId: organizationId },
    select: {
      title: true,
      category: true,
      passingScore: true,
      startDate: true,
      endDate: true,
      regulatoryBody: true,
      isCompulsory: true,
      organization: { select: { name: true, logoUrl: true } },
      assignments: {
        select: {
          status: true,
          completedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              title: true,
              departmentRel: { select: { name: true } },
            },
          },
          examAttempts: {
            orderBy: { attemptNumber: 'desc' },
            take: 1,
            select: {
              postExamScore: true,
              postExamCompletedAt: true,
              isPassed: true,
            },
          },
        },
        orderBy: [
          { user: { lastName: 'asc' } },
          { user: { firstName: 'asc' } },
        ],
      },
    },
  })

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const orgName = training.organization?.name ?? BRAND.fullName
  const logoDataUrl = await fetchLogoAsDataUrl(training.organization?.logoUrl)

  // ── HEADER ──────────────────────────────────────────────
  // Restrained executive layout:
  //   • Single deep-green panel (no triangle gimmick)
  //   • Hairline gold accent at very top + thin lighter-green underline at bottom
  //   • Real logo (if set) on white tile, monogram fallback
  //   • Eyebrow + title hierarchy on left, vertical metadata stack on right
  const HDR_H = 44

  // Top hairline accent (gold) — premium signal, single thin rule
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 0, W, 1, 'F')

  // Main panel — deep, slightly darker than PRIMARY for sophistication
  doc.setFillColor(...PRIMARY_DK)
  doc.rect(0, 1, W, HDR_H - 1, 'F')

  // Bottom thin underline in lighter primary (separation, no double-stripe)
  doc.setFillColor(...PRIMARY)
  doc.rect(0, HDR_H, W, 0.6, 'F')

  // ── Logo / monogram tile (white card, single restrained shape) ──
  const tileX = 12
  const tileY = 8
  const tileSize = 28
  doc.setFillColor(...WHITE)
  doc.roundedRect(tileX, tileY, tileSize, tileSize, 2, 2, 'F')

  let logoRendered = false
  if (logoDataUrl) {
    try {
      const fmt = mimeToPdfFormat(logoDataUrl)
      const pad = 3
      doc.addImage(
        logoDataUrl,
        fmt,
        tileX + pad,
        tileY + pad,
        tileSize - pad * 2,
        tileSize - pad * 2,
        undefined,
        'FAST'
      )
      logoRendered = true
    } catch {
      // ignore — fall through to monogram
    }
  }
  if (!logoRendered) {
    doc.setTextColor(...PRIMARY_DK)
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(18)
    doc.text(orgName.charAt(0).toUpperCase(), tileX + tileSize / 2, tileY + tileSize / 2 + 2.8, {
      align: 'center',
    })
  }

  // ── Hairline vertical divider between logo and title ──
  doc.setDrawColor(255, 255, 255)
  // jsPDF's GState API isn't exposed in our jspdf typings; emulate transparency via mid-tone draw color
  doc.setLineWidth(0.2)
  doc.setDrawColor(120, 180, 150)
  doc.line(tileX + tileSize + 6, tileY + 2, tileX + tileSize + 6, tileY + tileSize - 2)

  // ── Eyebrow (small uppercase report kind) ──
  const textX = tileX + tileSize + 11
  doc.setTextColor(245, 200, 120) // soft gold for hierarchy
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(7)
  doc.setCharSpace(0.6)
  doc.text('EĞİTİM TAMAMLAMA RAPORU', textX, tileY + 4.5)
  doc.setCharSpace(0)

  // ── Training title — hero ──
  doc.setTextColor(...WHITE)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(15)
  // reserve right column for metadata block (~62mm)
  const titleLines = doc.splitTextToSize(training.title, W - textX - 64) as string[]
  const visibleTitle = titleLines.slice(0, 2)
  doc.text(visibleTitle, textX, tileY + 11)

  // ── Organization name (subtle, under title) ──
  const orgY = tileY + 11 + visibleTitle.length * 5.6 + 1
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(195, 230, 215)
  doc.text(orgName, textX, orgY)

  // ── Optional "Zorunlu Eğitim" tag — outline style, less garish ──
  if (training.isCompulsory) {
    const tagLabel = 'ZORUNLU EĞİTİM'
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(6.8)
    const tagPad = 3.2
    const tagW = doc.getTextWidth(tagLabel) + tagPad * 2
    const tagX = textX
    const tagY = orgY + 2.5
    doc.setDrawColor(245, 200, 120)
    doc.setLineWidth(0.3)
    doc.setFillColor(...PRIMARY_DK)
    doc.roundedRect(tagX, tagY, tagW, 5.2, 2.6, 2.6, 'D')
    doc.setTextColor(245, 200, 120)
    doc.text(tagLabel, tagX + tagW / 2, tagY + 3.5, { align: 'center' })
  }

  // ── Right-side metadata stack (clean grid, generous size) ──
  const metaRight = W - 12
  const docRef = id.slice(0, 8).toUpperCase()
  const metaLabelColor: RGB = [160, 210, 190]

  // BELGE NO
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...metaLabelColor)
  doc.setCharSpace(0.5)
  doc.text('BELGE NO', metaRight, tileY + 3.8, { align: 'right' })
  doc.setCharSpace(0)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...WHITE)
  doc.text(`#${docRef}`, metaRight, tileY + 9, { align: 'right' })

  // Hairline divider between metadata rows
  doc.setDrawColor(80, 130, 110)
  doc.setLineWidth(0.2)
  doc.line(metaRight - 36, tileY + 11.5, metaRight, tileY + 11.5)

  // OLUŞTURULMA TARİHİ
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...metaLabelColor)
  doc.setCharSpace(0.5)
  doc.text('OLUŞTURULMA TARİHİ', metaRight, tileY + 16, { align: 'right' })
  doc.setCharSpace(0)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...WHITE)
  doc.text(formatDateLong(new Date()), metaRight, tileY + 21, { align: 'right' })

  // KURUM (organization — short version on right)
  doc.setDrawColor(80, 130, 110)
  doc.line(metaRight - 36, tileY + 23.5, metaRight, tileY + 23.5)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...metaLabelColor)
  doc.setCharSpace(0.5)
  doc.text('DÜZENLEYEN', metaRight, tileY + 28, { align: 'right' })
  doc.setCharSpace(0)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...WHITE)
  const orgRight = doc.splitTextToSize(orgName, 60)[0] as string
  doc.text(orgRight, metaRight, tileY + 33, { align: 'right' })

  // ── INFO BAND ───────────────────────────────────────────
  const infoY = 48
  doc.setFillColor(...SURFACE)
  doc.rect(0, infoY, W, 16, 'F')
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(0, infoY, W, infoY)
  doc.line(0, infoY + 16, W, infoY + 16)

  const dateRange = (training.startDate && training.endDate)
    ? `${formatDate(training.startDate)} — ${formatDate(training.endDate)}`
    : 'Belirtilmemiş'

  const infoCols = [
    { label: 'KATEGORİ',       value: training.category ?? '—' },
    { label: 'EĞİTİM SÜRESİ',  value: dateRange },
    { label: 'BARAJ PUANI',    value: `%${training.passingScore}` },
    { label: 'MEVZUAT',        value: training.regulatoryBody ?? '—' },
  ]
  const colW = W / infoCols.length
  infoCols.forEach((col, i) => {
    const cx = colW * i + colW / 2
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(col.label, cx, infoY + 5.5, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT_MAIN)
    const truncated = doc.splitTextToSize(col.value, colW - 4)[0] as string
    doc.text(truncated, cx, infoY + 11.5, { align: 'center' })
    if (i < infoCols.length - 1) {
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.3)
      doc.line(colW * (i + 1), infoY + 3, colW * (i + 1), infoY + 13)
    }
  })

  // ── STAT CARDS ──────────────────────────────────────────
  const total      = training.assignments.length
  const passedCnt  = training.assignments.filter(a => a.status === 'passed').length
  const failedCnt  = training.assignments.filter(a => a.status === 'failed').length
  const ongoingCnt = training.assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length
  const completionRate = total > 0 ? Math.round((passedCnt / total) * 100) : 0

  const statY = infoY + 22
  const statCards = [
    { label: 'TOPLAM ATANAN',  value: String(total),               bg: INFO_BG,    color: INFO_FG },
    { label: 'BAŞARILI',       value: String(passedCnt),            bg: SUCCESS_BG, color: PRIMARY },
    { label: 'BAŞARISIZ',      value: String(failedCnt),            bg: ERROR_BG,   color: ERROR_FG },
    { label: 'DEVAM EDİYOR',   value: String(ongoingCnt),           bg: WARN_BG,    color: WARN_FG },
    { label: 'TAMAMLAMA',      value: `%${completionRate}`,         bg: SURFACE,    color: TEXT_MAIN },
  ]

  const gap = 2
  const cardW = (W - 20 - gap * (statCards.length - 1)) / statCards.length
  const cardH = 18
  statCards.forEach((c, i) => {
    const cx = 10 + i * (cardW + gap)
    doc.setFillColor(...c.bg)
    doc.roundedRect(cx, statY, cardW, cardH, 2, 2, 'F')
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...c.color)
    doc.text(c.value, cx + cardW / 2, statY + 10, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(c.label, cx + cardW / 2, statY + 15, { align: 'center' })
  })

  // ── TABLE TITLE BAND ────────────────────────────────────
  const tableHeaderY = statY + cardH + 6
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(10, tableHeaderY, W - 20, 7, 1, 1, 'F')
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text('PERSONEL TAMAMLAMA LİSTESİ', W / 2, tableHeaderY + 4.7, { align: 'center' })

  // ── TABLE ───────────────────────────────────────────────
  const rows = training.assignments.map((a, i) => {
    const attempt  = a.examAttempts[0]
    const name     = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
    const dept     = a.user.departmentRel?.name ?? '—'
    const userTitle = a.user.title ?? '—'
    const st       = STATUS_MAP[a.status] ?? STATUS_MAP.assigned
    const score    = attempt?.postExamScore != null ? `%${Number(attempt.postExamScore)}` : '—'
    const compDate = formatDate(a.completedAt ?? attempt?.postExamCompletedAt)
    const sigField = a.status === 'passed' ? '' : 'X'

    return [String(i + 1), name, dept, userTitle, st.label, score, compDate, sigField]
  })

  autoTable(doc, {
    startY: tableHeaderY + 8,
    margin: { left: 10, right: 10 },
    head: [['#', 'Ad Soyad', 'Departman', 'Ünvan', 'Durum', 'Puan', 'Tarih', 'İmza']],
    body: rows,
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 7.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: TEXT_MAIN,
    },
    headStyles: {
      font: TURKISH_FONT_FAMILY,
      fillColor: [241, 245, 249],
      textColor: TEXT_MUT,
      fontStyle: 'bold',
      fontSize: 7,
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', cellPadding: { top: 3.5, bottom: 3.5, left: 1, right: 1 } },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 24, halign: 'center', minCellHeight: 11 },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw)
        const entry = Object.values(STATUS_MAP).find(s => s.label === val)
        if (entry) {
          data.cell.styles.textColor = entry.color
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 5 && data.cell.raw !== '—') {
        const score = parseInt(String(data.cell.raw).replace('%', ''))
        data.cell.styles.textColor = score >= training.passingScore ? PRIMARY : ERROR_FG
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val === 'X') {
          data.cell.styles.textColor = ERROR_FG
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 10
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val === '') {
          const boxW = Math.min(data.cell.width - 4, 20)
          const boxH = Math.min(data.cell.height - 3, 7)
          const bx = data.cell.x + (data.cell.width - boxW) / 2
          const by = data.cell.y + (data.cell.height - boxH) / 2
          doc.setDrawColor(180, 180, 180)
          doc.setLineWidth(0.3)
          doc.rect(bx, by, boxW, boxH, 'S')
        }
      }
    },
  })

  // ── FOOTER NOTE ─────────────────────────────────────────
  const finalY = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY) ?? H - 40
  const noteY = finalY + 8
  if (noteY < H - 25) {
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text('* "İmza" sütunu yalnızca başarılı personel tarafından imzalanmak üzere boş bırakılmıştır.', 10, noteY)
    doc.text('  Başarısız veya devam eden personel için "X" işareti konulmuştur.', 10, noteY + 4)
  }

  // ── PAGE FOOTER ─────────────────────────────────────────
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
    doc.text(orgName, 10, H - 4)
    doc.text(training.title, W / 2, H - 4, { align: 'center' })
    doc.text(`Sayfa ${p} / ${totalPages}`, W - 10, H - 4, { align: 'right' })
  }

  // ── RESPONSE ────────────────────────────────────────────
  const buffer  = Buffer.from(doc.output('arraybuffer'))
  const safeName = training.title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_tamamlama_raporu.pdf"`,
      'Cache-Control': 'no-store',
    },
  })

  } catch (err) {
    logger.error('CompletionReportPDF', 'Rapor oluşturulamadı', err)
    return errorResponse('Rapor oluşturulurken hata oluştu', 500)
  }
}, { requireOrganization: true })
