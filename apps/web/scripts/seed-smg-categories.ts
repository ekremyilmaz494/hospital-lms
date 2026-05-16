import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const STANDARD_CATEGORIES = [
  { code: 'KURUM_ICI_EGITIM', name: 'Kurum İçi Eğitim', sortOrder: 1, maxPointsPerActivity: null },
  { code: 'TTB_KREDILI_KONGRE', name: 'TTB Kredili Kongre/Sempozyum', sortOrder: 2, maxPointsPerActivity: 20 },
  { code: 'MESLEKI_DERNK_KURSU', name: 'Mesleki Dernek Kursu', sortOrder: 3, maxPointsPerActivity: 15 },
  { code: 'UNIVERSITE_SERTIFIKA', name: 'Üniversite Sertifika Programı', sortOrder: 4, maxPointsPerActivity: null },
  { code: 'ONLINE_EGITIM', name: 'Online/Uzaktan Eğitim', sortOrder: 5, maxPointsPerActivity: 10 },
  { code: 'YAYIN_MAKALE', name: 'Yayın/Makale', sortOrder: 6, maxPointsPerActivity: null },
  { code: 'SIMULASYON_EGITIMI', name: 'Simülasyon Eğitimi', sortOrder: 7, maxPointsPerActivity: null },
] as const

const ACTIVITY_TYPE_TO_CODE: Record<string, string> = {
  EXTERNAL_TRAINING: 'KURUM_ICI_EGITIM',
  CONFERENCE: 'TTB_KREDILI_KONGRE',
  PUBLICATION: 'YAYIN_MAKALE',
  COURSE_COMPLETION: 'ONLINE_EGITIM',
}

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })
  console.log(`→ ${orgs.length} organizasyon bulundu`)

  let catInserted = 0
  let catSkipped = 0
  let actUpdated = 0
  let targetInserted = 0
  let targetSkipped = 0

  for (const org of orgs) {
    console.log(`\n[${org.name}]`)

    // 1. Kategorileri upsert et
    for (const cat of STANDARD_CATEGORIES) {
      const existing = await prisma.smgCategory.findUnique({
        where: { organizationId_code: { organizationId: org.id, code: cat.code } },
        select: { id: true },
      })
      if (existing) {
        catSkipped++
      } else {
        await prisma.smgCategory.create({
          data: {
            organizationId: org.id,
            code: cat.code,
            name: cat.name,
            sortOrder: cat.sortOrder,
            maxPointsPerActivity: cat.maxPointsPerActivity,
          },
        })
        catInserted++
      }
    }

    // 2. Aktivitelerin categoryId'sini doldur
    const orgCategories = await prisma.smgCategory.findMany({
      where: { organizationId: org.id },
      select: { id: true, code: true },
    })
    const codeToId = new Map(orgCategories.map(c => [c.code, c.id]))

    const unmappedActivities = await prisma.smgActivity.findMany({
      where: { organizationId: org.id, categoryId: null },
      select: { id: true, activityType: true },
    })

    for (const act of unmappedActivities) {
      const code = ACTIVITY_TYPE_TO_CODE[act.activityType]
      const catId = code ? codeToId.get(code) : undefined
      if (catId) {
        await prisma.smgActivity.update({
          where: { id: act.id },
          data: { categoryId: catId },
        })
        actUpdated++
      }
    }

    // 3. Her dönem için varsayılan hedef
    const periods = await prisma.smgPeriod.findMany({
      where: { organizationId: org.id },
      select: { id: true, requiredPoints: true },
    })

    for (const p of periods) {
      const existing = await prisma.smgTarget.findFirst({
        where: { periodId: p.id, unvan: null, userId: null },
        select: { id: true },
      })
      if (existing) {
        targetSkipped++
      } else {
        await prisma.smgTarget.create({
          data: {
            organizationId: org.id,
            periodId: p.id,
            requiredPoints: p.requiredPoints,
          },
        })
        targetInserted++
      }
    }
  }

  console.log('\n=== ÖZET ===')
  console.log(`Kategori eklendi: ${catInserted}`)
  console.log(`Kategori atlandı (mevcut): ${catSkipped}`)
  console.log(`Aktivite categoryId güncellendi: ${actUpdated}`)
  console.log(`Varsayılan hedef eklendi: ${targetInserted}`)
  console.log(`Hedef atlandı (mevcut): ${targetSkipped}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
