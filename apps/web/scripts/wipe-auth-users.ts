import { prisma } from '../src/lib/prisma'
import { assertNotProduction } from './_guard'

async function main() {
  assertNotProduction('wipe-auth-users')
  console.log('[1/5] Script başladı, prisma client yüklendi')

  const dryRun = !process.argv.includes('--execute')

  console.log('[2/5] public.users okunuyor…')
  const keepers = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
  })
  console.log(`[2/5] public.users'ta ${keepers.length} kayıt:`)
  for (const u of keepers) console.log(`        - ${u.email}  (${u.role})`)

  console.log('[3/5] auth.users sayılıyor…')
  const authCountRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*)::bigint AS count FROM auth.users`,
  )
  const authCount = Number(authCountRows[0]?.count ?? BigInt(0))
  console.log(`[3/5] auth.users toplam: ${authCount}`)

  console.log('[4/5] orphan auth.users sayılıyor…')
  const orphanRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*)::bigint AS count FROM auth.users a
     WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.email = a.email)`,
  )
  const orphanCount = Number(orphanRows[0]?.count ?? BigInt(0))
  console.log(`[4/5] silinecek (public karşılığı olmayan): ${orphanCount}`)

  if (dryRun) {
    console.log('\n[DRY RUN] Silmek için: --execute')
    await prisma.$disconnect()
    return
  }

  console.log('[5/5] 🔥 SİLİNİYOR…')
  const result = await prisma.$executeRawUnsafe(`
    DELETE FROM auth.users
    WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.email = auth.users.email)
  `)
  console.log(`[5/5] Silindi: ${result}`)

  const remainingRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*)::bigint AS count FROM auth.users`,
  )
  console.log(`\n✅ Bitti. auth.users'ta kalan: ${Number(remainingRows[0]?.count ?? BigInt(0))}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('HATA:', e); process.exit(1) })
