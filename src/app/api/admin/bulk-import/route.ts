import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import ExcelJS from 'exceljs'

/** Satır ayrıştırma sonucu */
interface ParsedRow {
  rowIndex: number
  firstName: string
  lastName: string
  email: string
  password: string
  tcNo?: string
  phone?: string
  title?: string
  deptId?: string
  deptName?: string
}

/** Dosyayı ayrıştır ve departmanlarla eşleştir — DB/Auth'a dokunmaz */
async function parseImportFile(
  arrayBuffer: ArrayBuffer,
  orgId: string,
): Promise<{ rows: ParsedRow[]; parseError?: string }> {
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
      parseError: 'Excel dosyası boş veya hatalı. İlk satır başlık olmalı: Ad, Soyad, E-posta, Şifre, TC, Telefon, Departman, Unvan',
    }
  }

  const rawHeaders = sheet.getRow(1).values as (string | undefined)[]
  const headers = rawHeaders.slice(1).map(h => (h || '').toString().trim().toLowerCase())

  const rawRows: Array<Record<string, string>> = []
  sheet.eachRow((row, idx) => {
    if (idx === 1) return
    const vals = (row.values as (string | number | undefined)[]).slice(1)
    const record: Record<string, string> = {}
    headers.forEach((h, i) => { record[h] = (vals[i] ?? '').toString().trim() })
    if (record['ad'] || record['e-posta'] || record['email']) rawRows.push(record)
  })

  if (rawRows.length === 0) return { rows: [], parseError: 'Geçerli satır bulunamadı' }

  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  })

  const rows: ParsedRow[] = rawRows.map((r, i) => {
    const deptName = r['departman'] || r['departman*'] || ''
    const dept = departments.find(d => d.name.toLowerCase() === deptName.toLowerCase())
    return {
      rowIndex: i + 2,
      firstName: r['ad'] || r['ad*'] || '',
      lastName: r['soyad'] || r['soyad*'] || '',
      email: (r['e-posta'] || r['email'] || r['e-posta*'] || '').toLowerCase(),
      password: r['şifre'] || r['sifre'] || r['şifre*'] || r['parola'] || ('Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1'),
      tcNo: r['tc'] || r['tc kimlik'] || r['tc no'] || undefined,
      phone: r['telefon'] || undefined,
      title: r['unvan'] || r['ünvan'] || undefined,
      deptId: dept?.id,
      deptName: dept?.name || (deptName || undefined),
    }
  })

  return { rows }
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  // B4.3/G4.3 — mode=preview: pre-flight doğrulama turu (kullanıcı oluşturulmaz)
  const { searchParams } = new URL(request.url)
  const isPreview = searchParams.get('mode') === 'preview'

  const formData = await request.formData().catch(() => null)
  if (!formData) return errorResponse('Dosya yüklenemedi')

  const file = formData.get('file') as File | null
  if (!file) return errorResponse('Dosya seçilmedi')

  if (file.size > 10 * 1024 * 1024) return errorResponse('Dosya boyutu 10MB\'ı aşamaz', 400)

  const validMime = file.type.includes('spreadsheet') || file.type.includes('excel')
  const validExt = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (!validMime && !validExt) return errorResponse('Sadece Excel dosyaları (.xlsx, .xls) kabul edilir', 400)

  const arrayBuffer = await file.arrayBuffer()
  const { rows, parseError } = await parseImportFile(arrayBuffer, orgId)
  if (parseError) return errorResponse(parseError)

  // ── Ön doğrulama: her iki modda da çalışır ──────────────────────────────
  type RowResult = { rowIndex: number; email: string; status: 'ok' | 'error'; reason?: string }
  const rowResults: RowResult[] = []
  const validRows: ParsedRow[] = []

  // Dosya içindeki tekrar eden e-postalar
  const seenEmails = new Map<string, number>() // email → ilk satır numarası

  // DB'deki mevcut e-postalar — tek sorguda çek
  const emailList = rows.map(r => r.email).filter(Boolean)
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emailList } },
    select: { email: true },
  })
  const existingEmailSet = new Set(existingUsers.map(u => u.email.toLowerCase()))

  for (const row of rows) {
    if (!row.firstName || !row.lastName || !row.email) {
      rowResults.push({ rowIndex: row.rowIndex, email: row.email || '—', status: 'error', reason: 'Ad, Soyad veya E-posta eksik' })
      continue
    }

    if (seenEmails.has(row.email)) {
      rowResults.push({
        rowIndex: row.rowIndex,
        email: row.email,
        status: 'error',
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

  const previewSummary = {
    total: rows.length,
    valid: validRows.length,
    errors: rowResults.filter(r => r.status === 'error').length,
    rows: rowResults,
  }

  // Preview modunda sadece doğrulama sonucunu dön — hiçbir şey oluşturma
  if (isPreview) {
    return jsonResponse({ preview: true, ...previewSummary })
  }

  // ── Gerçek import ───────────────────────────────────────────────────────
  const supabase = await createServiceClient()
  let created = 0
  let failed = 0
  const importErrors: string[] = rowResults
    .filter(r => r.status === 'error')
    .map(r => `Satır ${r.rowIndex} (${r.email}): ${r.reason}`)

  for (const row of validRows) {
    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: row.email,
        password: row.password,
        email_confirm: true,
        user_metadata: { first_name: row.firstName, last_name: row.lastName, role: 'staff', organization_id: orgId },
      })

      if (authError) {
        failed++
        importErrors.push(`${row.email}: ${authError.message?.includes('already registered') ? 'Bu e-posta zaten kayıtlı' : authError.message}`)
        continue
      }

      await prisma.user.create({
        data: {
          id: authUser.user.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          role: 'staff',
          organizationId: orgId,
          tcNo: row.tcNo,
          phone: row.phone,
          departmentId: row.deptId,
          department: row.deptName,
          title: row.title,
        },
      })

      created++
    } catch (err) {
      failed++
      importErrors.push(`${row.email}: Veritabanı hatası`)
      logger.error('Bulk Import', `DB insert failed for ${row.email}`, err)
    }
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'bulk_import',
    entityType: 'user',
    newData: { totalRows: rows.length, created, failed },
    request,
  })

  return jsonResponse(
    { created, failed, total: rows.length, errors: importErrors.slice(0, 20) },
    created > 0 ? 201 : 400,
  )
}
