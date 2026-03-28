import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import ExcelJS from 'exceljs'

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const formData = await request.formData().catch(() => null)
  if (!formData) return errorResponse('Dosya yüklenemedi')

  const file = formData.get('file') as File | null
  if (!file) return errorResponse('Dosya seçilmedi')

  const arrayBuffer = await file.arrayBuffer()

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(arrayBuffer)
  } catch {
    return errorResponse('Excel dosyası okunamadı. Lütfen .xlsx formatında yükleyin.')
  }

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) {
    return errorResponse('Excel dosyası boş veya hatalı. İlk satır başlık olmalı: Ad, Soyad, E-posta, Şifre, TC, Telefon, Departman, Unvan')
  }

  // Parse headers
  const rawHeaders = sheet.getRow(1).values as (string | undefined)[]
  const headers = rawHeaders.slice(1).map(h => (h || '').toString().trim().toLowerCase())

  // Parse rows
  const rows: Array<Record<string, string>> = []
  sheet.eachRow((row, idx) => {
    if (idx === 1) return
    const vals = (row.values as (string | number | undefined)[]).slice(1)
    const record: Record<string, string> = {}
    headers.forEach((h, i) => { record[h] = (vals[i] ?? '').toString().trim() })
    if (record['ad'] || record['e-posta'] || record['email']) rows.push(record)
  })

  if (rows.length === 0) return errorResponse('Geçerli satır bulunamadı')

  // Load departments for matching
  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  })

  const supabase = await createServiceClient()

  let created = 0
  let failed = 0
  const errors: string[] = []

  for (const r of rows) {
    const firstName = r['ad'] || r['ad*'] || ''
    const lastName = r['soyad'] || r['soyad*'] || ''
    const email = r['e-posta'] || r['email'] || r['e-posta*'] || ''
    const password = r['şifre'] || r['sifre'] || r['şifre*'] || r['parola'] || 'Temp1234!'

    if (!firstName || !lastName || !email) {
      failed++
      errors.push(`Satır ${rows.indexOf(r) + 2}: Ad, Soyad veya E-posta eksik`)
      continue
    }

    const deptName = r['departman'] || r['departman*'] || ''
    const dept = departments.find(d => d.name.toLowerCase() === deptName.toLowerCase())

    try {
      // Create Supabase auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName, role: 'staff', organization_id: orgId },
      })

      if (authError) {
        failed++
        if (authError.message?.includes('already registered')) {
          errors.push(`${email}: Bu e-posta zaten kayıtlı`)
        } else {
          errors.push(`${email}: ${authError.message}`)
        }
        continue
      }

      // Create DB user
      await prisma.user.create({
        data: {
          id: authUser.user.id,
          email,
          firstName,
          lastName,
          role: 'staff',
          organizationId: orgId,
          tcNo: r['tc'] || r['tc kimlik'] || r['tc no'] || undefined,
          phone: r['telefon'] || undefined,
          departmentId: dept?.id,
          department: dept?.name,
          title: r['unvan'] || r['ünvan'] || undefined,
        },
      })

      created++
    } catch (err) {
      failed++
      errors.push(`${email}: Veritabanı hatası`)
      logger.error('Bulk Import', `DB insert failed for ${email}`, err)
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

  return jsonResponse({ created, failed, total: rows.length, errors: errors.slice(0, 10) }, created > 0 ? 201 : 400)
}
