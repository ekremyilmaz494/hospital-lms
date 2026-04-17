/**
 * jsPDF için Türkçe karakter destekli font yükleyicisi.
 *
 * jsPDF'in built-in Helvetica fontu sadece WinAnsi'yi destekler — ğ, ü, ş, ı, İ,
 * ö, ç gibi Türkçe karakterleri doğru basamaz. Eskiden `TR_MAP` ile ASCII'ye
 * dönüşüm yapılıyordu ("Eğitim" → "Egitim") ama bu denetim belgelerinde ciddiyet
 * sorunu yaratıyordu.
 *
 * Çözüm: Liberation Sans (Red Hat, açık kaynak — pdfjs-dist paketiyle birlikte
 * geliyor, biz public/fonts'a kopyaladık). Latin Extended A/B bloklarını içerir,
 * Türkçe + birçok AB dili için yeterlidir.
 *
 * Kullanım:
 *   const doc = new jsPDF(...)
 *   await applyTurkishFont(doc)
 *   doc.text('Değerlendirme Eğitimi', 10, 10)  // TR karakterler düzgün görünür
 *
 * Lazy + cached: Font TTF'i node process memory'de bir kez okunur, sonraki PDF
 * üretimleri hazır cache'den kullanır (Vercel hot instance avantajı).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { jsPDF } from 'jspdf'

const FONT_FAMILY = 'LiberationSans'
const FILE_REGULAR = 'LiberationSans-Regular.ttf'
const FILE_BOLD = 'LiberationSans-Bold.ttf'

let cachedRegular: string | null = null
let cachedBold: string | null = null

async function loadFontBase64(filename: string): Promise<string> {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', filename)
  const buffer = await fs.readFile(fontPath)
  return buffer.toString('base64')
}

/**
 * Dokümana Türkçe destekli fontu yükler ve aktifleştirir.
 * autoTable dahil tüm sonraki `doc.text()` çağrıları TR karakteri doğru basar.
 */
export async function applyTurkishFont(doc: jsPDF): Promise<void> {
  if (cachedRegular === null) cachedRegular = await loadFontBase64(FILE_REGULAR)
  if (cachedBold === null) cachedBold = await loadFontBase64(FILE_BOLD)

  doc.addFileToVFS(FILE_REGULAR, cachedRegular)
  doc.addFont(FILE_REGULAR, FONT_FAMILY, 'normal')

  doc.addFileToVFS(FILE_BOLD, cachedBold)
  doc.addFont(FILE_BOLD, FONT_FAMILY, 'bold')

  doc.setFont(FONT_FAMILY, 'normal')
}

export const TURKISH_FONT_FAMILY = FONT_FAMILY
