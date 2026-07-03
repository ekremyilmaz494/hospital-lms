import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, getOrgUrl } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import { maskEmail } from '@/lib/pii-mask'
import { sendStaffWelcomeEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'
import { generateTempPassword } from '@/lib/passwords'
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc'
import { hashTcKimlik, tcAuditRef } from '@/lib/tc-crypto'
import { generateSyntheticEmail } from '@/lib/synthetic-email'
import { autoAssignByDepartment } from '@/lib/auto-assign'
// Parse/doğrulama yardımcıları İK/HBYS senkron çekirdeğiyle paylaşılmak üzere
// src/lib/integration/staff-row.ts'e çıkarıldı — davranış birebir aynı.
import { parseImportFile, validateRows, type ParsedRow } from '@/lib/integration/staff-row'

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
  } else {
    // Preview de tam .xlsx parse ediyor (ExcelJS workbook.xlsx.load) — rate limit
    // olmadan tekrarlı upload ile DoS açığı oluşur. Import'tan daha gevşek ama
    // mevcut bir limit uyguluyoruz (org bazlı, saatte 30 preview).
    const previewAllowed = await checkRateLimit(`bulk-import-preview:org:${orgId}`, 30, 3600)
    if (!previewAllowed) {
      return new Response(JSON.stringify({ error: 'Saatte en fazla 30 önizleme yapılabilir. Lütfen biraz sonra tekrar deneyin.' }), {
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
    const allClientDeptIds = Array.from(new Set(
      body.rows.flatMap(r => [r.deptId, r.subDeptId].filter(Boolean) as string[]),
    ))
    const validDepts = allClientDeptIds.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: allClientDeptIds }, organizationId: orgId },
          select: { id: true, name: true, parentId: true },
        })
      : []
    const validDeptMap = new Map(validDepts.map(d => [d.id, d]))

    rows = body.rows.map((r, i) => {
      const parentValid = r.deptId ? validDeptMap.get(r.deptId) : undefined
      const subValid = r.subDeptId ? validDeptMap.get(r.subDeptId) : undefined
      // Üst departman gerçek bir kök mü?
      const parentOk = !!parentValid && !parentValid.parentId
      // Alt departman parent altında mı?
      const subOk = !!subValid && !!parentValid && subValid.parentId === parentValid.id
      const subName = (r.subDeptName || '').trim()
      // Parent OK + alt-departman adı yazılmış ama mevcut bir kayıt eşleşmiyorsa → auto-create
      const subAutoCreate = parentOk && !!subName && !subOk
      return {
        rowIndex: r.rowIndex || i + 2,
        firstName: (r.firstName || '').trim(),
        lastName: (r.lastName || '').trim(),
        email: (r.email || '').trim().toLowerCase(),
        password: r.password || '',
        phone: (r.phone || '').trim(),
        title: (r.title || '').trim(),
        tcKimlik: normalizeTcKimlik(r.tcKimlik || ''),
        deptId: parentOk ? r.deptId : undefined,
        deptName: r.deptName || '',
        deptMatch: parentOk ? 'exact' : (r.deptName ? 'none' : 'empty'),
        subDeptId: subOk ? r.subDeptId : undefined,
        subDeptName: subName,
        subDeptMatch: subOk ? 'exact' : (subAutoCreate ? 'auto-create' : (subName ? 'none' : 'empty')),
      }
    })
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
    select: { name: true, slug: true, brandColor: true },
  })
  const organizationName = org?.name ?? 'Organizasyon'
  const brandColor = org?.brandColor ?? null
  // Toplu yüklenen personel doğrudan kendi hastane subdomain'ine yönlenir
  const loginUrl = `${getOrgUrl(org?.slug)}/auth/login`
  const emailPromises: Promise<void>[] = []

  // Departman ID → name çözümlemesi (PDF + sonuç tablosu için, tek sorgu)
  // Hem parent hem alt id'leri eklenir (UI'da hangisine atandığı gösterilebilsin)
  // Auto-create alt departmanlar: kullanıcı serbest metin yazmış, parent altında yok → yarat.
  // Aynı (parent, isim) çiftini tek seferde yarat — Excel'de N satır aynı alt departmanı
  // referanslıyorsa N kayıt değil 1 kayıt oluşur.
  const autoCreateMap = new Map<string, string>() // key: `${parentId}::${nameLower}` → newDeptId
  const autoCreatePending: Array<{ key: string; parentId: string; name: string }> = []
  for (const row of validRows) {
    if (row.subDeptMatch !== 'auto-create' || !row.deptId || !row.subDeptName) continue
    const name = row.subDeptName.trim()
    if (!name) continue
    const key = `${row.deptId}::${name.toLowerCase()}`
    if (autoCreateMap.has(key) || autoCreatePending.some(p => p.key === key)) continue
    autoCreatePending.push({ key, parentId: row.deptId, name })
  }
  if (autoCreatePending.length > 0) {
    // Department schema: partial unique index'ler — (orgId, name) kök seviyesinde,
    // (orgId, name, parent_id) alt seviyede unique. Aynı isim FARKLI parent altında
    // serbestçe yaratılabilir. Reuse kuralı sadece AYNI parent altındaki aynı isim için.
    const orgDepts = await prisma.department.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, parentId: true },
    })
    for (const p of autoCreatePending) {
      const nameLower = p.name.toLowerCase()
      // Sadece aynı parent altında aynı isim varsa reuse — farklı parent altındaki
      // aynı isim ayrı kayıt; auto-create yeni bir tane yaratabilir.
      const hit = orgDepts.find(d => d.name.toLowerCase() === nameLower && d.parentId === p.parentId)
      if (hit) {
        autoCreateMap.set(p.key, hit.id)
        continue
      }
      try {
        const created = await prisma.department.create({
          data: { organizationId: orgId, parentId: p.parentId, name: p.name },
          select: { id: true, name: true, parentId: true },
        })
        autoCreateMap.set(p.key, created.id)
        // Sonraki pending kayıtların aynı (parent, isim) referanslayabilmesi için cache güncel.
        orgDepts.push(created)
      } catch (err) {
        // Race condition: aynı parent altında aynı isim eşzamanlı yaratıldı → yeniden oku ve reuse et.
        const dup = await prisma.department.findFirst({
          where: {
            organizationId: orgId,
            parentId: p.parentId,
            name: { equals: p.name, mode: 'insensitive' },
          },
          select: { id: true },
        })
        if (dup) {
          autoCreateMap.set(p.key, dup.id)
        } else {
          logger.error('Bulk Import', `Alt departman yaratılamadı: ${p.name}`, err instanceof Error ? err.message : err)
        }
      }
    }
    // Row'ların subDeptId'sini doldur
    for (const row of validRows) {
      if (row.subDeptId || row.subDeptMatch !== 'auto-create' || !row.deptId || !row.subDeptName) continue
      const key = `${row.deptId}::${row.subDeptName.trim().toLowerCase()}`
      const id = autoCreateMap.get(key)
      if (id) row.subDeptId = id
    }
  }

  const distinctDeptIds = Array.from(new Set(
    validRows.flatMap(r => [r.deptId, r.subDeptId].filter((id): id is string => !!id)),
  ))
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

    // Email opsiyonel — boşsa sentetik adres üretilir (synthetic-email helper).
    // Personel TC + şifre ile login olur; sentetik email asla UI'da görünmez.
    const hasRealEmail = !!row.email
    const effectiveEmail = hasRealEmail
      ? row.email
      : generateSyntheticEmail(hashTcKimlik(row.tcKimlik))

    // Atama: alt departman varsa oraya, yoksa parent'a ata
    const assignedDeptId = row.subDeptId ?? row.deptId

    try {
      const { dbUser: newUser } = await createAuthUser({
        email: effectiveEmail,
        password: tempPassword,
        firstName: row.firstName,
        lastName: row.lastName,
        role: 'staff',
        organizationId: orgId,
        phone: row.phone || undefined,
        departmentId: assignedDeptId,
        title: row.title || undefined,
        mustChangePassword: true,
        // KVKK: ham TC sadece createAuthUser içinde encrypt + hash'lenir, sonra atılır
        tcKimlik: row.tcKimlik || undefined,
        tcAddedByUserId: dbUser.id,
      })
      createdUserIds.push(newUser.id)
      created++

      // Departman eğitim kurallarına göre otomatik atama (best-effort)
      if (assignedDeptId) {
        try {
          await autoAssignByDepartment(newUser.id, assignedDeptId, orgId, dbUser.id)
        } catch (err) {
          logger.warn('bulk-import', 'autoAssignByDepartment basarisiz', err instanceof Error ? err.message : err)
        }
      }
      results.push({
        // Frontend'de sentetik adres tabloda gösterilmesin diye sadece gerçek email döner
        email: hasRealEmail ? row.email : '',
        name: `${row.firstName} ${row.lastName}`,
        status: 'created',
        tempPassword,
        tcKimlik: row.tcKimlik || undefined,
        department: assignedDeptId ? (deptNameMap[assignedDeptId] ?? null) : null,
        title: row.title || null,
      })

      // Welcome mail SADECE gerçek email girilmiş satırlara gider; sentetik adres atlanır.
      if (hasRealEmail) {
        emailPromises.push(
          sendStaffWelcomeEmail({
            to: row.email,
            staffName: `${row.firstName} ${row.lastName}`,
            organizationName: organizationName,
            brandColor,
            tempPassword,
            loginUrl,
          }).then(() => undefined).catch(err => {
            logger.warn('bulk-import', `Hoş geldiniz maili gönderilemedi: ${maskEmail(row.email)}`, err instanceof Error ? err.message : err)
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
