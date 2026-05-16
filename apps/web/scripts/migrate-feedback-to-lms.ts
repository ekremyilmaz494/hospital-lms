/**
 * scripts/migrate-feedback-to-lms.ts
 *
 * Tüm organizasyonlarda feedback formlarını EY.FR.40'tan EY.FR.03 (LMS)'ye geçirir.
 *
 * Her org için:
 *   1) Aktif EY.FR.40 formlarını arşivle (isActive=false, isArchived=true)
 *      - Eski yanıtlar TrainingFeedbackResponse.formSnapshot sayesinde korunur
 *   2) Template'ten yeni EY.FR.03 LMS formu yarat (kategoriler + items dahil)
 *   3) Yeni formu aktif + mandatory olarak işaretle
 *
 * Kullanım:
 *   pnpm tsx scripts/migrate-feedback-to-lms.ts            # uygula
 *   pnpm tsx scripts/migrate-feedback-to-lms.ts --dry-run  # yalnız raporla
 */

import { prisma } from '@/lib/prisma'
import { getFeedbackFormTemplate } from '@/lib/feedback-form-templates'

const TEMPLATE_KEY = 'ey-fr-03-lms'
const OLD_DOCUMENT_CODE = 'EY.FR.40'
const PUBLISHED_AT = new Date('2026-01-07')

type RunStats = {
  orgsProcessed: number
  formsArchived: number
  formsCreated: number
  errors: number
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const template = getFeedbackFormTemplate(TEMPLATE_KEY)

  if (!template) {
    console.error(`✗ Template '${TEMPLATE_KEY}' bulunamadı. Çıkılıyor.`)
    process.exit(1)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Feedback Form Migration: EY.FR.40 → EY.FR.03 (LMS)')
  console.log(`  Mode: ${dryRun ? 'DRY RUN (DB değişmeyecek)' : 'APPLY (DB yazılacak)'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  console.log(`\n${organizations.length} organizasyon bulundu.\n`)

  const stats: RunStats = {
    orgsProcessed: 0,
    formsArchived: 0,
    formsCreated: 0,
    errors: 0,
  }

  for (const org of organizations) {
    try {
      // Mevcut durumu özetle
      const [activeNonArchivedCount, oldActiveForms] = await Promise.all([
        prisma.trainingFeedbackForm.count({
          where: { organizationId: org.id, isArchived: false },
        }),
        prisma.trainingFeedbackForm.findMany({
          where: {
            organizationId: org.id,
            documentCode: OLD_DOCUMENT_CODE,
            isArchived: false,
          },
          select: { id: true, title: true },
        }),
      ])

      if (dryRun) {
        console.log(`◐ Org: ${org.name} (${org.id})`)
        console.log(`    • Aktif/non-archived form sayısı: ${activeNonArchivedCount}`)
        console.log(`    • Arşivlenecek EY.FR.40 form: ${oldActiveForms.length}`)
        oldActiveForms.forEach(f => console.log(`        - ${f.title} (${f.id})`))
        console.log(`    • Oluşturulacak yeni EY.FR.03 form: 1`)
        stats.orgsProcessed += 1
        stats.formsArchived += oldActiveForms.length
        stats.formsCreated += 1
        continue
      }

      // Gerçek migrasyon — tek transaction
      await prisma.$transaction(async (tx) => {
        // (a) Eski EY.FR.40 formlarını arşivle
        if (oldActiveForms.length > 0) {
          const result = await tx.trainingFeedbackForm.updateMany({
            where: {
              organizationId: org.id,
              documentCode: OLD_DOCUMENT_CODE,
              isArchived: false,
            },
            data: {
              isActive: false,
              isArchived: true,
            },
          })
          stats.formsArchived += result.count
        }

        // (b) Yeni EY.FR.03 LMS formu oluştur (aktif + mandatory)
        const created = await tx.trainingFeedbackForm.create({
          data: {
            organizationId: org.id,
            title: template.defaultTitle,
            description: template.defaultDescription,
            documentCode: template.documentCode,
            isActive: true,
            isMandatory: true,
            isArchived: false,
            publishedAt: PUBLISHED_AT,
            revisionNumber: 0,
            revisionDate: null,
          },
          select: { id: true },
        })

        // (c) Kategoriler + items — Promise.all ile paralel (perf-check kuralı)
        if (template.categories.length > 0) {
          await Promise.all(
            template.categories.map(cat =>
              tx.trainingFeedbackCategory.create({
                data: {
                  formId: created.id,
                  name: cat.name,
                  order: cat.order,
                  items: {
                    create: cat.items.map(i => ({
                      text: i.text,
                      questionType: i.questionType,
                      isRequired: i.isRequired,
                      order: i.order,
                    })),
                  },
                },
              }),
            ),
          )
        }

        stats.formsCreated += 1
      })

      stats.orgsProcessed += 1
      console.log(
        `✓ Org: ${org.name} — ${oldActiveForms.length} form arşivlendi, 1 yeni form aktif edildi`,
      )
    } catch (err) {
      stats.errors += 1
      console.error(`✗ Org: ${org.name} (${org.id}) — hata:`, err instanceof Error ? err.message : err)
      // Döngüye devam — diğer orgları etkileme
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Sonuç:')
  console.log(`   • İşlenen org: ${stats.orgsProcessed}`)
  console.log(`   • Arşivlenen eski form: ${stats.formsArchived}`)
  console.log(`   • Yeni form oluşturulan: ${stats.formsCreated}`)
  console.log(`   • Hata: ${stats.errors}`)
  if (dryRun) {
    console.log("\n⚠ DRY RUN — DB'ye hiçbir şey yazılmadı. Uygulamak için --dry-run'ı kaldırın.")
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  process.exit(stats.errors > 0 ? 1 : 0)
}

main()
  .catch(async (err) => {
    console.error('✗ Fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
