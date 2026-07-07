/**
 * Personel satırı parse/doğrulama yardımcıları.
 *
 * `bulk-import` route'undan davranış korunarak çıkarıldı (İK/HBYS senkron
 * çekirdeği `ingest.ts` de departman eşleme için aynı yardımcıları kullanır).
 * Excel parse (ExcelJS) sunucu tarafına özeldir — client'tan import etmeyin.
 */
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc'
import { hashTcKimlik } from '@/lib/tc-crypto'

// ── Header Alias Map ──────────────────────────────────────────────────────
// Kullanıcı şablonu değiştirebilir veya kendi dosyasını yükleyebilir.
// Farklı yazımların hepsi tek kanonik alana eşlenir.
export const HEADER_ALIASES: Record<string, string[]> = {
  // Dış eşleme anahtarı (İK/HBYS sicil/personel no) — entegrasyon için kararlı eşleşme
  // anahtarı. bulk-import'ta yoksayılır (o rota externalId set etmez); dosya/entegrasyon
  // kanalında StaffRecord.externalId'ye akar.
  externalId:['sicil', 'sicil no', 'sicilno', 'sicil numarası', 'sicil numarasi', 'personel no', 'personelno', 'personel numarası', 'personel numarasi', 'personel kodu', 'external id', 'externalid', 'employee id', 'employee no', 'staff id', 'dış kimlik', 'dis kimlik'],
  firstName: ['ad', 'isim', 'ısim', 'adi', 'adı', 'first name', 'firstname', 'name', 'first'],
  lastName:  ['soyad', 'soyadi', 'soyadı', 'last name', 'lastname', 'surname', 'family name'],
  email:     ['e-posta', 'eposta', 'email', 'e posta', 'mail', 'e-mail', 'posta'],
  password:  ['şifre', 'sifre', 'parola', 'password', 'pwd', 'pass'],
  phone:     ['telefon', 'tel', 'phone', 'gsm', 'cep', 'mobile', 'cep telefonu'],
  department:['departman', 'bölüm', 'bolum', 'birim', 'department', 'dept', 'department name'],
  subDepartment: ['alt departman', 'altdepartman', 'alt birim', 'altbirim', 'sub department', 'subdepartment', 'sub-department', 'alt bolum', 'alt bölüm'],
  title:     ['unvan', 'ünvan', 'görev', 'gorev', 'title', 'position', 'job title', 'rol'],
  // TC Kimlik No — KVKK gereği AES-GCM ile şifreli, HMAC ile hash'li saklanır.
  // Resmi sertifika eşleşmesi için zorunlu (denetim kanıtı).
  tcKimlik:  ['tc', 'tckn', 'tc kimlik no', 'tc kimlik', 'tc no', 'kimlik no', 'kimlik numarası', 'national id', 'tckimlik'],
}

/** Normalize edilmiş header'ı kanonik alana eşler — bulunmazsa null */
export function resolveHeader(normalized: string): string | null {
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return canonical
  }
  return null
}

// ── Departman Fuzzy Eşleştirme ────────────────────────────────────────────

export type DeptMatch =
  | { type: 'exact'; dept: { id: string; name: string } }
  | { type: 'fuzzy'; dept: { id: string; name: string } }
  | { type: 'ambiguous'; candidates: Array<{ id: string; name: string }> }
  | { type: 'none' }

/**
 * Departman adını DB'deki departmanlarla eşleştirir.
 *  1. Exact (trim + lowercase)
 *  2. Substring — girilen değer bir departmanın içinde geçiyorsa
 *     (örn. "Acil" → "Acil Servis")
 *  3. Prefix — girilen değer bir departmanın başındaysa
 *
 * Birden çok eşleşme varsa "ambiguous" döner → kullanıcı seçsin.
 */
export function matchDepartment(input: string, departments: Array<{ id: string; name: string }>): DeptMatch {
  const normalized = input.trim().toLowerCase()
  if (!normalized) return { type: 'none' }

  // 1. Exact
  const exact = departments.find(d => d.name.toLowerCase() === normalized)
  if (exact) return { type: 'exact', dept: exact }

  // 2. Substring — girilen değer departman adında geçiyor
  const substringMatches = departments.filter(d => d.name.toLowerCase().includes(normalized))
  if (substringMatches.length === 1) return { type: 'fuzzy', dept: substringMatches[0] }
  if (substringMatches.length > 1) {
    return { type: 'ambiguous', candidates: substringMatches }
  }

  // 3. Ters substring — departman adı girilen değerde geçiyor (kısaltmış olabilir)
  const reverseMatches = departments.filter(d => normalized.includes(d.name.toLowerCase()))
  if (reverseMatches.length === 1) return { type: 'fuzzy', dept: reverseMatches[0] }
  if (reverseMatches.length > 1) {
    return { type: 'ambiguous', candidates: reverseMatches }
  }

  return { type: 'none' }
}

/**
 * ExcelJS hücre değerini güvenli şekilde string'e çevirir.
 * Excel email/URL yazınca hücreyi otomatik hyperlink nesnesine dönüştürür.
 */
export function cellToString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim()
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (typeof obj.text === 'string') return obj.text.trim()
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => (r as { text?: string }).text ?? '').join('').trim()
    }
    if (obj.result != null) return cellToString(obj.result)
    if (obj.hyperlink && typeof obj.hyperlink === 'string') {
      return obj.hyperlink.replace(/^mailto:/i, '').trim()
    }
  }
  return String(v).trim()
}

/** İçe aktarım satırı — frontend inline edit için tüm alanları içerir */
export interface ParsedRow {
  rowIndex: number
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  title: string
  // Ham TC (sadece bu request'in lifetime'ında plaintext); validateRows checksum'ı doğrular.
  tcKimlik: string
  // Üst departman (zorunlu)
  deptId?: string
  deptName: string
  deptMatch: 'exact' | 'fuzzy' | 'ambiguous' | 'none' | 'empty'
  deptCandidates?: Array<{ id: string; name: string }>
  // Alt departman (opsiyonel) — boşsa personel deptId'ye atanır, doluysa subDeptId'ye atanır.
  // 'auto-create': parent altında bulunamadı → import sırasında parent altına yaratılacak (ünvan gibi serbest metin).
  subDeptId?: string
  subDeptName: string
  subDeptMatch: 'exact' | 'fuzzy' | 'ambiguous' | 'none' | 'empty' | 'mismatch' | 'auto-create'
  subDeptCandidates?: Array<{ id: string; name: string }>
}

/**
 * Excel (.xlsx) içeriğini `ParsedRow` listesine çevirir — header alias çözümü,
 * departman/alt-departman fuzzy eşlemesi dahil. Davranış bulk-import ile birebir aynıdır.
 */
export async function parseImportFile(
  arrayBuffer: ArrayBuffer,
  orgId: string,
): Promise<{ rows: ParsedRow[]; parseError?: string; unknownHeaders?: string[] }> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(arrayBuffer)
  } catch {
    return { rows: [], parseError: 'Excel dosyası okunamadı. Lütfen .xlsx formatında yükleyin.' }
  }

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) {
    return {
      rows: [],
      parseError: 'Excel dosyası boş veya hatalı. İlk satır başlık olmalı: Ad, Soyad, E-posta, Şifre, Telefon, Departman, Unvan',
    }
  }

  // DoS koruması: satır başına map/validate maliyeti var; aşırı büyük dosyada
  // sunucuyu yormamak için sert üst sınır. Başlık satırı dahil rowCount.
  if (sheet.rowCount > 2000) {
    return {
      rows: [],
      parseError: 'Tek seferde en fazla 2000 satır işlenebilir. Lütfen dosyayı bölerek yükleyin.',
    }
  }

  const normalizeHeader = (raw: unknown): string =>
    cellToString(raw).replace(/\*+$/, '').trim().toLowerCase()

  const rawHeaders = sheet.getRow(1).values as unknown[]
  const normalizedHeaders = rawHeaders.slice(1).map(normalizeHeader)
  const canonicalHeaders = normalizedHeaders.map(resolveHeader)

  // Tanınmayan başlıkları bildir (UI'da kullanıcıya gösterilebilir)
  const unknownHeaders = normalizedHeaders.filter((h, i) => h && !canonicalHeaders[i])

  const rawRows: Array<Record<string, string>> = []
  sheet.eachRow((row, idx) => {
    if (idx === 1) return
    const vals = (row.values as unknown[]).slice(1)
    const record: Record<string, string> = {}
    canonicalHeaders.forEach((h, i) => {
      if (h) record[h] = cellToString(vals[i])
    })
    if (record.firstName || record.lastName || record.email) rawRows.push(record)
  })

  if (rawRows.length === 0) {
    return {
      rows: [],
      parseError: 'Geçerli satır bulunamadı. Başlıklar tanınmadıysa: Ad, Soyad, E-posta sütunlarını kontrol edin.',
      unknownHeaders,
    }
  }

  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, parentId: true },
  })
  const rootDepts = departments.filter(d => !d.parentId)

  const rows: ParsedRow[] = rawRows.map((r, i) => {
    const deptInput = r.department || ''
    const subInput = r.subDepartment || ''

    // Üst departman: sadece kök departmanlar arasında ara
    let parentMatch: DeptMatch = { type: 'none' }
    if (deptInput) parentMatch = matchDepartment(deptInput, rootDepts)
    const deptId = parentMatch.type === 'exact' || parentMatch.type === 'fuzzy' ? parentMatch.dept.id : undefined
    const deptName = parentMatch.type === 'exact' || parentMatch.type === 'fuzzy'
      ? parentMatch.dept.name
      : deptInput

    // Alt departman: parent bulunduysa onun çocukları arasında ara
    let subMatch: DeptMatch = { type: 'none' }
    let subResolved: ParsedRow['subDeptMatch'] = !subInput ? 'empty' : 'none'
    let subDeptId: string | undefined
    let subDeptName = subInput
    let subCandidates: Array<{ id: string; name: string }> | undefined

    if (subInput && deptId) {
      const childDepts = departments.filter(d => d.parentId === deptId)
      subMatch = matchDepartment(subInput, childDepts)
      if (subMatch.type === 'exact' || subMatch.type === 'fuzzy') {
        subDeptId = subMatch.dept.id
        subDeptName = subMatch.dept.name
        subResolved = subMatch.type
      } else if (subMatch.type === 'ambiguous') {
        subResolved = 'ambiguous'
        subCandidates = subMatch.candidates
      } else {
        // Parent altında yok — import aşamasında parent altına yaratılacak (auto-create).
        // Schema artık (orgId, name, parentId) unique → aynı isim farklı parent altında
        // olabilir, başka root altındaki aynı isimli kayıt reuse edilmez.
        subResolved = 'auto-create'
      }
    } else if (subInput && !deptId) {
      // Üst departman bulunamadıysa alt departman doğrulaması yapılmaz
      subResolved = 'none'
    } else if (!subInput && deptId) {
      // Alt departman boş + parent var → "{ParentName} (Genel)" formatında auto-create.
      // Personel root'a düşmesin diye parent ile aynı seviyede bir "diğerleri" sub'ı oluşur.
      // Schema artık aynı isim farklı parent altında izin verdiği için her parent'ın
      // kendi "(Genel)" sub'ı olur.
      subResolved = 'auto-create'
      subDeptName = `${deptName} (Genel)`
      // Bu sub mevcut ağaçta zaten var mı? (önceki import'tan kalmış olabilir)
      const childDepts = departments.filter(d => d.parentId === deptId)
      const existingGenel = childDepts.find(d => d.name === subDeptName)
      if (existingGenel) {
        subDeptId = existingGenel.id
        subResolved = 'exact'
      }
    }

    return {
      rowIndex: i + 2,
      firstName: r.firstName || '',
      lastName: r.lastName || '',
      email: (r.email || '').toLowerCase(),
      password: r.password || '',
      phone: r.phone || '',
      title: r.title || '',
      tcKimlik: normalizeTcKimlik(r.tcKimlik || ''),
      deptId,
      deptName,
      deptMatch: !deptInput ? 'empty' : parentMatch.type,
      deptCandidates: parentMatch.type === 'ambiguous' ? parentMatch.candidates : undefined,
      subDeptId,
      subDeptName,
      subDeptMatch: subResolved,
      subDeptCandidates: subCandidates,
    }
  })

  return { rows, unknownHeaders }
}

// ── Doğrulama ─────────────────────────────────────────────────────────────

export type RowResult = { rowIndex: number; email: string; status: 'ok' | 'error'; reason?: string }

/**
 * Parse edilmiş satırları doğrular: zorunlu alanlar, e-posta/TC format + duplicate
 * (dosya içi ve DB), departman eşleşme durumu. Davranış bulk-import ile birebir aynıdır.
 */
export async function validateRows(rows: ParsedRow[], orgId: string): Promise<{ rowResults: RowResult[]; validRows: ParsedRow[] }> {
  const rowResults: RowResult[] = []
  const validRows: ParsedRow[] = []
  const seenEmails = new Map<string, number>()
  const seenTcHashes = new Map<string, number>()

  // Email opsiyonel — sadece doluları DB'de duplicate kontrolüne sok.
  // Sentetik adres üretimi import loop'unda; preview aşamasında o satır email'siz görünür.
  const emailList = rows.map(r => r.email).filter(Boolean)
  const existingUsers = emailList.length > 0
    ? await prisma.user.findMany({
        where: { email: { in: emailList }, organizationId: orgId },
        select: { email: true },
      })
    : []
  const existingEmailSet = new Set(existingUsers.map(u => u.email.toLowerCase()))

  // Mevcut TC hash setini tek sorguda topla — duplicate kontrolü için
  const tcHashList = rows
    .filter(r => r.tcKimlik && isValidTcKimlik(r.tcKimlik))
    .map(r => hashTcKimlik(r.tcKimlik))
  const existingTc = tcHashList.length > 0
    ? await prisma.user.findMany({
        // TEK-ORG: GLOBAL ara (org-scope DEĞİL) — TC başka bir kuruma kayıtlıysa da reddet.
        where: { tcHash: { in: tcHashList } },
        select: { tcHash: true },
      })
    : []
  const existingTcSet = new Set(existingTc.map(u => u.tcHash).filter((h): h is string => !!h))

  for (const row of rows) {
    if (!row.firstName || !row.lastName) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email || '—', status: 'error', reason: 'Ad veya Soyad eksik' })
      continue
    }
    if (!row.title || !row.title.trim()) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email || '—', status: 'error', reason: 'Unvan zorunludur' })
      continue
    }
    // E-posta opsiyonel — boş bırakılırsa sentetik adres üretilir + welcome mail atlanır.
    // Doluysa format ve duplicate kontrolü yapılır.
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'error', reason: 'Geçersiz e-posta formatı' })
      continue
    }
    // Departman ZORUNLU (yeni kural — kök departman atama için)
    if (row.deptMatch === 'empty' || !row.deptName) {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: 'Departman zorunludur',
      })
      continue
    }
    if (row.deptMatch === 'ambiguous') {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: `Departman eşleşmesi belirsiz: "${row.deptName}" — ${row.deptCandidates?.map(c => c.name).join(', ')}`,
      })
      continue
    }
    if (row.deptMatch === 'none') {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: `Departman bulunamadı: "${row.deptName}"`,
      })
      continue
    }
    // Alt Departman OPSİYONEL ve serbest metin — parent altında yoksa import sırasında yaratılır.
    // 'mismatch' (başka parent altında) ve 'none' (hiç yok) artık hata değil; her ikisi de
    // 'auto-create' gibi davranır: kullanıcının yazdığı parent altına yaratılır.
    if (row.subDeptMatch === 'ambiguous') {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: `Alt departman eşleşmesi belirsiz: "${row.subDeptName}" — ${row.subDeptCandidates?.map(c => c.name).join(', ')}`,
      })
      continue
    }
    // Email duplicate kontrolü — sadece dolu satırlarda anlamlı.
    if (row.email) {
      if (seenEmails.has(row.email)) {
        rowResults.push({
          rowIndex: row.rowIndex, email: row.email, status: 'error',
          reason: `Dosya içinde tekrarlayan e-posta (ilk satır: ${seenEmails.get(row.email)})`,
        })
        continue
      }
      seenEmails.set(row.email, row.rowIndex)

      if (existingEmailSet.has(row.email)) {
        rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'error', reason: 'Bu e-posta zaten sistemde kayıtlı' })
        continue
      }
    }

    // TC validation — ZORUNLU her satırda.
    // Resmi denetimde sertifika ↔ personel eşleşmesi için TC olmazsa olmaz;
    // ayrıca PDF endpoint zaten TC'yi schema-zorunlu kılıyor → tutarlı arayüz.
    if (!row.tcKimlik) {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: 'TC Kimlik No zorunludur',
      })
      continue
    }
    if (!isValidTcKimlik(row.tcKimlik)) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'error', reason: 'Geçersiz TC Kimlik No (kontrol haneleri uyuşmuyor)' })
      continue
    }
    const tcHash = hashTcKimlik(row.tcKimlik)
    if (seenTcHashes.has(tcHash)) {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: `Dosya içinde tekrarlayan TC (ilk satır: ${seenTcHashes.get(tcHash)})`,
      })
      continue
    }
    seenTcHashes.set(tcHash, row.rowIndex)

    if (existingTcSet.has(tcHash)) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'error', reason: 'Bu TC Kimlik No sistemde zaten kayıtlı (bir kişi yalnızca bir kuruma bağlı olabilir)' })
      continue
    }

    rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'ok' })
    validRows.push(row)
  }

  return { rowResults, validRows }
}
