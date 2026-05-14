/**
 * scripts/set-devakent-instructor.ts
 *
 * Tek seferlik backfill: Devakent organizasyonundaki eğitimlerin instructorName
 * alanını "Şehri Yılmaz" olarak doldurur.
 *
 * Neden gerekli: `Training.instructorName` kolonu yeni eklendi (PDF raporları için).
 * Yeni eğitimler wizard'da bu alanı dolduruyor, ama Devakent'te mevcut eğitim(ler)
 * şema migration anında NULL kaldı. PDF'te eğitmen satırı "—" görünmesin diye
 * backfill.
 *
 * Idempotent: tekrar çalıştırılırsa zaten dolu olanlara dokunmaz.
 *
 * Çalıştırma:
 *   pnpm tsx scripts/set-devakent-instructor.ts            # uygula
 *   pnpm tsx scripts/set-devakent-instructor.ts --dry-run  # yalnız raporla
 */

import { prisma } from '@/lib/prisma'

const ORG_NAME_PATTERN = 'devakent'
const INSTRUCTOR_NAME = 'Şehri Yılmaz'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  // Devakent org'unu bul — name case-insensitive contains (subdomain'e bakmak
  // gerekmez, "devakent" isim eşleşmesi bu tenant için yeterince spesifik)
  const org = await prisma.organization.findFirst({
    where: { name: { contains: ORG_NAME_PATTERN, mode: 'insensitive' } },
    select: { id: true, name: true },
  })

  if (!org) {
    console.error(`✗ Devakent organizasyonu bulunamadı (pattern: "${ORG_NAME_PATTERN}").`)
    process.exit(1)
  }

  console.log(`◐ Organizasyon: ${org.name} (${org.id})`)

  // Boş veya null instructorName'i olan tüm eğitimleri raporla
  const trainings = await prisma.training.findMany({
    where: {
      organizationId: org.id,
      OR: [{ instructorName: null }, { instructorName: '' }],
    },
    select: { id: true, title: true, instructorName: true, publishStatus: true },
  })

  if (trainings.length === 0) {
    console.log('  Hiç güncellenecek eğitim yok — tüm eğitimlerde instructorName dolu.')
    return
  }

  console.log(`  ${trainings.length} eğitim güncellenecek:`)
  trainings.forEach(t =>
    console.log(`    • [${t.publishStatus}] "${t.title}"  (id=${t.id})`),
  )

  if (dryRun) {
    console.log('\n⚠ DRY RUN — DB değişmedi. Uygulamak için --dry-run kaldır.')
    return
  }

  const result = await prisma.training.updateMany({
    where: {
      organizationId: org.id,
      OR: [{ instructorName: null }, { instructorName: '' }],
    },
    data: { instructorName: INSTRUCTOR_NAME },
  })

  console.log(`\n✓ ${result.count} eğitime instructorName = "${INSTRUCTOR_NAME}" yazıldı.`)
}

main()
  .catch(async (err) => {
    console.error('✗ Hata:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
