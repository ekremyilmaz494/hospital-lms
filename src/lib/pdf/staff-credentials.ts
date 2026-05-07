/**
 * Personel Giriş Bilgileri PDF üretici.
 *
 * Kullanım: Admin TC ile personel ekledikten sonra (tek veya toplu) sistemin
 * ürettiği geçici şifreyi yazıcıdan basıp personele elden iletmek için.
 *
 * KVKK NOTU:
 *   - Bu PDF gizli bilgi (TC + geçici şifre) içerir.
 *   - Alt kısımda imha uyarısı basılır.
 *   - Belge yalnızca yetkili admin'in oturumu sırasında üretilebilir
 *     (`/api/admin/staff/credentials-pdf` endpoint korumalı).
 *   - Geçici şifre tek kullanımlıktır — personel ilk girişte değiştirmek zorundadır
 *     (User.mustChangePassword=true).
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from './helpers/font'
import { maskTcKimlik } from '../tc'

export interface CredentialItem {
  fullName: string
  tcKimlik: string
  email: string | null
  tempPassword: string
  department: string | null
  title: string | null
}

export interface CredentialsPdfData {
  organizationName: string
  generatedAt: string
  generatedBy: string // Admin'in adı
  items: CredentialItem[]
  /**
   * Maskeleme tercihi:
   *   - 'full': TC tam basılır (resmi bilgilendirme/personele elden teslim)
   *   - 'masked': "12345*****1" formatı (öneri/önizleme)
   * Default: 'full' — bu PDF zaten admin'in elinde, yetkili kullanım.
   */
  maskMode?: 'full' | 'masked'
}

const NAVY: [number, number, number] = [11, 30, 63]
const GOLD: [number, number, number] = [201, 169, 97]
const CREAM: [number, number, number] = [250, 246, 235]
const INK: [number, number, number] = [35, 40, 55]
const SOFT: [number, number, number] = [110, 115, 125]
const RED_BG: [number, number, number] = [254, 242, 242]
const RED: [number, number, number] = [185, 28, 28]

export async function buildStaffCredentialsPdf(data: CredentialsPdfData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  const W = 210
  const mask = data.maskMode === 'masked'

  // ── Header ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 30, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 30, W, 2, 'F')

  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.text('Personel Giriş Bilgileri', 15, 14)

  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.text(data.organizationName, 15, 22)

  // ── Meta block ──
  doc.setTextColor(...INK)
  doc.setFontSize(9)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setTextColor(...SOFT)
  doc.text(`Belge oluşturma tarihi: ${data.generatedAt}`, 15, 42)
  doc.text(`Oluşturan: ${data.generatedBy}`, 15, 48)
  doc.text(`Personel sayısı: ${data.items.length}`, 15, 54)

  // ── Table ──
  autoTable(doc, {
    startY: 62,
    head: [['Ad Soyad', 'TC Kimlik No', 'Geçici Şifre', 'E-posta', 'Departman / Unvan']],
    body: data.items.map(item => [
      item.fullName,
      mask ? maskTcKimlik(item.tcKimlik) : item.tcKimlik,
      item.tempPassword,
      item.email ?? '—',
      [item.department, item.title].filter(Boolean).join(' / ') || '—',
    ]),
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 9,
      textColor: INK,
      lineColor: [220, 216, 200],
      lineWidth: 0.3,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: CREAM },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 30, font: TURKISH_FONT_FAMILY, fontStyle: 'bold' },
      2: { cellWidth: 32, font: TURKISH_FONT_FAMILY, fontStyle: 'bold' },
      3: { cellWidth: 50 },
      4: { cellWidth: 30 },
    },
    margin: { left: 15, right: 15 },
  })

  // ── KVKK / Güvenlik uyarı kutusu ──
  type DocWithLast = jsPDF & { lastAutoTable?: { finalY: number } }
  const lastTableY = (doc as DocWithLast).lastAutoTable?.finalY ?? 80
  const noteY = Math.min(lastTableY + 10, 240)

  doc.setFillColor(...RED_BG)
  doc.rect(15, noteY, W - 30, 32, 'F')
  doc.setDrawColor(...RED)
  doc.setLineWidth(0.4)
  doc.line(15, noteY, 15, noteY + 32) // sol kenar çizgisi

  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setTextColor(...RED)
  doc.setFontSize(10)
  doc.text('GİZLİ — Kişisel Veri (KVKK)', 19, noteY + 6)

  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setTextColor(...INK)
  doc.setFontSize(8.5)
  const lines = [
    '• Bu belge personelin TC Kimlik No ve geçici şifresini içerir; KVKK kapsamında özel nitelikli kişisel veridir.',
    '• Geçici şifre TEK KULLANIMLIK\'tır. Personel ilk giriş sonrası şifresini değiştirmek zorundadır.',
    '• Belgeyi personele elden teslim ediniz; e-posta veya mesajlaşma uygulamaları ile paylaşmayınız.',
    '• Teslim sonrası belgeyi GÜVENLİ ŞEKİLDE İMHA EDİNİZ (parçalama veya yakma).',
  ]
  let y = noteY + 12
  for (const line of lines) {
    doc.text(line, 19, y, { maxWidth: W - 38 })
    y += 5
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.5)
    doc.line(15, 284, W - 15, 284)
    doc.setFontSize(8)
    doc.setTextColor(...SOFT)
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.text('KlinoVax — Hastane Personel Eğitim Sistemi', 15, 289)
    doc.text(`Sayfa ${i} / ${pageCount}`, W - 15, 289, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
