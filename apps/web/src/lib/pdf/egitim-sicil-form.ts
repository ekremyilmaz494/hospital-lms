/**
 * Eğitim Kayıt Sicil Formu PDF üretici (SKS denetim belgesi).
 *
 * Bir personelin atandığı TÜM eğitimleri durumlarıyla ve zaman damgalarıyla tek belgede
 * listeler — atanma tarihi, durum (Atandı/Devam/Başarılı/Başarısız), sınav puanı, tamamlanma
 * tarihi ve (varsa) sertifika numarası. Denetçi bir personelin eğitim geçmişini tek sayfada görür.
 *
 * Çağıran route org-scoped veriyi çeker ve org logosunu data URL'e çevirip `logoDataUrl` geçer.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from './helpers/font'
import {
  drawAuditFormHeader, drawInfoBand, drawStatCards, drawTableTitleBand, drawAuditFooter,
  formatDate, formatDateLong, STATUS_MAP,
  PRIMARY, ERROR_FG, BORDER, TEXT_MUT, TEXT_MAIN,
  INFO_BG, INFO_FG, SUCCESS_BG, WARN_BG, WARN_FG, SURFACE,
} from './audit-form-chrome'

export interface SicilFormEntry {
  trainingTitle: string
  category: string | null
  assignedAt: Date | string | null
  status: string
  score: number | null
  completedAt: Date | string | null
  certificateCode: string | null
}

export interface SicilFormData {
  staffName: string
  staffTitle: string | null
  department: string | null
  organizationName: string
  logoDataUrl: string | null
  docRef: string
  entries: SicilFormEntry[]
}

export async function buildEgitimSicilFormPdf(data: SicilFormData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  drawAuditFormHeader(doc, {
    eyebrow: 'EĞİTİM KAYIT SİCİL FORMU',
    title: data.staffName,
    subtitle: data.organizationName,
    logoDataUrl: data.logoDataUrl,
    metaRows: [
      { label: 'BELGE NO', value: `#${data.docRef}` },
      { label: 'DÜZENLENME TARİHİ', value: formatDateLong(new Date()) },
      { label: 'DÜZENLEYEN', value: data.organizationName },
    ],
  })

  // ── INFO BAND ──
  let y = drawInfoBand(doc, [
    { label: 'ÜNVAN',          value: data.staffTitle || '—' },
    { label: 'DEPARTMAN',      value: data.department || '—' },
    { label: 'TOPLAM EĞİTİM',  value: String(data.entries.length) },
    { label: 'DÜZENLENME',     value: formatDate(new Date()) },
  ], 48)

  // ── STAT CARDS ──
  const total       = data.entries.length
  const passedCnt   = data.entries.filter(e => e.status === 'passed').length
  const ongoingCnt  = data.entries.filter(e => e.status === 'in_progress' || e.status === 'assigned').length
  const certCnt     = data.entries.filter(e => !!e.certificateCode).length
  y += 6
  y = drawStatCards(doc, [
    { label: 'TOPLAM ATANAN', value: String(total),      bg: INFO_BG,    color: INFO_FG },
    { label: 'BAŞARILI',      value: String(passedCnt),  bg: SUCCESS_BG, color: PRIMARY },
    { label: 'DEVAM EDİYOR',  value: String(ongoingCnt), bg: WARN_BG,    color: WARN_FG },
    { label: 'SERTİFİKALI',   value: String(certCnt),    bg: SURFACE,    color: TEXT_MAIN },
  ], y)

  // ── TABLE ──
  y += 6
  y = drawTableTitleBand(doc, 'EĞİTİM KAYIT DÖKÜMÜ', y)
  y += 1

  const rows = data.entries.map((e, i) => {
    const st = STATUS_MAP[e.status] ?? STATUS_MAP.assigned
    return [
      String(i + 1),
      e.trainingTitle || '—',
      e.category || '—',
      formatDate(e.assignedAt),
      st.label,
      e.score != null ? `%${e.score}` : '—',
      formatDate(e.completedAt),
      e.certificateCode || '—',
    ]
  })

  autoTable(doc, {
    startY: y + 1,
    margin: { left: 10, right: 10 },
    head: [['#', 'Eğitim Adı', 'Kategori', 'Atanma', 'Durum', 'Puan', 'Tamamlanma', 'Sertifika No']],
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
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 26 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 26, halign: 'center' },
    },
    didParseCell(cell) {
      // Durum sütunu renklendir
      if (cell.section === 'body' && cell.column.index === 4) {
        const entry = Object.values(STATUS_MAP).find(s => s.label === String(cell.cell.raw))
        if (entry) {
          cell.cell.styles.textColor = entry.color
          cell.cell.styles.fontStyle = 'bold'
        }
      }
      // Puan sütununu satır durumuna göre renklendir
      if (cell.section === 'body' && cell.column.index === 5 && cell.cell.raw !== '—') {
        const rowStatus = data.entries[cell.row.index]?.status
        cell.cell.styles.textColor = rowStatus === 'passed' ? PRIMARY : rowStatus === 'failed' ? ERROR_FG : TEXT_MAIN
        cell.cell.styles.fontStyle = 'bold'
      }
    },
  })

  drawAuditFooter(doc, {
    orgName: data.organizationName,
    centerText: `Eğitim Kayıt Sicil Formu · ${data.staffName}`,
  })

  return Buffer.from(doc.output('arraybuffer'))
}
