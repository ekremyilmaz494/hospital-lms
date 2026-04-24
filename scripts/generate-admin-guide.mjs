#!/usr/bin/env node
/**
 * Hastane Admin Paneli rehberi PDF üretici.
 * Her bölüm için: ne yapar + hangi faydayı sağlar.
 *
 * Çalıştır: node scripts/generate-admin-guide.mjs
 * Çıktı:   hospital-admin-rehberi.pdf (proje kökü)
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const FONT_DIR = resolve(process.cwd(), 'public', 'fonts')
const OUT_FILE = resolve(process.cwd(), 'hospital-admin-rehberi.pdf')

// ── Design tokens ──────────────────────────────────────────
const PRIMARY    = [13, 150, 104]
const PRIMARY_DK = [6, 95, 70]
const ACCENT     = [245, 158, 11]
const SURFACE    = [248, 250, 252]
const BORDER     = [226, 232, 240]
const TEXT_MUT   = [100, 116, 139]
const TEXT_MAIN  = [15, 23, 42]
const SUCCESS_BG = [220, 252, 231]
const INFO_BG    = [239, 246, 255]
const INFO_FG    = [37, 99, 235]
const WARN_BG    = [254, 243, 199]
const WARN_FG    = [180, 120, 0]
const WHITE      = [255, 255, 255]

// ── Bölümler ───────────────────────────────────────────────
const SECTIONS = [
  {
    id: 1, title: 'Dashboard (Gösterge Paneli)', path: '/admin/dashboard', icon: '⬢',
    gorev: 'Hastanenin güncel eğitim durumunu tek ekranda özetler: toplam personel, aktif eğitim, tamamlama oranı, canlı sınav takibi ve risk merkezi.',
    fayda: 'Yönetici gün başında hangi alana öncelik vermesi gerektiğini 10 saniyede kavrar. Kritik uyarıları (baraj altı, süresi dolan belge) kaçırma riskini ortadan kaldırır.',
  },
  {
    id: 2, title: 'Eğitimler', path: '/admin/trainings', icon: '◉',
    gorev: 'Eğitim oluşturma sihirbazı (video/PDF/SCORM yükle, soru ekle, baraj puanı belirle), kategori yönetimi, personele atama ve içerik güncelleme.',
    fayda: 'Hastanenin eğitim sürecini merkezi tek yerden yönetir. Denetim sırasında "hangi eğitim hangi personele ne zaman atandı" sorusuna tek tıkla cevap verir.',
  },
  {
    id: 3, title: 'Sınavlar (Standalone Exam)', path: '/admin/exams', icon: '▤',
    gorev: 'Eğitimden bağımsız denetim sınavları oluşturur, soru bankasından rastgele soru seçimi yapar, sonuçları ve istatistikleri görüntüler.',
    fayda: 'İç denetim, pilot test ve yeni işe başlayan değerlendirmelerinde hızlı sınav yayınlamayı mümkün kılar. Soru havuzu tekrar kullanılabilir.',
  },
  {
    id: 4, title: 'İçerik Kütüphanesi', path: '/admin/content-library', icon: '◫',
    gorev: 'Platform hazır içeriklerini (JCI/ISO/SKS uyumlu) keşfedip kuruma ekler; hastanenin kendi video/PDF/ses dosyalarını yükler ve yönetir.',
    fayda: 'Sıfırdan içerik hazırlama ihtiyacını ortadan kaldırır — "El Hijyeni", "Yangın Güvenliği" gibi zorunlu eğitimler tek tıkla hazır. Hastane sadece güncelleme yapar.',
  },
  {
    id: 5, title: 'AI İçerik Stüdyosu (Beta)', path: '/admin/ai-content-studio', icon: '✦',
    gorev: 'Yüklediğiniz belgeden yapay zekâ ile otomatik eğitim videosu, soru seti ve özet üretir. NotebookLM + metin-ses sentezi entegrasyonu.',
    fayda: 'PDF prosedürü → içerik üretim süresini saatlerden dakikalara düşürür. Standart güncellendiğinde içerik de hızlıca güncellenebilir.',
  },
  {
    id: 6, title: 'Personel', path: '/admin/staff', icon: '◎',
    gorev: 'Personel kaydı ekle/düzenle, departman ve ünvan ata, toplu CSV/Excel import, HİS (Hastane Bilgi Sistemi) entegrasyonu ile senkron.',
    fayda: 'İnsan kaynakları verisini tek merkezde tutar. Eğitim ataması yapılırken departmana göre toplu işlem yapılabilir — 100 kişilik listeye 1 dakikada eğitim atanır.',
  },
  {
    id: 7, title: 'Sertifikalar', path: '/admin/certificates', icon: '★',
    gorev: 'Eğitim sonunda otomatik üretilen kurumsal sertifikaları görüntüler, PDF olarak toplu indirir, yenileme takibi yapar.',
    fayda: 'Denetçinin "göster" dediği her sertifikayı 5 saniyede sunabilir. Süresi yaklaşan belgeler için otomatik uyarı — uyumsuzluk cezası önlenir.',
  },
  {
    id: 8, title: 'Uyum Raporu', path: '/admin/compliance', icon: '⊙',
    gorev: 'Zorunlu eğitimlerin personel bazında tamamlanma durumunu takip eder, uyum oranını kategoriye/departmana göre analiz eder.',
    fayda: 'JCI/ISO denetimleri için hazır uyum belgesi. "Enfeksiyon kontrolü eğitimini tamamlamayan kim?" sorusunun cevabı Excel raporunda.',
  },
  {
    id: 9, title: 'Yetkinlik Matrisi', path: '/admin/competency-matrix', icon: '▦',
    gorev: 'Personel × eğitim kesişim matrisini görsel tabloda sunar: kim hangi eğitimi tamamladı, kim eksik, başarı puanı ne.',
    fayda: 'Vardiya planlamasında kritik: "radyasyon güvenliği sertifikalı 3 hemşire hangileri?" sorusu anında cevaplanır. Yetkinlik boşlukları görülür.',
  },
  {
    id: 10, title: 'Etkinlik Analizi', path: '/admin/effectiveness', icon: '▲',
    gorev: 'Eğitimlerin öğrenme kazancını ölçer: ön sınav vs. son sınav farkı, deneme sayısı dağılımı, konu bazlı başarı oranı.',
    fayda: 'Hangi eğitim etkili, hangisi zaman kaybı — veriyle belli olur. İyileştirme yapılacak içerik tespit edilir; eğitim bütçesi doğru yere aktarılır.',
  },
  {
    id: 11, title: 'Geri Bildirim Formları', path: '/admin/feedback-forms', icon: '✎',
    gorev: 'Eğitim sonunda personelin dolduracağı değerlendirme formları tasarlar (Likert/açık uçlu), yanıtları toplar, istatistikleri gösterir.',
    fayda: 'Eğitmen kalitesi ve içerik netliği hakkında gerçek kullanıcı geri bildirimi. Akreditasyonda "eğitim değerlendirme sistemi var" kanıtı.',
  },
  {
    id: 12, title: 'SMG Takibi', path: '/admin/smg', icon: '☆',
    gorev: 'Sağlıkta Meslek Gözlemi puanlarını personel başına kaydeder, eğitim tamamlama ile SMG puanını ilişkilendirir.',
    fayda: 'Bakanlık SMG zorunluluğunu dijital ortamda karşılar — puan hesaplaması manuel Excel\'de yapmak yerine otomatiktir, hata payı sıfıra iner.',
  },
  {
    id: 13, title: 'Raporlar', path: '/admin/reports', icon: '◰',
    gorev: 'Eğitim, personel, uyum, sertifika ve finansal raporları çeşitli formatlarda (PDF/Excel/CSV) indirmeyi sağlar.',
    fayda: 'Üst yönetime sunulacak aylık/yıllık raporlar tek tıkla hazır. Denetim öncesi hazırlık süresi günden saate iner.',
  },
  {
    id: 14, title: 'Bildirimler', path: '/admin/notifications', icon: '◈',
    gorev: 'Personele uygulama içi/e-posta/SMS bildirim gönderir (toplu veya hedefli), bildirim şablonları yönetir.',
    fayda: 'Yeni eğitim duyurusu, son gün hatırlatması veya acil duyuru 2 tıkla 500 personele ulaşır. Manuel e-posta listesi tutma derdi biter.',
  },
  {
    id: 15, title: 'İşlem Geçmişi (Audit Log)', path: '/admin/audit-logs', icon: '◵',
    gorev: 'Sistemdeki tüm kullanıcı aktivitelerini (login, eğitim oluşturma, silme, atama) tarih/kullanıcı/IP bilgisiyle kaydeder ve arar.',
    fayda: 'KVKK denetiminde "kim neye ne zaman erişti" sorusuna kanıtlanabilir yanıt. Sistem kötüye kullanımını tespit eder, forensic inceleme sağlar.',
  },
  {
    id: 16, title: 'Akreditasyon', path: '/admin/accreditation', icon: '✓',
    gorev: 'JCI, ISO 9001, TJC, OSHA gibi akreditasyon standartlarına özel kontrol listeleri; standart-spesifik raporlar üretir.',
    fayda: 'Akreditasyon denetimi için hazırlık süresi ay yerine gün. Her standart için ayrı format — denetçiye uygun belge hazır.',
  },
  {
    id: 17, title: 'Ayarlar', path: '/admin/settings', icon: '⚙',
    gorev: 'Hastane logosu, renk teması, e-posta gönderen adresi, bildirim tercihleri, KVKK metinleri ve kullanıcı izinlerini yönetir.',
    fayda: 'Kurumsal kimliği (logo, renk) PDF\'lere, sertifikalara, e-postalara otomatik yansıtır. Her hastane kendi markasıyla LMS kullanır.',
  },
]

// ── PDF üretimi ────────────────────────────────────────────
async function loadFontBase64(name) {
  const buf = await readFile(resolve(FONT_DIR, name))
  return buf.toString('base64')
}

async function main() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const reg = await loadFontBase64('LiberationSans-Regular.ttf')
  const bold = await loadFontBase64('LiberationSans-Bold.ttf')
  doc.addFileToVFS('LiberationSans-Regular.ttf', reg)
  doc.addFont('LiberationSans-Regular.ttf', 'Liberation', 'normal')
  doc.addFileToVFS('LiberationSans-Bold.ttf', bold)
  doc.addFont('LiberationSans-Bold.ttf', 'Liberation', 'bold')
  doc.setFont('Liberation', 'normal')

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ═══════ KAPAK ═══════
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(10, 122, 85)
  doc.triangle(0, H - 90, W, H - 40, W, H, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.triangle(0, H - 50, W * 0.6, H, 0, H, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(0, H / 2 - 1, 30, 2, 'F')

  // Logo
  doc.setFillColor(...WHITE)
  doc.circle(W / 2, H / 2 - 40, 15, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.circle(W / 2, H / 2 - 40, 12, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(22)
  doc.text('H', W / 2, H / 2 - 35, { align: 'center' })

  // Title block
  doc.setTextColor(...WHITE)
  doc.setFont('Liberation', 'normal')
  doc.setFontSize(10)
  doc.text('HOSPITAL LMS', W / 2, H / 2 - 12, { align: 'center' })

  doc.setFont('Liberation', 'bold')
  doc.setFontSize(28)
  doc.text('Yönetici Paneli', W / 2, H / 2 + 4, { align: 'center' })
  doc.setFontSize(28)
  doc.text('Kullanım Rehberi', W / 2, H / 2 + 16, { align: 'center' })

  // Subtitle
  doc.setFont('Liberation', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(200, 240, 220)
  doc.text('Hastane admin panelindeki her bölümün görev ve faydaları', W / 2, H / 2 + 30, { align: 'center' })

  // Bottom meta
  doc.setFillColor(...ACCENT)
  doc.roundedRect(W / 2 - 30, H - 45, 60, 10, 5, 5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(9)
  doc.text(`${SECTIONS.length} BÖLÜM REHBERİ`, W / 2, H - 39, { align: 'center' })

  doc.setFont('Liberation', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 240, 220)
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(today, W / 2, H - 20, { align: 'center' })

  // ═══════ İÇİNDEKİLER ═══════
  doc.addPage()
  drawPageHeader(doc, W, 'İÇİNDEKİLER')

  let y = 52
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...TEXT_MAIN)
  doc.text('Bu rehberin içeriği', 15, y)
  y += 4

  doc.setFont('Liberation', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUT)
  doc.text('Her bölüm için "ne yapar" ve "hangi faydayı sağlar" ayrı ayrı açıklanmıştır.', 15, y + 4)

  y += 14

  const half = Math.ceil(SECTIONS.length / 2)
  SECTIONS.forEach((sec, i) => {
    const colX = i < half ? 15 : W / 2 + 5
    const rowY = y + (i % half) * 11
    // Badge
    doc.setFillColor(...INFO_BG)
    doc.roundedRect(colX, rowY - 4, 9, 7, 1.5, 1.5, 'F')
    doc.setFont('Liberation', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...INFO_FG)
    doc.text(String(sec.id).padStart(2, '0'), colX + 4.5, rowY + 0.5, { align: 'center' })
    // Title
    doc.setFont('Liberation', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MAIN)
    doc.text(sec.title, colX + 12, rowY + 0.5)
    // Path
    doc.setFont('Liberation', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text(sec.path, colX + 12, rowY + 4.5)
  })

  drawPageFooter(doc, W, H)

  // ═══════ BÖLÜM SAYFALARI ═══════
  // 2 bölüm / sayfa (daha akıcı okuma)
  for (let i = 0; i < SECTIONS.length; i += 2) {
    doc.addPage()
    drawPageHeader(doc, W, `BÖLÜM ${i + 1}${SECTIONS[i + 1] ? ` – ${i + 2}` : ''}`)

    drawSectionCard(doc, W, 52, SECTIONS[i])
    if (SECTIONS[i + 1]) {
      drawSectionCard(doc, W, 52 + 118, SECTIONS[i + 1])
    }

    drawPageFooter(doc, W, H)
  }

  // ═══════ KAPANIŞ ═══════
  doc.addPage()
  drawPageHeader(doc, W, 'SONUÇ')

  let cy = 58
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...PRIMARY_DK)
  doc.text('Hepsi tek platformda.', 15, cy)
  cy += 10

  doc.setFont('Liberation', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_MAIN)
  const closingLines = [
    'Hospital LMS yönetici paneli, hastanenizin personel eğitim, denetim ve',
    'uyum süreçlerinin tamamını tek bir dijital platformda topluyor.',
    '',
    'Her bölüm belirli bir iş akışını hedefler; birbirinden bağımsız çalışır',
    'ama veriler ortak havuzdan beslenir. Bu sayede:',
  ]
  closingLines.forEach((line, i) => {
    doc.text(line, 15, cy + i * 6)
  })
  cy += closingLines.length * 6 + 4

  const benefits = [
    { t: 'Denetim süresi günlerden dakikalara düşer',      c: SUCCESS_BG, fg: PRIMARY },
    { t: 'Manuel Excel takibi ve hata payı sıfıra iner',    c: SUCCESS_BG, fg: PRIMARY },
    { t: 'KVKK ve akreditasyon uyumu otomatik sağlanır',    c: SUCCESS_BG, fg: PRIMARY },
    { t: 'Personel eğitim kayıtları tek yerde, kayıp yok',   c: SUCCESS_BG, fg: PRIMARY },
    { t: 'Raporlar tek tıkla, PDF/Excel formatında hazır',   c: SUCCESS_BG, fg: PRIMARY },
  ]
  benefits.forEach((b, i) => {
    const by = cy + i * 11
    doc.setFillColor(...b.c)
    doc.roundedRect(15, by, W - 30, 8, 2, 2, 'F')
    doc.setFont('Liberation', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...b.fg)
    doc.text('✓', 20, by + 5.5)
    doc.setFont('Liberation', 'normal')
    doc.setTextColor(...TEXT_MAIN)
    doc.text(b.t, 27, by + 5.5)
  })
  cy += benefits.length * 11 + 15

  // Quote block
  doc.setFillColor(...SURFACE)
  doc.roundedRect(15, cy, W - 30, 30, 3, 3, 'F')
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(1.5)
  doc.line(15, cy, 15, cy + 30)
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_MAIN)
  doc.text('Neden Hospital LMS?', 22, cy + 9)
  doc.setFont('Liberation', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUT)
  const whyLines = [
    'KVKK uyumlu, Türkiye bulut altyapısı, çok kiracılı (multi-tenant) mimarisi ile',
    'her hastane kendi verisini izole tutar. 100+ personel için optimize edilmiştir.',
    'SMG, SKS, JCI ve ISO 9001 standartlarıyla uyumludur.',
  ]
  whyLines.forEach((line, i) => doc.text(line, 22, cy + 15 + i * 4.5))

  drawPageFooter(doc, W, H)

  // ═══════ SAYFA NUMARALARI ═══════
  const pageCount = doc.getNumberOfPages()
  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('Liberation', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text(`Sayfa ${p - 1} / ${pageCount - 1}`, W - 15, H - 7, { align: 'right' })
  }

  const buffer = Buffer.from(doc.output('arraybuffer'))
  await writeFile(OUT_FILE, buffer)
  console.log(`✓ PDF oluşturuldu: ${OUT_FILE}`)
  console.log(`  Boyut: ${(buffer.length / 1024).toFixed(1)} KB`)
  console.log(`  Sayfa: ${pageCount}`)
}

function drawPageHeader(doc, W, label) {
  // Top band
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 28, 'F')
  doc.setFillColor(10, 122, 85)
  doc.triangle(W - 40, 0, W, 0, W, 20, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.rect(0, 26, W, 1, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(0, 27, W, 1, 'F')

  // Logo mini
  doc.setFillColor(...WHITE)
  doc.circle(15, 14, 6, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.circle(15, 14, 4.5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(8)
  doc.text('H', 15, 16, { align: 'center' })

  // Header labels
  doc.setTextColor(200, 240, 220)
  doc.setFont('Liberation', 'normal')
  doc.setFontSize(7)
  doc.text('HOSPITAL LMS – YÖNETİCİ REHBERİ', 25, 11)

  doc.setTextColor(...WHITE)
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(12)
  doc.text(label, 25, 18.5)
}

function drawPageFooter(doc, W, H) {
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(15, H - 12, W - 15, H - 12)
  doc.setFont('Liberation', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_MUT)
  doc.text('Hospital LMS – Yönetici Paneli Rehberi', 15, H - 7)
}

function drawSectionCard(doc, W, y, section) {
  const cardH = 110
  // Card outline
  doc.setFillColor(...WHITE)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(15, y, W - 30, cardH, 3, 3, 'FD')

  // Left accent bar
  doc.setFillColor(...PRIMARY)
  doc.rect(15, y, 2.5, cardH, 'F')

  // Badge with number
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(22, y + 8, 14, 10, 2, 2, 'F')
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text(String(section.id).padStart(2, '0'), 29, y + 14.5, { align: 'center' })

  // Icon symbol
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...PRIMARY)
  doc.text(section.icon, 42, y + 15.5)

  // Title
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...TEXT_MAIN)
  doc.text(section.title, 50, y + 14)

  // Path badge
  doc.setFillColor(...SURFACE)
  doc.roundedRect(50, y + 18, doc.getTextWidth(section.path) + 6, 5.5, 1.5, 1.5, 'F')
  doc.setFont('Liberation', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...TEXT_MUT)
  doc.text(section.path, 53, y + 21.7)

  // Separator
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(22, y + 29, W - 22, y + 29)

  // GÖREV block
  doc.setFillColor(...INFO_BG)
  doc.roundedRect(22, y + 34, 22, 6, 1.5, 1.5, 'F')
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...INFO_FG)
  doc.text('GÖREV', 33, y + 38, { align: 'center' })

  doc.setFont('Liberation', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...TEXT_MAIN)
  const gorevLines = doc.splitTextToSize(section.gorev, W - 52)
  doc.text(gorevLines, 22, y + 46)

  const gorevBottom = y + 46 + gorevLines.length * 4.5

  // FAYDA block
  const faydaTop = Math.max(gorevBottom + 5, y + 68)
  doc.setFillColor(...SUCCESS_BG)
  doc.roundedRect(22, faydaTop, 22, 6, 1.5, 1.5, 'F')
  doc.setFont('Liberation', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...PRIMARY)
  doc.text('FAYDASI', 33, faydaTop + 4, { align: 'center' })

  doc.setFont('Liberation', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...TEXT_MAIN)
  const faydaLines = doc.splitTextToSize(section.fayda, W - 52)
  doc.text(faydaLines, 22, faydaTop + 12)
}

main().catch((err) => {
  console.error('PDF oluşturulamadı:', err)
  process.exit(1)
})
