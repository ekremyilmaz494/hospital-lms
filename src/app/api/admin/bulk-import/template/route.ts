import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'

/**
 * Toplu personel import için Excel şablonu üretir.
 * - Sayfa 1 "Personel": başlıklar + 2 örnek satır + departman dropdown
 * - Sayfa 2 "Departmanlar": geçerli departman adları (referans)
 *
 * Şifre sütunu boş bırakılabilir — backend otomatik güvenli şifre üretir.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    select: { name: true },
    orderBy: { name: 'asc' },
  })
  const deptNames = departments.map(d => d.name)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Devakent Hastanesi LMS'
  wb.created = new Date()

  // ── Sayfa 1: Personel ─────────────────────────────────────────────
  const sheet = wb.addWorksheet('Personel')

  sheet.columns = [
    { header: 'Ad',        key: 'ad',       width: 18 },
    { header: 'Soyad',     key: 'soyad',    width: 18 },
    { header: 'E-posta',   key: 'email',    width: 32 },
    { header: 'Telefon',   key: 'telefon',  width: 16 },
    { header: 'Departman', key: 'departman', width: 20 },
    { header: 'Unvan',     key: 'unvan',    width: 22 },
  ]

  // Başlık satırı stili
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D9668' }, // brand-600
  }
  headerRow.height = 28
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' }

  // Örnek satırlar
  // Örnek satırlar — farklı senaryoları göstersin
  const exampleRows = [
    {
      ad: 'Ayşe', soyad: 'Yılmaz',
      email: 'ayse.yilmaz@hastane.com',
      telefon: '05551234567',
      departman: deptNames[0] || 'Acil Servis',
      unvan: 'Hemşire',
    },
    {
      ad: 'Mehmet', soyad: 'Demir',
      email: 'mehmet.demir@hastane.com',
      telefon: '05559876543',
      departman: deptNames[1] || deptNames[0] || 'Dahiliye',
      unvan: 'Doktor',
    },
    {
      ad: 'Fatma', soyad: 'Kaya',
      email: 'fatma.kaya@hastane.com',
      telefon: '', // telefon opsiyonel, boş bırakılabilir
      departman: deptNames[2] || deptNames[0] || 'Yoğun Bakım',
      unvan: 'Başhemşire',
    },
    {
      ad: 'Ali', soyad: 'Çelik',
      email: 'ali.celik@hastane.com',
      telefon: '05321112233',
      departman: '', // departman opsiyonel (atama sonradan yapılabilir)
      unvan: '',
    },
  ]
  exampleRows.forEach(r => sheet.addRow(r))

  // Örnek satırları italik + gri (silinecekleri belli olsun)
  for (let r = 2; r <= exampleRows.length + 1; r++) {
    const row = sheet.getRow(r)
    row.font = { italic: true, color: { argb: 'FF64748B' } }
  }

  // Örneklerin altına 10 boş satır + ince ayırıcı (kullanıcı direkt buraya yazmaya başlasın)
  const separatorRow = sheet.getRow(exampleRows.length + 2)
  separatorRow.getCell(1).value = '↓ Örnek satırları silip kendi personelinizi buraya girin ↓'
  separatorRow.getCell(1).font = { bold: true, color: { argb: 'FF0D9668' }, size: 10 }
  sheet.mergeCells(`A${exampleRows.length + 2}:F${exampleRows.length + 2}`)
  separatorRow.alignment = { horizontal: 'center' }

  // Departman için dropdown doğrulaması — E sütunu (şifre kaldırıldıktan sonra)
  // Örnek satırları (2-5) + ayırıcı SONRASI (7-500) — ayırıcı satırını (6) atla
  if (deptNames.length > 0) {
    const separatorIdx = exampleRows.length + 2 // 6
    for (let r = 2; r <= 500; r++) {
      if (r === separatorIdx) continue
      sheet.getCell(`E${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Departmanlar!$A$2:$A$${deptNames.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Geçersiz departman',
        error: 'Lütfen Departmanlar sayfasındaki listeden seçin',
      }
    }
  }

  // Başlık satırını dondur
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Sayfa 2: Departmanlar (referans) ──────────────────────────────
  const deptSheet = wb.addWorksheet('Departmanlar')
  deptSheet.columns = [{ header: 'Geçerli Departman Adları', key: 'name', width: 32 }]
  const deptHeaderRow = deptSheet.getRow(1)
  deptHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  deptHeaderRow.fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' },
  }
  if (deptNames.length === 0) {
    deptSheet.addRow({ name: '(Önce admin panelinden departman oluşturun)' })
  } else {
    deptNames.forEach(n => deptSheet.addRow({ name: n }))
  }

  // ── Sayfa 3: Yardım ───────────────────────────────────────────────
  const helpSheet = wb.addWorksheet('Yardım')
  helpSheet.columns = [{ width: 90 }]
  const help = [
    'TOPLU PERSONEL YÜKLEME — KULLANIM KILAVUZU',
    '',
    'ZORUNLU ALANLAR: Ad, Soyad, E-posta',
    'OPSİYONEL ALANLAR: Telefon, Departman, Unvan',
    '',
    'ŞIFRE (otomatik):',
    '  • Şifre sütunu YOKTUR — sistem her personel için güvenli şifre üretir.',
    '  • Geçici şifre, personelin e-posta adresine otomatik olarak gönderilir.',
    '  • Personel ilk girişinde şifresini değiştirmek zorundadır.',
    '',
    'E-POSTA:',
    '  • Benzersiz olmalı, daha önce sistemde kayıtlı olmamalı.',
    '  • Türkçe karakter (ş, ç, ğ, ü, ö, ı) KULLANMAYIN. Excel otomatik link yaparsa sistem temizler.',
    '',
    'DEPARTMAN:',
    '  • "Departmanlar" sayfasındaki tam adı seçin (hücreye tıkladığınızda açılır liste çıkar).',
    '  • Kısaltma yazarsanız (örn. "Acil" → "Acil Servis") sistem otomatik eşler — tek eşleşme varsa.',
    '  • Birden fazla departman eşleşirse sistem hata verir, siz seçersiniz.',
    '  • Boş bırakırsanız atama sonradan yapılabilir.',
    '',
    'TELEFON:',
    '  • Başında 0 olmak üzere 11 haneli (05XXXXXXXXX).',
    '  • Opsiyonel — boş bırakılabilir.',
    '',
    'UNVAN:',
    '  • Hemşire, Doktor, Başhemşire, Teknisyen, vb.',
    '  • Opsiyonel.',
    '',
    'İPUÇLARI:',
    '  • İlk 4 satır (italik, gri) ÖRNEKLERDİR — silip kendi verilerinizi yazın.',
    '  • 500 satıra kadar yükleyebilirsiniz.',
    '  • Yüklemeden önce "Önizleme" ekranında hataları inline düzeltebilirsiniz.',
    '  • Yükleme sonrası /admin/staff/imports sayfasından geri alabilirsiniz.',
    '  • Başlık isimleri esnek: "Ad"/"İsim"/"First Name", "Soyad"/"Surname", "E-posta"/"Mail" hepsi çalışır.',
  ]
  help.forEach((line, i) => {
    const row = helpSheet.addRow([line])
    if (i === 0) row.font = { bold: true, size: 14, color: { argb: 'FF0D9668' } }
  })

  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="personel-import-sablonu.xlsx"',
      'Cache-Control': 'private, max-age=60',
    },
  })
}
