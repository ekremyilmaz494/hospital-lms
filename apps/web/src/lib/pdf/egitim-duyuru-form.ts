/**
 * Eğitim Duyuru Formu PDF üretici (SKS denetim belgesi).
 *
 * Bir eğitimin personellere sistem üzerinden duyurulduğunu (otomatik bildirim) ve KİMLERE
 * duyurulduğunu zaman damgalı belgeler. Kanıt: her personelin atanma/duyuru tarihi
 * (TrainingAssignment.assignedAt) + gönderilen gerçek bildirim metni (Notification.message)
 * + bildirim durumu. Islak imza içermez — dijital/otomatik duyuru kaydıdır.
 *
 * Çağıran route org-scoped veriyi çeker ve org logosunu `resolveOrgLogoDataUrl` ile data URL'e
 * çevirip `logoDataUrl` olarak geçer (builder ağ/S3 erişimi yapmaz → saf ve test edilebilir).
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from './helpers/font'
import {
  drawAuditFormHeader, drawInfoBand, drawTableTitleBand, drawAuditFooter,
  formatDate, formatDateLong, STATUS_MAP,
  PRIMARY, BORDER, SURFACE, TEXT_MUT, TEXT_MAIN, type RGB,
} from './audit-form-chrome'

export interface DuyuruFormStaff {
  fullName: string
  department: string
  title: string
  assignedAt: Date | string | null
  notified: boolean
  status: string
}

export interface DuyuruFormData {
  trainingTitle: string
  category: string | null
  startDate: Date | string | null
  endDate: Date | string | null
  isCompulsory: boolean
  organizationName: string
  logoDataUrl: string | null
  docRef: string
  /** Sisteme kayıtlı gerçek bildirim metni (Notification.message); yoksa null. */
  announcementMessage: string | null
  /** En erken bildirim tarihi (min Notification.createdAt); yoksa null. */
  firstAnnouncedAt: Date | string | null
  notifiedCount: number
  staff: DuyuruFormStaff[]
}

export async function buildEgitimDuyuruFormPdf(data: DuyuruFormData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  const W = doc.internal.pageSize.getWidth()

  drawAuditFormHeader(doc, {
    eyebrow: 'EĞİTİM DUYURU FORMU',
    title: data.trainingTitle,
    subtitle: data.organizationName,
    logoDataUrl: data.logoDataUrl,
    tag: data.isCompulsory ? 'ZORUNLU EĞİTİM' : null,
    metaRows: [
      { label: 'BELGE NO', value: `#${data.docRef}` },
      { label: 'DÜZENLENME TARİHİ', value: formatDateLong(new Date()) },
      { label: 'DÜZENLEYEN', value: data.organizationName },
    ],
  })

  // ── INFO BAND ──
  const dateRange = (data.startDate && data.endDate)
    ? `${formatDate(data.startDate)} — ${formatDate(data.endDate)}`
    : 'Belirtilmemiş'
  let y = drawInfoBand(doc, [
    { label: 'KATEGORİ',        value: data.category ?? '—' },
    { label: 'DUYURU TARİHİ',   value: formatDate(data.firstAnnouncedAt) },
    { label: 'EĞİTİM SÜRESİ',   value: dateRange },
    { label: 'DUYURULAN PERSONEL', value: `${data.staff.length} kişi` },
  ], 48)

  // ── DUYURU METNİ kutusu (sisteme kayıtlı gerçek bildirim) ──
  y += 8
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_MUT)
  doc.setCharSpace(0.4)
  doc.text('DUYURU METNİ — SİSTEME KAYITLI OTOMATİK BİLDİRİM', 10, y)
  doc.setCharSpace(0)
  y += 3

  const msg = data.announcementMessage
    ?? `"${data.trainingTitle}" adlı eğitim ilgili personellere sistem üzerinden atanmış ve bildirilmiştir.`
  // Font + boyut, wrap ölçümünden ÖNCE ayarlanır (splitTextToSize güncel font metriğini kullanır).
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  const msgLines = doc.splitTextToSize(msg, W - 32) as string[]
  const boxH = msgLines.length * 4.8 + 8
  doc.setFillColor(...SURFACE)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(10, y, W - 20, boxH, 2, 2, 'FD')
  doc.setFillColor(...PRIMARY)
  doc.rect(10, y, 1.6, boxH, 'F')
  doc.setTextColor(...TEXT_MAIN)
  doc.text(msgLines, 16, y + 6)
  y += boxH + 6

  // ── Özet cümlesi ──
  const summary = `Bu eğitim, sistem üzerinden ${data.notifiedCount} personele ${formatDate(data.firstAnnouncedAt)} tarihinde otomatik bildirim olarak duyurulmuştur. Aşağıdaki liste, duyurunun yapıldığı personeli ve atanma/duyuru tarihlerini gösterir.`
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_MUT)
  const sumLines = doc.splitTextToSize(summary, W - 20) as string[]
  doc.text(sumLines, 10, y)
  y += sumLines.length * 4.2 + 5

  // ── TABLE ──
  y = drawTableTitleBand(doc, 'DUYURU YAPILAN PERSONEL LİSTESİ', y)
  y += 1

  const rows = data.staff.map((s, i) => {
    const st = STATUS_MAP[s.status] ?? STATUS_MAP.assigned
    return [
      String(i + 1),
      s.fullName || '—',
      s.department || '—',
      s.title || '—',
      formatDate(s.assignedAt),
      s.notified ? 'Bildirildi' : '—',
      st.label,
    ]
  })

  autoTable(doc, {
    startY: y + 1,
    margin: { left: 10, right: 10 },
    head: [['#', 'Ad Soyad', 'Departman', 'Ünvan', 'Duyuru Tarihi', 'Bildirim', 'Durum']],
    body: rows,
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 7.5,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
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
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 32 },
      3: { cellWidth: 30 },
      4: { cellWidth: 26, halign: 'center' },
      5: { cellWidth: 28, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
    },
    didParseCell(cell) {
      if (cell.section === 'body' && cell.column.index === 5) {
        const notified = String(cell.cell.raw) === 'Bildirildi'
        cell.cell.styles.textColor = notified ? PRIMARY : (TEXT_MUT as RGB)
        if (notified) cell.cell.styles.fontStyle = 'bold'
      }
      if (cell.section === 'body' && cell.column.index === 6) {
        const entry = Object.values(STATUS_MAP).find(s => s.label === String(cell.cell.raw))
        if (entry) {
          cell.cell.styles.textColor = entry.color
          cell.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })

  drawAuditFooter(doc, {
    orgName: data.organizationName,
    centerText: `Eğitim Duyuru Formu · ${data.trainingTitle}`,
  })

  return Buffer.from(doc.output('arraybuffer'))
}
