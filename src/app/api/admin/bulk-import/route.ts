import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import ExcelJS from 'exceljs'

// ── Header Alias Map ──────────────────────────────────────────────────────
// Kullanıcı şablonu değiştirebilir veya kendi dosyasını yükleyebilir.
// Farklı yazımların hepsi tek kanonik alana eşlenir.
const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ['ad', 'isim', 'ısim', 'adi', 'adı', 'first name', 'firstname', 'name', 'first'],
  lastName:  ['soyad', 'soyadi', 'soyadı', 'last name', 'lastname', 'surname', 'family name'],
  email:     ['e-posta', 'eposta', 'email', 'e posta', 'mail', 'e-mail', 'posta'],
  password:  ['şifre', 'sifre', 'parola', 'password', 'pwd', 'pass'],
  phone:     ['telefon', 'tel', 'phone', 'gsm', 'cep', 'mobile', 'cep telefonu'],
  department:['departman', 'bölüm', 'bolum', 'birim', 'department', 'dept', 'department name'],
  title:     ['unvan', 'ünvan', 'görev', 'gorev', 'title', 'position', 'job title', 'rol'],
}

/** Normalize edilmiş header'ı kanonik alana eşler — bulunmazsa null */
function resolveHeader(normalized: string): string | null {
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return canonical
  }
  return null
}

// ── Departman Fuzzy Eşleştirme ────────────────────────────────────────────
/**
 * Departman adını DB'deki departmanlarla eşleştirir.
 *  1. Exact (trim + lowercase)
 *  2. Substring — girilen değer bir departmanın içinde geçiyorsa
 *     (örn. "Acil" → "Acil Servis")
 *  3. Prefix — girilen değer bir departmanın başındaysa
 *
 * Birden çok eşleşme varsa "ambiguous" döner → kullanıcı seçsin.
 */
type DeptMatch =
  | { type: 'exact'; dept: { id: string; name: string } }
  | { type: 'fuzzy'; dept: { id: string; name: string } }
  | { type: 'ambiguous'; candidates: Array<{ id: string; name: string }> }
  | { type: 'none' }

function matchDepartment(input: string, departments: Array<{ id: string; name: string }>): DeptMatch {
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
function cellToString(v: unknown): string {
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
interface ParsedRow {
  rowIndex: number
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  title: string
  deptId?: string
  deptName: string
  deptMatch: 'exact' | 'fuzzy' | 'ambiguous' | 'none' | 'empty'
  deptCandidates?: Array<{ id: string; name: string }>
}

async function parseImportFile(
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
    select: { id: true, name: true },
  })

  const rows: ParsedRow[] = rawRows.map((r, i) => {
    const deptInput = r.department || ''
    let match: DeptMatch = { type: 'none' }
    if (deptInput) match = matchDepartment(deptInput, departments)

    const deptId = match.type === 'exact' || match.type === 'fuzzy' ? match.dept.id : undefined
    const deptName = match.type === 'exact' || match.type === 'fuzzy'
      ? match.dept.name
      : deptInput

    return {
      rowIndex: i + 2,
      firstName: r.firstName || '',
      lastName: r.lastName || '',
      email: (r.email || '').toLowerCase(),
      password: r.password || '',
      phone: r.phone || '',
      title: r.title || '',
      deptId,
      deptName,
      deptMatch: !deptInput ? 'empty' : match.type,
      deptCandidates: match.type === 'ambiguous' ? match.candidates : undefined,
    }
  })

  return { rows, unknownHeaders }
}

// ── Doğrulama + Import (dosya ya da JSON) ─────────────────────────────────

type RowResult = { rowIndex: number; email: string; status: 'ok' | 'error'; reason?: string }

async function validateRows(rows: ParsedRow[], orgId: string) {
  const rowResults: RowResult[] = []
  const validRows: ParsedRow[] = []
  const seenEmails = new Map<string, number>()

  const emailList = rows.map(r => r.email).filter(Boolean)
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emailList }, organizationId: orgId },
    select: { email: true },
  })
  const existingEmailSet = new Set(existingUsers.map(u => u.email.toLowerCase()))

  for (const row of rows) {
    if (!row.firstName || !row.lastName || !row.email) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email || '—', status: 'error', reason: 'Ad, Soyad veya E-posta eksik' })
      continue
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'error', reason: 'Geçersiz e-posta formatı' })
      continue
    }
    if (row.deptMatch === 'ambiguous') {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: `Departman eşleşmesi belirsiz: "${row.deptName}" — ${row.deptCandidates?.map(c => c.name).join(', ')}`,
      })
      continue
    }
    if (row.deptMatch === 'none' && row.deptName) {
      rowResults.push({
        rowIndex: row.rowIndex, email: row.email, status: 'error',
        reason: `Departman bulunamadı: "${row.deptName}"`,
      })
      continue
    }
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

    rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'ok' })
    validRows.push(row)
  }

  return { rowResults, validRows }
}

// ── POST: Excel yükle (preview/import) ya da JSON satır import ────────────

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)
  const isPreview = searchParams.get('mode') === 'preview'

  const contentType = request.headers.get('content-type') || ''
  let rows: ParsedRow[] = []
  let unknownHeaders: string[] | undefined

  if (contentType.includes('application/json')) {
    // ── JSON mode: frontend düzenlenmiş satırları gönderiyor ───────────
    const body = await request.json().catch(() => null) as { rows?: ParsedRow[] } | null
    if (!body || !Array.isArray(body.rows)) {
      return errorResponse('Geçersiz istek — rows dizisi zorunlu', 400)
    }
    if (body.rows.length === 0) return errorResponse('Yüklenecek satır yok', 400)
    if (body.rows.length > 500) return errorResponse('Tek seferde en fazla 500 satır yüklenebilir', 400)

    // Departmanları tekrar doğrula (client-provided ID'ye güvenmiyoruz — cross-tenant koruma)
    const deptIds = Array.from(new Set(body.rows.map(r => r.deptId).filter(Boolean) as string[]))
    const validDepts = deptIds.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: deptIds }, organizationId: orgId },
          select: { id: true, name: true },
        })
      : []
    const validDeptIds = new Set(validDepts.map(d => d.id))

    rows = body.rows.map((r, i) => ({
      rowIndex: r.rowIndex || i + 2,
      firstName: (r.firstName || '').trim(),
      lastName: (r.lastName || '').trim(),
      email: (r.email || '').trim().toLowerCase(),
      password: r.password || '',
      phone: (r.phone || '').trim(),
      title: (r.title || '').trim(),
      deptId: r.deptId && validDeptIds.has(r.deptId) ? r.deptId : undefined,
      deptName: r.deptName || '',
      deptMatch: r.deptId && validDeptIds.has(r.deptId) ? 'exact' : (r.deptName ? 'none' : 'empty'),
    }))
  } else {
    // ── File mode: Excel dosyası ────────────────────────────────────────
    const formData = await request.formData().catch(() => null)
    if (!formData) return errorResponse('Dosya yüklenemedi')

    const file = formData.get('file') as File | null
    if (!file) return errorResponse('Dosya seçilmedi')
    if (file.size > 10 * 1024 * 1024) return errorResponse('Dosya boyutu 10MB\'ı aşamaz', 400)

    const validMime = file.type.includes('spreadsheet') || file.type.includes('excel')
    const validExt = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!validMime && !validExt) return errorResponse('Sadece Excel dosyaları (.xlsx, .xls) kabul edilir', 400)

    const arrayBuffer = await file.arrayBuffer()

    const header = new Uint8Array(arrayBuffer.slice(0, 8))
    const isZip = header[0] === 0x50 && header[1] === 0x4b
    const isCFB = header[0] === 0xd0 && header[1] === 0xcf
    if (!isZip && !isCFB) {
      return errorResponse('Geçersiz dosya formatı. Sadece gerçek Excel dosyaları kabul edilir.', 400)
    }

    const parsed = await parseImportFile(arrayBuffer, orgId)
    if (parsed.parseError) return errorResponse(parsed.parseError)
    rows = parsed.rows
    unknownHeaders = parsed.unknownHeaders
  }

  const { rowResults, validRows } = await validateRows(rows, orgId)

  if (isPreview) {
    return jsonResponse({
      preview: true,
      total: rows.length,
      valid: validRows.length,
      errors: rowResults.filter(r => r.status === 'error').length,
      rows: rowResults,
      parsedRows: rows,        // ← inline edit için tam satır verisi
      unknownHeaders: unknownHeaders && unknownHeaders.length > 0 ? unknownHeaders : undefined,
    })
  }

  // ── Gerçek import ───────────────────────────────────────────────────────
  let created = 0
  let failed = 0
  const importErrors: string[] = rowResults
    .filter(r => r.status === 'error')
    .map(r => `Satır ${r.rowIndex} (${r.email}): ${r.reason}`)

  const results: { email: string; name: string; status: 'created' | 'failed'; tempPassword?: string; error?: string }[] = []
  const createdUserIds: string[] = []

  for (const row of validRows) {
    const pwd = row.password || ('Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1')
    try {
      const { dbUser: newUser } = await createAuthUser({
        email: row.email,
        password: pwd,
        firstName: row.firstName,
        lastName: row.lastName,
        role: 'staff',
        organizationId: orgId,
        phone: row.phone || undefined,
        departmentId: row.deptId,
        title: row.title || undefined,
      })
      createdUserIds.push(newUser.id)
      created++
      results.push({ email: row.email, name: `${row.firstName} ${row.lastName}`, status: 'created', tempPassword: pwd })
    } catch (err) {
      failed++
      const errMsg = err instanceof AuthUserError || err instanceof DbUserError
        ? err.safeMessage
        : 'Beklenmeyen hata'
      importErrors.push(`${row.email}: ${errMsg}`)
      results.push({ email: row.email, name: `${row.firstName} ${row.lastName}`, status: 'failed', error: errMsg })
      logger.error('Bulk Import', `Failed for ${row.email}`, err instanceof Error ? err.message : err)
    }
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'bulk_import',
    entityType: 'user',
    newData: {
      totalRows: rows.length,
      created,
      failed,
      createdUserIds,  // ← geri alma için
    },
    request,
  })

  return jsonResponse(
    { created, failed, total: rows.length, errors: importErrors.slice(0, 20), results },
    created > 0 ? 201 : 400,
  )
}
