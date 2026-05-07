import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { withAdminRoute } from '@/lib/api-handler'
import { BRAND } from '@/lib/brand'

/**
 * Toplu personel import için Excel şablonu üretir.
 * - Sayfa 1 "Personel": başlıklar + 4 örnek satır + departman dropdown
 * - Sayfa 2 "Departmanlar": geçerli departman adları (referans)
 *
 * Şifre sütunu OPSİYONEL — admin doluysa o şifreyle, boşsa sistem güvenli geçici
 * şifre üretir. Tüm hesaplar mustChangePassword=true ile açılır (ilk girişte
 * personel şifresini değiştirmek zorundadır). Yükleme sonrası tüm geçici şifreler
 * tek bir PDF'de toplanıp yazıcıdan basılabilir.
 * Backend `şifre / sifre / parola / password / pwd / pass` başlıklarını tanır.
 */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const orgId = organizationId

  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    select: { name: true },
    orderBy: { name: 'asc' },
  })
  const deptNames = departments.map(d => d.name)

  const wb = new ExcelJS.Workbook()
  wb.creator = `${BRAND.fullName} LMS`
  wb.created = new Date()

  // ── Sayfa 1: Personel ─────────────────────────────────────────────
  const sheet = wb.addWorksheet('Personel')

  // Sütun sırası: kimlik bilgileri → e-posta → ŞİFRE (mode tetikleyici) → iletişim → org alanları.
  // Şifre, mode'u belirleyen alan olduğu için E-posta'nın hemen sağında — admin bakarken
  // "burayı boş bırakırsam davet, dolu yazarsam direct hesap" mantığı görsel olarak kümelensin.
  sheet.columns = [
    { header: 'Ad',           key: 'ad',       width: 18 },
    { header: 'Soyad',        key: 'soyad',    width: 18 },
    { header: 'TC Kimlik No', key: 'tc',       width: 16 },
    { header: 'E-posta',      key: 'email',    width: 32 },
    { header: 'Şifre',        key: 'sifre',    width: 18 },
    { header: 'Telefon',      key: 'telefon',  width: 16 },
    { header: 'Departman',    key: 'departman', width: 20 },
    { header: 'Unvan',        key: 'unvan',    width: 22 },
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

  // Örnek satırlar — farklı senaryoları göstersin.
  // TC Kimlik No'lar VALİD (Mod10/11 checksum'ı geçer) — sahte ama doğru formatta.
  // Şifre dolu satırlar → admin'in seçtiği şifre kullanılır.
  // Şifre boş satırlar → sistem güvenli geçici şifre üretir (Pass-XXXXXXXX-!1 formatı).
  // Tüm satırlarda mustChangePassword=true — personel ilk girişte şifresini değiştirmek zorunda.
  const exampleRows = [
    {
      ad: 'Ayşe', soyad: 'Yılmaz',
      tc: '10000000146',
      email: 'ayse.yilmaz@hastane.com',
      sifre: 'Geçici1234!',
      telefon: '05551234567',
      departman: deptNames[0] || 'Acil Servis',
      unvan: 'Hemşire',
    },
    {
      ad: 'Mehmet', soyad: 'Demir',
      tc: '11111111110',
      email: 'mehmet.demir@hastane.com',
      sifre: 'Klinov2026!',
      telefon: '05559876543',
      departman: deptNames[1] || deptNames[0] || 'Dahiliye',
      unvan: 'Doktor',
    },
    {
      ad: 'Fatma', soyad: 'Kaya',
      tc: '12345678950',
      email: 'fatma.kaya@hastane.com',
      sifre: '', // şifre boş → davet linki gider
      telefon: '',
      departman: deptNames[2] || deptNames[0] || 'Yoğun Bakım',
      unvan: 'Başhemşire',
    },
    {
      ad: 'Ali', soyad: 'Çelik',
      tc: '', // TC opsiyonel — sadece direct (şifreli) modda zorunlu
      email: 'ali.celik@hastane.com',
      sifre: '',
      telefon: '05321112233',
      departman: '',
      unvan: '',
    },
  ]
  exampleRows.forEach(r => sheet.addRow(r))

  // Örnek satırları italik + gri (silinecekleri belli olsun)
  for (let r = 2; r <= exampleRows.length + 1; r++) {
    const row = sheet.getRow(r)
    row.font = { italic: true, color: { argb: 'FF64748B' } }
  }

  // Örneklerin altına ayırıcı (kullanıcı direkt buraya yazmaya başlasın)
  const separatorRow = sheet.getRow(exampleRows.length + 2)
  separatorRow.getCell(1).value = '↓ Örnek satırları silip kendi personelinizi buraya girin ↓'
  separatorRow.getCell(1).font = { bold: true, color: { argb: 'FF0D9668' }, size: 10 }
  sheet.mergeCells(`A${exampleRows.length + 2}:H${exampleRows.length + 2}`)
  separatorRow.alignment = { horizontal: 'center' }

  // Departman için dropdown doğrulaması — G sütunu (Şifre eklendiği için bir sağa kaydı)
  if (deptNames.length > 0) {
    const separatorIdx = exampleRows.length + 2
    for (let r = 2; r <= 500; r++) {
      if (r === separatorIdx) continue
      sheet.getCell(`G${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Departmanlar!$A$2:$A$${deptNames.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Geçersiz departman',
        error: 'Lütfen Departmanlar sayfasındaki listeden seçin',
      }
    }
  }

  // TC sütunu (C) — text formatı (öndeki 0 kaybolmasın diye)
  for (let r = 2; r <= 500; r++) {
    sheet.getCell(`C${r}`).numFmt = '@'
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
    'OPSİYONEL ALANLAR: TC Kimlik No, Şifre, Telefon, Departman, Unvan',
    '',
    'ŞİFRE NASIL ÇALIŞIR:',
    '  • Şifre alanı BOŞ bırakılırsa → sistem güvenli bir geçici şifre üretir.',
    '  • Şifre alanı DOLU yazılırsa → o şifre kullanılır (en az 8 karakter).',
    '  • Her iki durumda da hesap anında açılır + hoş geldin maili gönderilir.',
    '  • Personel ilk girişte şifresini değiştirmek ZORUNDADIR (mustChangePassword=true).',
    '',
    'YÜKLEME SONRASI PDF:',
    '  • Yükleme bitince ekranda tüm geçici şifrelerin listesi açılır.',
    '  • "Giriş Bilgileri PDF\'i İndir" butonu ile tek bir PDF indirebilirsiniz.',
    '  • PDF: Ad Soyad / TC / Geçici Şifre / Departman tablosu + KVKK uyarısı.',
    '  • Yazıcıdan basıp personele elden teslim edin.',
    '  • PDF\'e dahil olmak için TC Kimlik No SATIRDA DOLU olmalı (resmi denetim için).',
    '',
    'TC KİMLİK NO:',
    '  • 11 haneli, NVİ algoritmasıyla doğrulanır (sahte numaralar reddedilir).',
    '  • DB\'de AES-256-GCM ile şifrelenir, HMAC-SHA256 ile hash\'lenir (KVKK uyumlu).',
    '  • Aynı TC bu kurumda tekrar kullanılamaz; farklı kurumlarda olabilir.',
    '  • Boş bırakılabilir, ama PDF\'e dahil edilmek + sertifikalarda eşleşmek için doldurmanızı öneririz.',
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
    '  • İlk 2 örnekte şifre elle yazılmış, son 2\'sinde boş — boş olanlar için sistem üretir.',
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
}, { requireOrganization: true })
