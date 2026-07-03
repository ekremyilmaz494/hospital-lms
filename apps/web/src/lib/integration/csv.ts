/**
 * Bağımlılıksız CSV parser — İK/HBYS dosya adaptörü (`/api/integration/v1/files`).
 *
 * Neden el yazması: yeni bağımlılık eklemek yerine (kural) RFC 4180'in bu iş
 * için gereken alt kümesi uygulanır:
 *  - Tırnaklı alanlar: `"a,b"` içindeki ayırıcı/satır sonu alanı bölmez,
 *  - Çift-tırnak escape: `""` → `"`,
 *  - CRLF / LF / yalnız CR satır sonları,
 *  - `;` ayırıcı desteği — Türkçe bölgesel ayarlı Excel, CSV'yi `;` ile kaydeder.
 *    Tespit: başlık (ilk boş olmayan) satırında `;` sayısı `,` sayısından ÇOKSA
 *    ayırıcı `;` kabul edilir, aksi halde `,`.
 *  - UTF-8 BOM toleransı; tamamen boş satırlar atlanır.
 *
 * `line` alanı 1-bazlı FİZİKSEL dosya satırıdır (başlık satırı dahil sayım;
 * tırnak içindeki satır atlamaları da sayılır) — hata raporunda İK kullanıcısı
 * dosyadaki satırı doğrudan bulabilsin diye.
 */

export type CsvDelimiter = ',' | ';'

/** Tek CSV veri kaydı — hücreler + kaydın başladığı fiziksel dosya satırı. */
export interface CsvRecord {
  cells: string[]
  /** 1-bazlı fiziksel satır numarası (başlık satırı = 1). */
  line: number
}

export interface CsvParseResult {
  /** İlk boş olmayan kaydın hücreleri — başlık satırı. Girdi boşsa []. */
  headers: string[]
  /** Başlık sonrası veri kayıtları (boş satırlar atlanmış, sıra korunur). */
  rows: CsvRecord[]
  /** Tespit edilen ayırıcı. */
  delimiter: CsvDelimiter
}

/**
 * Başlık satırından ayırıcı tespiti: ilk boş olmayan fiziksel satırda `;`
 * sayısı `,` sayısından fazlaysa `;`, değilse `,`. Tırnak farkındalığı yok —
 * başlık hücrelerinde ayırıcı karakter geçmesi pratikte beklenmez.
 */
function detectDelimiter(text: string): CsvDelimiter {
  let lineStart = 0
  while (lineStart < text.length) {
    let lineEnd = text.length
    for (let i = lineStart; i < text.length; i++) {
      const ch = text[i]
      if (ch === '\n' || ch === '\r') {
        lineEnd = i
        break
      }
    }
    const rawLine = text.slice(lineStart, lineEnd)
    if (rawLine.trim() !== '') {
      let commas = 0
      let semis = 0
      for (const ch of rawLine) {
        if (ch === ',') commas++
        else if (ch === ';') semis++
      }
      return semis > commas ? ';' : ','
    }
    // Sonraki satıra atla — \r\n çifti birlikte tüketilir.
    lineStart = lineEnd + (text[lineEnd] === '\r' && text[lineEnd + 1] === '\n' ? 2 : 1)
  }
  return ','
}

/**
 * CSV metnini başlık + veri kayıtlarına ayrıştırır.
 *
 * Toleranslar (makine feed'i kırılgan olmasın diye):
 *  - Hücre ortasındaki kaçışsız `"` literal kabul edilir,
 *  - Dosya sonunda kapanmamış tırnak: o ana kadarki içerik hücre sayılır,
 *  - Tüm hücreleri boş/boşluk olan kayıtlar (boş satırlar) atlanır.
 */
export function parseCsv(input: string): CsvParseResult {
  // UTF-8 BOM toleransı — TextDecoder çoğu yolda zaten söker, string ile
  // doğrudan çağrılırsa burada sökülür.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const delimiter = detectDelimiter(text)

  const records: CsvRecord[] = []
  let cells: string[] = []
  let cell = ''
  let inQuotes = false
  let line = 1
  let recordLine = 1

  const endCell = (): void => {
    cells.push(cell)
    cell = ''
  }
  const endRecord = (): void => {
    endCell()
    // Tamamen boş kayıt = boş satır → atla.
    if (cells.some(c => c.trim() !== '')) records.push({ cells, line: recordLine })
    cells = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"' // `""` → literal `"`
          i++
        } else {
          inQuotes = false
        }
      } else {
        // Tırnak içi satır sonları fiziksel satır sayacına işlenir.
        if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line++
        cell += ch
      }
      continue
    }

    if (ch === '"' && cell === '') {
      inQuotes = true // yalnız hücre başındaki tırnak alan açar
      continue
    }
    if (ch === delimiter) {
      endCell()
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++ // CRLF tek satır sonu
      endRecord()
      line++
      recordLine = line
      continue
    }
    cell += ch // hücre ortasındaki `"` dahil — literal
  }

  // EOF: bekleyen hücre/kayıt varsa kapat (son satırda \n olmayabilir).
  if (cell !== '' || cells.length > 0 || inQuotes) endRecord()

  if (records.length === 0) return { headers: [], rows: [], delimiter }
  const [head, ...rows] = records
  return { headers: head.cells, rows, delimiter }
}
