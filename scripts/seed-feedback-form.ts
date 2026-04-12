/**
 * EY.FR.40 Eğitim Değerlendirme Anket Formu — varsayılan form seed'i.
 *
 * Mevcut tüm organizasyonlar için (feedbackForm'u olmayanlara) EY.FR.40
 * belgesinden çıkarılan kategori + soru yapısını oluşturur.
 *
 * Çalıştırma: `npx tsx scripts/seed-feedback-form.ts`
 * Idempotent: tekrar çalıştırmak güvenli — zaten formu olan org atlanır.
 */

import { prisma } from '../src/lib/prisma'

type QuestionType = 'likert_5' | 'yes_partial_no' | 'text'

interface SeedItem {
  text: string
  questionType: QuestionType
  isRequired?: boolean
}

interface SeedCategory {
  name: string
  items: SeedItem[]
}

const DEFAULT_FORM: SeedCategory[] = [
  {
    name: 'EĞİTİM PROGRAMI',
    items: [
      { text: 'Programda ele alınan konuların işimle ilgisi', questionType: 'likert_5' },
      { text: 'Görsel ve işitsel araçlar', questionType: 'likert_5' },
      { text: 'Eğitim notları', questionType: 'likert_5' },
      { text: 'Eğitim süresi', questionType: 'likert_5' },
      { text: 'Eğitimin içeriği', questionType: 'likert_5' },
    ],
  },
  {
    name: 'ORGANİZASYON',
    items: [
      { text: 'Eğitim duyurusu zamanlaması', questionType: 'likert_5' },
      { text: 'Eğitim salonunun dizaynı', questionType: 'likert_5' },
      { text: 'Eğitim salonunun havalandırması', questionType: 'likert_5' },
      { text: 'Eğitim salonunun ışıklandırması', questionType: 'likert_5' },
      { text: 'Eğitim salonunun ses düzeni', questionType: 'likert_5' },
      { text: 'Eğitim süresince sağlanan yiyecek ve içecek', questionType: 'likert_5', isRequired: false },
    ],
  },
  {
    name: 'EĞİTMEN',
    items: [
      { text: 'Eğitmenin, verilen program ile ilgili ön hazırlığı', questionType: 'likert_5' },
      { text: 'Verdiği eğitim konusundaki bilgi ve tecrübesi', questionType: 'likert_5' },
      { text: 'Anlatımı', questionType: 'likert_5' },
      { text: 'Programın teorik ve uygulaması arasında kurduğu denge ve uygulamaya açıklık getirici örnekleri', questionType: 'likert_5' },
      { text: 'İletişim konusundaki başarısı', questionType: 'likert_5' },
    ],
  },
  {
    name: 'GENEL DEĞERLENDİRME',
    items: [
      { text: 'Bu eğitimi diğer çalışanlara da öneririm', questionType: 'yes_partial_no' },
    ],
  },
]

async function seedForOrganization(organizationId: string): Promise<'created' | 'skipped'> {
  const existing = await prisma.trainingFeedbackForm.findUnique({
    where: { organizationId },
    select: { id: true },
  })

  if (existing) return 'skipped'

  await prisma.trainingFeedbackForm.create({
    data: {
      organizationId,
      title: 'Eğitim Değerlendirme Anket Formu',
      documentCode: 'EY.FR.40',
      isActive: true,
      categories: {
        create: DEFAULT_FORM.map((category, categoryIdx) => ({
          name: category.name,
          order: categoryIdx,
          items: {
            create: category.items.map((item, itemIdx) => ({
              text: item.text,
              questionType: item.questionType,
              isRequired: item.isRequired ?? true,
              order: itemIdx,
            })),
          },
        })),
      },
    },
  })

  return 'created'
}

async function main() {
  console.log('🌱 EY.FR.40 varsayılan geri bildirim formu seed ediliyor...')

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })

  if (orgs.length === 0) {
    console.log('⚠️  Hiç organizasyon bulunamadı.')
    return
  }

  let created = 0
  let skipped = 0
  for (const org of orgs) {
    const result = await seedForOrganization(org.id)
    if (result === 'created') {
      console.log(`✓ ${org.name}: form oluşturuldu`)
      created++
    } else {
      console.log(`— ${org.name}: formu zaten var, atlandı`)
      skipped++
    }
  }

  console.log(`\n✅ Tamamlandı. ${created} oluşturuldu, ${skipped} atlandı.`)
}

main()
  .catch((err) => {
    console.error('❌ Seed hatası:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
