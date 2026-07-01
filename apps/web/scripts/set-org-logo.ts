/**
 * Bir organizasyonun logosunu (Organization.logoUrl) ayarlar — panel sol üstünde ve tüm resmi
 * PDF'lerde (Katılım/Duyuru/Geri Bildirim formları, transkript, raporlar...) görünmesi için.
 *
 * Idempotent: aynı değer zaten yazılıysa dokunmaz. Kurum ADMİN'i normalde logosunu
 * Ayarlar→Marka sekmesinden yükler; bu script, seed dışı bir org'a (ör. canlı Devakent) hızlı
 * logo tanımlamak veya bir public/ asset'ini bağlamak içindir.
 *
 * 🔒 GÜVENLİK: HEDEF veritabanı `DATABASE_URL` ORTAM DEĞİŞKENİNDEN okunur — asla koda gömülmez.
 *   Prod'a uygularken prod DATABASE_URL'i KENDİ shell'inde ver (sohbete/koda yazma):
 *     DATABASE_URL='postgres://...' npx tsx scripts/set-org-logo.ts devakent '/logos/devakent.png'
 *   DATABASE_URL zaten ortamda varsa dotenv onu EZMEZ. Yoksa ENV_FILE (varsayılan .env.local — LOKAL!)
 *   yüklenir; bu durumda hedef host yazdırılır, yanlış DB'ye yazmayı önlemek için kontrol et.
 *
 * Çalıştırma (apps/web içinden):
 *   npx tsx scripts/set-org-logo.ts <orgCode> <logoPathOrUrl>
 *     <orgCode>        Organization.code (ör. 'devakent' | 'deneme-org')
 *     <logoPathOrUrl>  '/logos/devakent.png' (public asset) VEYA 'https://.../logo.png'
 */
import { config } from 'dotenv'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// DATABASE_URL ortamda zaten varsa dotenv onu EZMEZ (prod shell > .env.local).
config({ path: process.env.ENV_FILE || '.env.local' })

function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

async function main() {
  // Bayrakları ayır; kalan pozisyonel argümanlar: <target> <logo>
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const byName = argv.includes('--by-name')
  const [target, logo] = argv.filter(a => !a.startsWith('--'))

  if (!target || !logo) {
    fail("Kullanım: npx tsx scripts/set-org-logo.ts <orgCode> <logoPathOrUrl> [--by-name] [--dry-run]\n" +
      "  ör (kod):  npx tsx scripts/set-org-logo.ts devakent '/logos/devakent.png'\n" +
      "  ör (isim): npx tsx scripts/set-org-logo.ts devakent '/logos/devakent.png' --by-name --dry-run\n" +
      "  --by-name: <target>'ı Organization.code yerine name (contains, büyük/küçük duyarsız) ile eşleştirir")
  }
  const isLocalPath = logo.startsWith('/')
  const isRemote = /^https?:\/\//.test(logo)
  if (!isLocalPath && !isRemote) {
    fail(`Geçersiz logo: '${logo}'. '/' ile başlayan public yolu (ör. /logos/devakent.png) VEYA http(s) URL bekleniyor.`)
  }

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) fail('DATABASE_URL yok. Prod için shell\'de ver (koda yazma) ya da ENV_FILE ayarla.')

  // Hedefi doğrulaman için yalnızca host göster (kullanıcı adı/parola GÖSTERİLMEZ).
  let host = '(bilinmiyor)'
  try { host = new URL(DATABASE_URL).host } catch { /* parse edilemedi */ }
  console.log(`→ Hedef DB host: ${host}${dryRun ? '  [DRY RUN]' : ''}`)
  console.log(`→ ${byName ? 'İsim' : 'Kod'}: ${target} · Logo: ${logo}`)

  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  try {
    const org = byName
      ? await prisma.organization.findFirst({
          where: { name: { contains: target, mode: 'insensitive' } },
          select: { id: true, name: true, code: true, logoUrl: true },
        })
      : await prisma.organization.findUnique({
          where: { code: target },
          select: { id: true, name: true, code: true, logoUrl: true },
        })
    if (!org) fail(`Organizasyon bulunamadı (${byName ? `isim~"${target}"` : `kod="${target}"`}) — bu veritabanında.`)

    console.log(`  Eşleşen: ${org.name} (kod=${org.code}) · mevcut logoUrl: ${org.logoUrl ?? '(boş)'}`)

    if (org.logoUrl === logo) {
      console.log(`✓ Zaten ayarlı — değişiklik yok.`)
      return
    }

    if (dryRun) {
      console.log(`⚠ DRY RUN — DB DEĞİŞMEDİ. Uygulanacak: ${org.logoUrl ?? '(boş)'}  →  ${logo}`)
      console.log('  Uygulamak için --dry-run bayrağını kaldır.')
      return
    }

    await prisma.organization.update({ where: { id: org.id }, data: { logoUrl: logo } })
    console.log(`✓ Güncellendi: ${org.name}`)
    console.log(`  ${org.logoUrl ?? '(boş)'}  →  ${logo}`)
    console.log('  Not: panel branding cache\'i (Redis 10 dk + sessionStorage 5 dk) nedeniyle logo hemen görünmeyebilir.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
