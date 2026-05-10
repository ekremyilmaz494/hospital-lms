import { prisma } from '../src/lib/prisma'

/**
 * Tüm organizasyonları + ilgili veriyi temizler. Sadece test ortamı için.
 *
 * Yaklaşım: PostgreSQL'in session_replication_role=replica trick'i ile
 * FK kontrolleri tek session boyunca devre dışı bırakılır → her tabloyu sırasız
 * silebiliriz, schema'daki tutarsız cascade FK'larıyla uğraşmayız.
 *
 * Korunanlar:
 *   - users (organization_id IS NULL olanlar = super_admin'ler)
 *   - subscription_plans (global config)
 *   - _prisma_migrations (migration history)
 */
async function main() {
  const dryRun = !process.argv.includes('--execute')

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, _count: { select: { users: true, trainings: true } } },
    orderBy: { name: 'asc' },
  })

  console.log(`\nDB'de ${orgs.length} organizasyon var:\n`)
  for (const o of orgs) {
    console.log(`  - ${o.name.padEnd(40)} users=${o._count.users.toString().padStart(4)}  trainings=${o._count.trainings.toString().padStart(4)}  (${o.id})`)
  }

  const [superAdmins, totalUsers] = await Promise.all([
    prisma.user.count({ where: { organizationId: null } }),
    prisma.user.count(),
  ])
  console.log(`\nToplam user: ${totalUsers}`)
  console.log(`Org'a bağlı olmayan user (silinmez): ${superAdmins}`)

  if (dryRun) {
    console.log('\n[DRY RUN] Hiçbir şey silinmedi. Silmek için: --execute')
    await prisma.$disconnect()
    return
  }

  console.log('\n🔥 SİLİNİYOR (FK kontrolleri devre dışı)…')

  // İstisnalar — silmemek istediğimiz tablolar.
  const KEEP_TABLES = new Set(['_prisma_migrations', 'subscription_plans', 'users'])

  await prisma.$transaction(async (tx) => {
    // FK + trigger kontrollerini bu session için kapat (Postgres replica mode trick).
    await tx.$executeRawUnsafe(`SET session_replication_role = 'replica'`)

    // Public schema'daki tüm BASE TABLE'ları al
    const tables = await tx.$queryRawUnsafe<{ table_name: string }[]>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    for (const { table_name } of tables) {
      if (KEEP_TABLES.has(table_name)) continue
      try {
        const result = await tx.$executeRawUnsafe(`DELETE FROM "${table_name}"`)
        if (result > 0) console.log(`  ${table_name.padEnd(40)} silindi: ${result}`)
      } catch (err) {
        console.warn(`  ${table_name} ATLANDI:`, err instanceof Error ? err.message : err)
      }
    }

    // users tablosunda organization_id NOT NULL olanları sil — super_admin korunsun
    const userDel = await tx.$executeRawUnsafe(`DELETE FROM "users" WHERE organization_id IS NOT NULL`)
    console.log(`  users (org'a bağlı) silindi: ${userDel}`)

    // FK kontrollerini geri aç
    await tx.$executeRawUnsafe(`SET session_replication_role = 'origin'`)
  }, { timeout: 120_000 })

  const [orgAfter, userAfter, trainingAfter] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.training.count(),
  ])
  console.log(`\n✅ Bitti. Kalan organization=${orgAfter}, user=${userAfter} (super_admin), training=${trainingAfter}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
