/**
 * scripts/seed-devakent-ey-fr-03-draft.ts
 *
 * Devakent organizasyonu için EY.FR.03 LMS formunu **TASLAK** olarak ekler:
 *   - isActive = false  → admin ne zaman aktive etmek isterse karar verir
 *   - isArchived = false
 *   - isMandatory = false (taslak için varsayılan; aktivasyonda admin değiştirir)
 *
 * EY.FR.40 formuna dokunulmaz — mevcut eğitim ve mevcut yanıtların form bağı korunur.
 * Yeni yanıtlar EY.FR.40 ile gelmeye devam eder; admin EY.FR.03'ü taslaktan aktive
 * ettiğinde geçiş başlar.
 *
 * Mevcut yanıtların PDF'i, yanıt anındaki form snapshot'ını kullandığı için
 * (EY.FR.40 sorularını), bu adım eski PDF içeriğini bozmaz.
 *
 * Idempotent: zaten EY.FR.03 kodlu form varsa atlanır.
 *
 * Çalıştırma:
 *   pnpm tsx scripts/seed-devakent-ey-fr-03-draft.ts            # uygula
 *   pnpm tsx scripts/seed-devakent-ey-fr-03-draft.ts --dry-run  # yalnız raporla
 */

import { prisma } from '@/lib/prisma'
import { getFeedbackFormTemplate } from '@/lib/feedback-form-templates'

const ORG_NAME_PATTERN = 'devakent'
const TEMPLATE_KEY = 'ey-fr-03-lms'
const PUBLISHED_AT = new Date('2026-01-07')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const template = getFeedbackFormTemplate(TEMPLATE_KEY)
  if (!template) {
    console.error(`✗ Template "${TEMPLATE_KEY}" bulunamadı.`)
    process.exit(1)
  }

  const org = await prisma.organization.findFirst({
    where: { name: { contains: ORG_NAME_PATTERN, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!org) {
    console.error(`✗ Devakent organizasyonu bulunamadı (pattern: "${ORG_NAME_PATTERN}").`)
    process.exit(1)
  }

  console.log(`◐ Organizasyon: ${org.name} (${org.id})`)

  // Zaten EY.FR.03 var mı? — idempotent guard
  const existing = await prisma.trainingFeedbackForm.findFirst({
    where: { organizationId: org.id, documentCode: template.documentCode ?? 'EY.FR.03' },
    select: { id: true, title: true, isActive: true, isArchived: true },
  })
  if (existing) {
    console.log(
      `— EY.FR.03 formu zaten var: "${existing.title}" ` +
      `(active=${existing.isActive}, archived=${existing.isArchived}). Atlanıyor.`,
    )
    return
  }

  if (dryRun) {
    console.log(`◐ DRY RUN — şu form taslak olarak yaratılacak:`)
    console.log(`    title: ${template.defaultTitle}`)
    console.log(`    documentCode: ${template.documentCode}`)
    console.log(`    isActive: false  (TASLAK)`)
    console.log(`    publishedAt: ${PUBLISHED_AT.toISOString()}`)
    console.log(`    revisionNumber: 0,  revisionDate: null`)
    console.log(`    Kategoriler:`)
    template.categories.forEach(cat => {
      console.log(`      • ${cat.name} (${cat.items.length} soru)`)
    })
    return
  }

  await prisma.$transaction(async (tx) => {
    const form = await tx.trainingFeedbackForm.create({
      data: {
        organizationId: org.id,
        title: template.defaultTitle,
        description: template.defaultDescription,
        documentCode: template.documentCode,
        // TASLAK olarak kaydet — admin /admin/feedback-forms'tan aktive eder
        isActive: false,
        isMandatory: false,
        isArchived: false,
        publishedAt: PUBLISHED_AT,
        revisionNumber: 0,
        revisionDate: null,
      },
      select: { id: true },
    })

    if (template.categories.length > 0) {
      await Promise.all(
        template.categories.map(cat =>
          tx.trainingFeedbackCategory.create({
            data: {
              formId: form.id,
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

    console.log(`✓ EY.FR.03 taslak form oluşturuldu (id=${form.id})`)
  })
}

main()
  .catch(async (err) => {
    console.error('✗ Hata:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
