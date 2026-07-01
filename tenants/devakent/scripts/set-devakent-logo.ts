/**
 * scripts/set-devakent-logo.ts
 *
 * Tek seferlik: Devakent organizasyonunun logosunu ayarlar (Organization.logoUrl) →
 * panelde sol üstte ve tüm resmi PDF'lerde (katılım, duyuru, geri bildirim, sicil,
 * transkript, sertifika...) Devakent logosu görünür.
 *
 * Logo değeri paket asset yolu: `/logos/devakent.png` (public/logos/devakent.png repoda var).
 * resolveOrgLogoDataUrl bu yolu diskten okur → S3 yüklemesi gerekmez.
 *
 * Idempotent: logoUrl zaten bu değere ayarlıysa dokunmaz.
 *
 * 🔒 GÜVENLİK: HEDEF veritabanı `DATABASE_URL` ORTAMDAN okunur (@/lib/prisma singleton'ı).
 *   Prod'a uygularken prod env'ini yükleyip çalıştır; parolayı koda/sohbete YAZMA.
 *
 * Çalıştırma (tenants/devakent içinden, prod env yüklüyken):
 *   pnpm tsx scripts/set-devakent-logo.ts            # uygula
 *   pnpm tsx scripts/set-devakent-logo.ts --dry-run  # yalnız raporla
 */

import { prisma } from '@/lib/prisma'

const ORG_NAME_PATTERN = 'devakent'
const LOGO_URL = '/logos/devakent.png'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const org = await prisma.organization.findFirst({
    where: { name: { contains: ORG_NAME_PATTERN, mode: 'insensitive' } },
    select: { id: true, name: true, logoUrl: true },
  })

  if (!org) {
    console.error(`✗ Devakent organizasyonu bulunamadı (pattern: "${ORG_NAME_PATTERN}").`)
    process.exit(1)
  }

  console.log(`◐ Organizasyon: ${org.name} (${org.id})`)
  console.log(`  Mevcut logoUrl: ${org.logoUrl ?? '(boş)'}`)

  if (org.logoUrl === LOGO_URL) {
    console.log(`✓ Zaten "${LOGO_URL}" — değişiklik yok.`)
    return
  }

  if (dryRun) {
    console.log(`\n⚠ DRY RUN — DB değişmedi. Uygulanacak: logoUrl = "${LOGO_URL}"`)
    return
  }

  await prisma.organization.update({ where: { id: org.id }, data: { logoUrl: LOGO_URL } })
  console.log(`\n✓ logoUrl = "${LOGO_URL}" yazıldı.`)
  console.log('  Not: branding cache (Redis 10 dk + tarayıcı sessionStorage 5 dk) nedeniyle')
  console.log('  panelde hemen görünmeyebilir — /clear-cache veya birkaç dakika bekle.')
}

main()
  .catch(async (err) => {
    console.error('✗ Hata:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
