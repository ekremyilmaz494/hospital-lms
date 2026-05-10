import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { withAdminRoute } from '@/lib/api-handler'
import { BRAND } from '@/lib/brand'
import { decryptTcKimlik, tcAuditRef } from '@/lib/tc-crypto'
import { isSyntheticEmail } from '@/lib/synthetic-email'
import { logger } from '@/lib/logger'

/**
 * Personel listesini "Toplu Yükleme" şablonuyla bire bir aynı sütun yapısında
 * Excel olarak dışa aktarır. İndirilen dosya doğrudan /api/admin/bulk-import'a
 * geri yüklenebilir (round-trip).
 *
 * Kapsam: kurumdaki tüm staff (aktif + pasif) — pasifler italik/gri.
 * Şifre sütunu BOŞ — hash decrypt edilemez; re-import'ta sistem geçici şifre üretir.
 *
 * KVKK:
 *  - TC açık metin yazılır → her dışa aktarımda AuditLog (action=STAFF_EXPORT)
 *    sadece hash prefix'leri ile (plaintext TC log'a YAZILMAZ).
 *  - Workbook'un ilk sayfası "KVKK Uyarısı" — admin'in dosyayı açar açmaz görmesi için.
 *
 * SENKRONİZASYON: Sütun başlıkları/sırası ŞABLONLA aynı tutulmalı.
 * Şablon: src/app/api/admin/bulk-import/template/route.ts:39
 */
export const GET = withAdminRoute(async ({ organizationId, audit }) => {
  const orgId = organizationId

  const [staff, departments] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        tcEncrypted: true,
        isActive: true,
        departmentRel: {
          select: {
            name: true,
            parent: { select: { name: true } },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      select: { name: true, parentId: true, parent: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  const rootDeptNames = departments.filter(d => !d.parentId).map(d => d.name)
  const altDeptLabels = departments
    .filter(d => d.parentId && d.parent)
    .map(d => `${d.parent!.name} > ${d.name}`)

  const wb = new ExcelJS.Workbook()
  wb.creator = `${BRAND.fullName} LMS`
  wb.created = new Date()

  // ── Sayfa 0: KVKK Uyarısı (workbook'u açar açmaz görünür) ─────────
  const noticeSheet = wb.addWorksheet('KVKK Uyarısı')
  noticeSheet.columns = [{ width: 100 }]
  const exportedAt = new Date()
  const noticeLines: Array<{ text: string; bold?: boolean; color?: string; size?: number }> = [
    { text: 'KVKK UYARISI — KİŞİSEL VERİ İÇERİR', bold: true, color: 'FFB91C1C', size: 14 },
    { text: '' },
    { text: `Dışa aktarma tarihi: ${exportedAt.toLocaleString('tr-TR')}` },
    { text: `Toplam personel: ${staff.length}` },
    { text: '' },
    { text: 'BU DOSYA AÇIK METİN OLARAK ŞU KİŞİSEL VERİLERİ İÇERİR:', bold: true, color: 'FF0D9668' },
    { text: '  • Ad, Soyad, Unvan' },
    { text: '  • TC Kimlik No (11 hane, açık)' },
    { text: '  • E-posta, Telefon' },
    { text: '  • Departman bilgileri' },
    { text: '' },
    { text: 'SORUMLULUKLAR:', bold: true, color: 'FF0D9668' },
    { text: '  • Dosyayı yetkisiz kişilerle paylaşmayınız.' },
    { text: '  • Yerelde şifreli ortamda saklayınız (BitLocker / FileVault).' },
    { text: '  • Bulut depolamaya yüklemeden önce şifreleyiniz veya yüklemeyiniz.' },
    { text: '  • İhtiyacınız bittiğinde güvenli silme yapınız.' },
    { text: '' },
    { text: 'AUDIT LOG:', bold: true, color: 'FF0D9668' },
    { text: '  • Bu dışa aktarma sistem audit log\'una kaydedilmiştir (action=STAFF_EXPORT).' },
    { text: '  • Hangi adminin, ne zaman, kaç personel için indirdiği tutulur.' },
    { text: '  • Plaintext TC log\'a YAZILMAZ — sadece hash referansları.' },
    { text: '' },
    { text: 'GERİ YÜKLEME (Re-Import):', bold: true, color: 'FF0D9668' },
    { text: '  • Bu dosyayı düzenleyip "Toplu Yükle" üzerinden geri yükleyebilirsiniz.' },
    { text: '  • TC bazlı eşleşme yapılır → mevcut personel güncellenir, yeni TC eklenir.' },
    { text: '  • "Şifre" sütunu boştur; doldurursanız o şifreyle güncellenir.' },
  ]
  noticeLines.forEach(({ text, bold, color, size }) => {
    const row = noticeSheet.addRow([text])
    if (bold || color || size) {
      row.font = {
        ...(bold ? { bold: true } : {}),
        ...(color ? { color: { argb: color } } : {}),
        ...(size ? { size } : {}),
      }
    }
  })

  // ── Sayfa 1: Personel ─────────────────────────────────────────────
  // ⚠️  Sütun yapısı şablonla bire bir aynı (bkz. bulk-import/template/route.ts:39).
  //     Buradaki herhangi bir değişiklik şablonda da yapılmalı.
  const sheet = wb.addWorksheet('Personel')
  sheet.columns = [
    { header: 'Ad *',           key: 'ad',           width: 18 },
    { header: 'Soyad *',        key: 'soyad',        width: 18 },
    { header: 'TC Kimlik No *', key: 'tc',           width: 18 },
    { header: 'Departman *',    key: 'departman',    width: 20 },
    { header: 'Alt Departman',  key: 'altDepartman', width: 22 },
    { header: 'E-posta',        key: 'email',        width: 32 },
    { header: 'Şifre',          key: 'sifre',        width: 18 },
    { header: 'Telefon',        key: 'telefon',      width: 16 },
    { header: 'Unvan *',        key: 'unvan',        width: 22 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
  headerRow.height = 28
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' }

  // Veri satırları + KVKK audit hash'leri
  const tcRefs: string[] = []
  let decryptFailures = 0
  for (const u of staff) {
    let tcPlain = ''
    if (u.tcEncrypted) {
      try {
        tcPlain = decryptTcKimlik(u.tcEncrypted)
        tcRefs.push(tcAuditRef(tcPlain))
      } catch (err) {
        decryptFailures++
        logger.error('StaffExport', 'TC decrypt failed', { userId: u.id, err })
        // tcPlain '' kalır → hücre boş, admin manuel tamamlamak zorunda
      }
    }

    const dept = u.departmentRel
    const deptRoot = dept?.parent?.name ?? dept?.name ?? ''
    const deptAlt = dept?.parent ? dept.name : ''
    const emailOut = isSyntheticEmail(u.email) ? '' : (u.email ?? '')

    sheet.addRow({
      ad: u.firstName,
      soyad: u.lastName,
      tc: tcPlain,
      departman: deptRoot,
      altDepartman: deptAlt,
      email: emailOut,
      sifre: '', // hash decrypt edilemez → boş; re-import'ta sistem geçici şifre üretir
      telefon: u.phone ?? '',
      unvan: u.title ?? '',
    })
  }

  // Pasif personel satırlarını soluk göster (admin'in dikkatini çek)
  staff.forEach((u, idx) => {
    if (!u.isActive) {
      const row = sheet.getRow(idx + 2)
      row.font = { color: { argb: 'FF94A3B8' }, italic: true }
    }
  })

  // TC sütunu (C) — text formatı (öndeki 0 kaybolmasın)
  for (let r = 2; r <= staff.length + 1; r++) {
    sheet.getCell(`C${r}`).numFmt = '@'
  }

  // Departman dropdown (D sütunu) — şablonla aynı: kök departmanlar
  if (rootDeptNames.length > 0) {
    const lastRow = Math.max(staff.length + 1, 500)
    for (let r = 2; r <= lastRow; r++) {
      sheet.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`Departmanlar!$A$2:$A$${rootDeptNames.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Geçersiz departman',
        error: 'Lütfen Departmanlar sayfasındaki listeden bir kök departman seçin',
      }
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Sayfa 2: Departmanlar (dropdown veri kaynağı) ─────────────────
  const deptSheet = wb.addWorksheet('Departmanlar')
  deptSheet.columns = [{ header: 'Kök Departman Adları', key: 'name', width: 32 }]
  const deptHeader = deptSheet.getRow(1)
  deptHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  deptHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
  if (rootDeptNames.length === 0) {
    deptSheet.addRow({ name: '(Önce admin panelinden departman oluşturun)' })
  } else {
    rootDeptNames.forEach(n => deptSheet.addRow({ name: n }))
  }

  // ── Sayfa 3: Alt Departmanlar (referans) ──────────────────────────
  const altSheet = wb.addWorksheet('Alt Departmanlar')
  altSheet.columns = [{ header: 'Üst Departman > Alt Departman', key: 'label', width: 50 }]
  const altHeader = altSheet.getRow(1)
  altHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  altHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
  if (altDeptLabels.length === 0) {
    altSheet.addRow({ label: '(Henüz alt departman yok)' })
  } else {
    altDeptLabels.forEach(l => altSheet.addRow({ label: l }))
  }

  // KVKK audit — plaintext TC YAZILMAZ; tcRefs sadece hash prefix
  await audit({
    action: 'STAFF_EXPORT',
    entityType: 'export',
    entityId: null,
    newData: {
      staffCount: staff.length,
      activeCount: staff.filter(u => u.isActive).length,
      decryptFailures,
      tcRefs,
      exportedAt: exportedAt.toISOString(),
    },
  })

  const buffer = await wb.xlsx.writeBuffer()
  const dateStamp = exportedAt.toISOString().split('T')[0]
  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="personel-listesi-${dateStamp}.xlsx"`,
      // KVKK: cache yasak (her admin'e güncel + audit'lenmiş kopya gitsin)
      'Cache-Control': 'no-store',
    },
  })
}, { requireOrganization: true })
