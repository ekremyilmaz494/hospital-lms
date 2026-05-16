/**
 * Sample feedback PDF üreticisi — kullanıcı layout'u onaylasın diye masaüstüne yazar.
 *
 * Standalone: DB'ye dokunmaz, plain `drawFeedbackPage()` fonksiyonunu sahte verilerle
 * çağırır. Türkçe font + logolar gerçek dosyalardan yüklenir (yoksa placeholder).
 *
 * Çalıştır:  npx tsx scripts/generate-sample-feedback-pdf.ts
 * Çıktı:    ~/Desktop/geri-bildirim-ornek.pdf
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { jsPDF } from 'jspdf'
import { applyTurkishFont } from '../src/lib/pdf/helpers/font'
import { drawFeedbackPage, type FeedbackDrawData } from '../src/lib/pdf/feedback-design'

async function readLogoAsDataUrl(relativePath: string): Promise<string | null> {
  try {
    const full = path.join(process.cwd(), 'public', relativePath)
    const buf = await fs.readFile(full)
    const ext = path.extname(full).slice(1).toLowerCase() || 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

async function main() {
  console.log('→ Sample feedback PDF üretiliyor...')

  // Logoları yükle (yoksa placeholder otomatik çizilir)
  const [hospitalLogo, ministryLogo] = await Promise.all([
    readLogoAsDataUrl('logos/devakent.png'),
    readLogoAsDataUrl('logos/saglik-bakanligi.png'),
  ])
  console.log(`   • Hastane logosu: ${hospitalLogo ? '✓ yüklendi' : '⚠ bulunamadı (placeholder kullanılacak)'}`)
  console.log(`   • Bakanlık logosu: ${ministryLogo ? '✓ yüklendi' : '⚠ bulunamadı (placeholder kullanılacak)'}`)

  // Sahte response verisi — gerçek yanıt formatıyla aynı
  const sampleData: FeedbackDrawData = {
    formTitle: 'EĞİTİM DEĞERLENDİRME ANKET FORMU',
    documentCode: 'EY.FR.03',
    publishedDate: '07.01.2026',
    revisionDate: '00',
    revisionNumber: '00',
    pageNo: '1/1',

    trainingTitle: 'Radyasyon Güvenliği ve Radyasyondan Korunma',
    trainingDate: '14.05.2026',
    instructorName: 'Şehri Yılmaz',
    // Anonim yanıt: katılımcı satırı boş kalır (kullanıcının kararı).
    participantName: '',

    categories: [
      {
        name: 'Sistem & Kullanılabilirlik',
        items: [
          { text: 'Sisteme giriş işlemleri kolaydı', score: 5, questionType: 'likert_5' },
          { text: 'Programın kullanımı anlaşılırdı', score: 4, questionType: 'likert_5' },
          { text: 'Eğitim platformu kullanıcı dostuydu', score: 5, questionType: 'likert_5' },
          { text: 'Mobil cihaz / bilgisayar uyumluluğu yeterliydi', score: 3, questionType: 'likert_5' },
        ],
      },
      {
        name: 'Teknik Kalite',
        items: [
          { text: 'Eğitim sırasında teknik sorun yaşamadım', score: 4, questionType: 'likert_5' },
          { text: 'Ses ve görüntü kalitesi yeterliydi', score: 5, questionType: 'likert_5' },
        ],
      },
      {
        name: 'Genel Değerlendirme',
        items: [
          { text: 'Sanal eğitim sistemi zaman açısından kolaylık sağladı', score: 5, questionType: 'likert_5' },
          { text: 'Gelecekte bu yöntemle eğitim almaya devam etmek isterim', score: 4, questionType: 'likert_5' },
        ],
      },
    ],

    isPassed: true,
    overallScore: (5 + 4 + 5 + 3 + 4 + 5 + 5 + 4) / 8,
    submittedDate: '14.05.2026',

    organizationLogoDataUrl: hospitalLogo,
    ministryLogoDataUrl: ministryLogo,
  }

  // PDF üret
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)
  drawFeedbackPage(doc, sampleData)

  // Buffer'ı masaüstüne yaz
  const buffer = Buffer.from(doc.output('arraybuffer'))
  const desktop = path.join(os.homedir(), 'Desktop')
  const outputPath = path.join(desktop, 'geri-bildirim-ornek.pdf')
  await fs.writeFile(outputPath, buffer)

  console.log(`\n✓ Sample PDF üretildi: ${outputPath}`)
  console.log(`   Boyut: ${(buffer.length / 1024).toFixed(1)} KB`)
  console.log(`   Sayfa: A4 portrait, 1 sayfa`)
}

main().catch((err) => {
  console.error('✗ Sample PDF üretimi başarısız:', err)
  process.exit(1)
})
