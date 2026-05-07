import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, getAppUrl } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import { sendStaffWelcomeEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'
import { generateTempPassword } from '@/lib/passwords'
import ExcelJS from 'exceljs'
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc'
import { hashTcKimlik, tcAuditRef } from '@/lib/tc-crypto'

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
  // TC Kimlik No — KVKK gereği AES-GCM ile şifreli, HMAC ile hash'li saklanır.
  // Resmi sertifika eşleşmesi için zorunlu (denetim kanıtı).
  tcKimlik:  ['tc', 'tckn', 'tc kimlik no', 'tc kimlik', 'tc no', 'kimlik no', 'kimlik numarası', 'national id', 'tckimlik'],
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
  // Ham TC (sadece bu request'in lifetime'ında plaintext); validateRows checksum'ı doğrular.
  tcKimlik: string
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
      tcKimlik: normalizeTcKimlik(r.tcKimlik || ''),
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
        where: { tcHash: { in: tcHashList }, organizationId: orgId },
        select: { tcHash: true },
      })
    : []
  const existingTcSet = new Set(existingTc.map(u => u.tcHash).filter((h): h is string => !!h))

  for (const row of rows) {
    if (!row.firstName || !row.lastName) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email || '—', status: 'error', reason: 'Ad veya Soyad eksik' })
      continue
    }
    // E-posta opsiyonel — boş bırakılırsa sentetik adres üretilir + welcome mail atlanır.
    // Doluysa format ve duplicate kontrolü yapılır.
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
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
      rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'error', reason: 'Bu TC Kimlik No bu kurumda zaten kayıtlı' })
      continue
    }

    rowResults.push({ rowIndex: row.rowIndex, email: row.email, status: 'ok' })
    validRows.push(row)
  }

  return { rowResults, validRows }
}

// ── POST: Excel yükle (preview/import) ya da JSON satır import ────────────

export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const orgId = organizationId
  const { searchParams } = new URL(request.url)
  const isPreview = searchParams.get('mode') === 'preview'

  // Org bazlı rate limit (preview ve gerçek import için ayrı, sadece import bypass'la kullanmasın)
  // Tek admin tek IP'den 100+ personel davet edebilmeli — IP'ye değil org'a kilitliyoruz.
  if (!isPreview) {
    const allowed = await checkRateLimit(`bulk-import:org:${orgId}`, 500, 3600)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Saatte en fazla 500 personel yüklenebilir. Lütfen biraz sonra tekrar deneyin.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
      })
    }
  }

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
      tcKimlik: normalizeTcKimlik(r.tcKimlik || ''),
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

  // ── Gerçek import — TÜM SATIRLAR DIRECT MODE ─────────────────────────────
  // Şifre dolu satırlarda admin'in seçtiği kullanılır; boş satırlarda
  // generateTempPassword() ile güvenli bir geçici şifre üretilir.
  // Hepsinde mustChangePassword=true → personel ilk girişte değiştirmek zorunda.
  // Davet linki akışı bu route'tan kaldırıldı — admin "personeli ekle" derken
  // tek tip "hesap aç + bilgileri PDF olarak ver" davranışı bekliyor (KVKK +
  // resmi denetim ergonomisi).
  let created = 0
  let failed = 0
  const importErrors: string[] = rowResults
    .filter(r => r.status === 'error')
    .map(r => `Satır ${r.rowIndex} (${r.email}): ${r.reason}`)

  // Frontend "Giriş Bilgileri PDF'i indir" için zengin sonuç döndürüyoruz.
  // tcKimlik admin'e geri verilir (PDF üretirken cookie auth dışında ayrıca
  // gönderilmez — KVKK: response sadece request'i atan admin'e gider).
  const results: {
    email: string
    name: string
    status: 'created' | 'failed'
    tempPassword?: string
    tcKimlik?: string
    department?: string | null
    title?: string | null
    error?: string
  }[] = []
  const createdUserIds: string[] = []

  // Hoş geldiniz maili için hastane bilgileri (tek sorgu, loop öncesi)
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, brandColor: true },
  })
  const hospitalName = org?.name ?? 'Hastane'
  const brandColor = org?.brandColor ?? null
  const appUrl = getAppUrl()
  const loginUrl = `${appUrl}/auth/login`
  const emailPromises: Promise<void>[] = []

  // Departman ID → name çözümlemesi (PDF + sonuç tablosu için, tek sorgu)
  const distinctDeptIds = Array.from(new Set(validRows.map(r => r.deptId).filter((id): id is string => !!id)))
  const deptNameMap = distinctDeptIds.length > 0
    ? Object.fromEntries(
        (await prisma.department.findMany({
          where: { id: { in: distinctDeptIds }, organizationId: orgId },
          select: { id: true, name: true },
        })).map(d => [d.id, d.name]),
      )
    : {}

  for (const row of validRows) {
    // Şifre opsiyonel — admin Excel'e yazdıysa o, yoksa otomatik üret.
    // Her iki durumda da generateTempPassword formatına uyumlu uzunluk/komplekslik olduğunu
    // varsaymıyoruz; admin'in girdiği değer Supabase Auth tarafından doğrulanır (en az 8).
    const tempPassword = row.password.trim() || generateTempPassword()

    // Email opsiyonel — boşsa Supabase Auth için sentetik adres üret.
    // .invalid TLD (RFC 6761) DNS'te asla resolve etmez → yanlışlıkla mail gönderimi sonuçsuz kalır.
    // Sentetik adres tcHash bazlı → idempotent, aynı TC için aynı adres üretilir; ama TC zaten
    // org-içi unique olduğu için Supabase'in email-unique kuralı kırılmaz.
    // Personel TC + şifre ile login olur; sentetik email asla görmez.
    const hasRealEmail = !!row.email
    const effectiveEmail = hasRealEmail
      ? row.email
      : `staff-${hashTcKimlik(row.tcKimlik).slice(0, 12)}@klinovax.invalid`

    try {
      const { dbUser: newUser } = await createAuthUser({
        email: effectiveEmail,
        password: tempPassword,
        firstName: row.firstName,
        lastName: row.lastName,
        role: 'staff',
        organizationId: orgId,
        phone: row.phone || undefined,
        departmentId: row.deptId,
        title: row.title || undefined,
        mustChangePassword: true,
        // KVKK: ham TC sadece createAuthUser içinde encrypt + hash'lenir, sonra atılır
        tcKimlik: row.tcKimlik || undefined,
        tcAddedByUserId: dbUser.id,
      })
      createdUserIds.push(newUser.id)
      created++
      results.push({
        // Frontend'de sentetik adres tabloda gösterilmesin diye sadece gerçek email döner
        email: hasRealEmail ? row.email : '',
        name: `${row.firstName} ${row.lastName}`,
        status: 'created',
        tempPassword,
        tcKimlik: row.tcKimlik || undefined,
        department: row.deptId ? (deptNameMap[row.deptId] ?? null) : null,
        title: row.title || null,
      })

      // Welcome mail SADECE gerçek email girilmiş satırlara gider; sentetik adres atlanır.
      if (hasRealEmail) {
        emailPromises.push(
          sendStaffWelcomeEmail({
            to: row.email,
            staffName: `${row.firstName} ${row.lastName}`,
            organizationName: hospitalName,
            brandColor,
            tempPassword,
            loginUrl,
          }).then(() => undefined).catch(err => {
            logger.warn('bulk-import', `Hoş geldiniz maili gönderilemedi: ${row.email}`, err instanceof Error ? err.message : err)
          }),
        )
      }
    } catch (err) {
      failed++
      const errMsg = err instanceof AuthUserError || err instanceof DbUserError
        ? err.safeMessage
        : 'Beklenmeyen hata'
      const errorTag = row.email || `(TC ile, satır ${row.rowIndex})`
      importErrors.push(`${errorTag}: ${errMsg}`)
      results.push({ email: row.email || '', name: `${row.firstName} ${row.lastName}`, status: 'failed', error: errMsg })
      logger.error('Bulk Import', `Failed for ${errorTag}`, err instanceof Error ? err.message : err)
    }
  }

  // Tüm mail gönderimlerini bekle — serverless fonksiyon kesilmeden tamamlansın
  await Promise.allSettled(emailPromises)

  // KVKK audit — TC plaintext yazılmaz; sadece hash prefix'leri (korelasyon için)
  const tcRefs = validRows
    .filter(r => r.tcKimlik && isValidTcKimlik(r.tcKimlik))
    .map(r => tcAuditRef(r.tcKimlik))

  await audit({
    action: 'bulk_import',
    entityType: 'user',
    newData: {
      totalRows: rows.length,
      created,
      failed,
      createdUserIds,         // ← rollback için
      tcRefCount: tcRefs.length,
      tcRefs,                 // ← KVKK denetiminde "kaç TC işlendi" kanıtı
    },
  })

  return jsonResponse(
    {
      created,
      failed,
      total: rows.length,
      errors: importErrors.slice(0, 20),
      results,
    },
    created > 0 ? 201 : 400,
  )
}, { requireOrganization: true })
