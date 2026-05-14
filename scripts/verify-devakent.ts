import { prisma } from '@/lib/prisma'

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'devakent', mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!org) { console.log('Devakent yok.'); return }
  console.log(`\n◐ ${org.name}\n`)

  const trainings = await prisma.training.findMany({
    where: { organizationId: org.id },
    select: { id: true, title: true, instructorName: true, publishStatus: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log('TRAININGS:')
  trainings.forEach(t => console.log(`  • [${t.publishStatus}] ${t.title}  → eğitmen: ${t.instructorName ?? '(boş)'}`))

  const forms = await prisma.trainingFeedbackForm.findMany({
    where: { organizationId: org.id },
    select: { id: true, title: true, documentCode: true, isActive: true, isArchived: true, isMandatory: true, publishedAt: true,
             categories: { select: { name: true, _count: { select: { items: true } } }, orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })
  console.log('\nFEEDBACK FORMS:')
  forms.forEach(f => {
    const tags = [
      f.isActive ? 'AKTİF' : 'taslak',
      f.isArchived ? 'arşivli' : null,
      f.isMandatory ? 'zorunlu' : null,
    ].filter(Boolean).join(', ')
    console.log(`  • [${f.documentCode}] ${f.title}  (${tags})  publishedAt=${f.publishedAt?.toISOString().slice(0,10) ?? '—'}`)
    f.categories.forEach(c => console.log(`      - ${c.name} (${c._count.items} soru)`))
  })
}
main().finally(() => prisma.$disconnect())
