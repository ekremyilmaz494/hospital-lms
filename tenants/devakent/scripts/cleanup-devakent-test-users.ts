/**
 * Devakent Hastanesi sentetik test kullanıcılarını siler.
 *
 * `seed-devakent-test-users.ts` ile oluşturulan @devakent.invalid e-postalı
 * kullanıcıları hem Supabase Auth'dan hem Postgres'ten kaldırır.
 *
 * Kullanım:
 *   pnpm tsx scripts/cleanup-devakent-test-users.ts --confirm
 */
import 'dotenv/config'
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local', override: true })

const DEVAKENT_ORG_ID = '0da8142b-9244-4c8b-86b9-4fc1e8df62eb'
const EMAIL_DOMAIN = 'devakent.invalid'

if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  console.error('❌ Production ortamında çalıştırılamaz.')
  process.exit(1)
}

if (!process.argv.includes('--confirm')) {
  console.error('❌ --confirm flag gerekli.')
  console.error('   Örnek: pnpm tsx scripts/cleanup-devakent-test-users.ts --confirm')
  process.exit(1)
}

async function main() {
  // Dynamic import — dotenv yüklendikten sonra prisma init olsun
  const { prisma } = await import('../src/lib/prisma')
  const { createServiceClient } = await import('../src/lib/supabase/server')

  console.log(`▸ Cleanup: Devakent Hastanesi @${EMAIL_DOMAIN} kullanıcıları siliniyor…\n`)

  const users = await prisma.user.findMany({
    where: {
      organizationId: DEVAKENT_ORG_ID,
      email: { endsWith: `@${EMAIL_DOMAIN}` },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  if (users.length === 0) {
    console.log('✓ Silinecek test kullanıcısı bulunamadı.')
    return
  }

  console.log(`▸ ${users.length} test kullanıcısı bulundu, siliniyor…\n`)

  const supabase = await createServiceClient()
  let success = 0
  let failed = 0

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    const num = String(i + 1).padStart(2, '0')
    try {
      // Önce DB'den sil (FK cascade ile assignments, attempts vb. düşer)
      await prisma.user.delete({ where: { id: u.id } })
      // Sonra auth user'ı sil
      const { error } = await supabase.auth.admin.deleteUser(u.id)
      if (error) {
        // DB silindi ama auth orphan kaldıysa log'la — manuel temizlik gerekebilir
        console.log(`  [${num}/${users.length}] ⚠ DB silindi, auth orphan: ${u.email} — ${error.message}`)
        failed++
        continue
      }
      success++
      console.log(`  [${num}/${users.length}] ✓ ${u.firstName} ${u.lastName} (${u.email})`)
    } catch (err) {
      failed++
      console.log(`  [${num}/${users.length}] ✗ ${u.email} — ${(err as Error).message}`)
    }
  }

  console.log(`\n═══════════════════════════════════════`)
  console.log(`✓ Silinen: ${success}/${users.length}`)
  if (failed > 0) console.log(`✗ Başarısız/orphan: ${failed}`)
  console.log(`═══════════════════════════════════════\n`)
}

main()
  .catch((err) => {
    console.error('❌ Fatal hata:', err)
    process.exit(1)
  })
  .finally(async () => {
    const { prisma } = await import('../src/lib/prisma')
    await prisma.$disconnect()
  })
