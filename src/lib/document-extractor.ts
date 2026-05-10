/**
 * Office dokümanlarından düz metin çıkarma helper'ı.
 *
 * Claude API native olarak sadece PDF + image parse edebiliyor. AI soru
 * üretiminde DOCX/PPTX/XLSX kaynaklarını destekleyebilmek için bunları
 * sunucuda text'e çevirip prompt'a gömüyoruz.
 *
 * Kullanım: AI generate-questions / replenish-question endpoint'lerinde
 * kaynak dosya office formatındaysa S3'ten buffer indirilip burası
 * çağrılır, dönen text Claude'a `text` content olarak gönderilir.
 */

import mammoth from 'mammoth'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'

export const OFFICE_MIME_TYPES = {
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

export type OfficeMimeType = (typeof OFFICE_MIME_TYPES)[keyof typeof OFFICE_MIME_TYPES]

export function isOfficeMimeType(mimeType: string): mimeType is OfficeMimeType {
  return Object.values(OFFICE_MIME_TYPES).some(t => t === mimeType)
}

/**
 * Verilen buffer'dan mime type'a göre düz metin çıkarır.
 * Boş döndürürse caller "metin çıkarılamadı" uyarısı göstermeli (image-only PPTX gibi).
 */
export async function extractTextFromOfficeDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case OFFICE_MIME_TYPES.DOCX:
      return extractDocx(buffer)
    case OFFICE_MIME_TYPES.PPTX:
      return extractPptx(buffer)
    case OFFICE_MIME_TYPES.XLSX:
      return extractXlsx(buffer)
    default:
      throw new Error(`Desteklenmeyen office formatı: ${mimeType}`)
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  // mammoth düz metin döndürür; dipnot/header/footer dahil paragraf bazlı.
  // Style markup kaybolur ama AI için yeterli (sadece içerik lazım).
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}

async function extractPptx(buffer: Buffer): Promise<string> {
  // PPTX = ZIP arşivi; ppt/slides/slideN.xml içinde <a:t>...</a:t> tag'leri text içerir.
  // sax veya XML parser yerine basit regex — performans + dependency minimum.
  const zip = await JSZip.loadAsync(buffer)
  const slideEntries = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0', 10)
      const bNum = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0', 10)
      return aNum - bNum
    })

  const parts: string[] = []
  for (const entry of slideEntries) {
    const xml = await zip.files[entry].async('string')
    const slideNum = entry.match(/slide(\d+)/)?.[1] ?? '?'
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g))
      .map(m => m[1])
      .filter(t => t.trim().length > 0)
    if (texts.length > 0) {
      parts.push(`--- Slide ${slideNum} ---\n${texts.join('\n')}`)
    }
  }
  return parts.join('\n\n').trim()
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  // Her sheet, her satır, her hücreyi tab-delimited text olarak yaz.
  // Formula sonucu (cached) kullanılır; raw formula göstermez.
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const parts: string[] = []
  wb.eachSheet(ws => {
    const sheetParts: string[] = [`--- Sheet: ${ws.name} ---`]
    ws.eachRow({ includeEmpty: false }, row => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: false }, cell => {
        const v = cell.value
        if (v == null) return
        if (v instanceof Date) {
          cells.push(v.toISOString().slice(0, 10))
        } else if (typeof v === 'object') {
          // Hyperlink, formula, richText vs. — TS union çok geniş, unknown-cast.
          const obj = v as unknown as { text?: unknown; result?: unknown; richText?: unknown }
          if (typeof obj.text === 'string') cells.push(obj.text)
          else if (obj.result != null) cells.push(String(obj.result))
          else if (Array.isArray(obj.richText)) {
            cells.push(obj.richText.map(r => (r as { text?: string }).text ?? '').join(''))
          } else cells.push(JSON.stringify(v))
        } else {
          cells.push(String(v))
        }
      })
      if (cells.length > 0) sheetParts.push(cells.join('\t'))
    })
    if (sheetParts.length > 1) parts.push(sheetParts.join('\n'))
  })
  return parts.join('\n\n').trim()
}
