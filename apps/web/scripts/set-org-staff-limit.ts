/**
 * Bir organizasyonun personel (seat) limitini (Organization.maxStaff) ayarlar.
 *
 * İş bağlamı: her kurumla sözleşmeli bir personel sayısı olur (ör. Devakent = 150 kişi).
 * Bu limit dolunca yeni personel ekleme/davet 403 ile engellenir → müşteriden limit artışı
 * için yeni ücret talep edilir. Süper-admin bunu panelden (Organizasyon → Düzenle → Personel
 * Limiti) de değiştirebilir; bu script canlı DB'ye hızlı/toplu ayar veya ilk kurulum içindir.
 *
 * Değer semantiği:
 *   <pozitif tamsayı>  → sözleşmeli limit (ör. 150)
 *   'none' | 'null' | '0' → limiti KALDIR (null): plan limitine düş / sınırsız
 *
 * 🔒 GÜVENLİK: HEDEF veritabanı `DATABASE_URL` ORTAM DEĞİŞKENİNDEN okunur — asla koda gömülmez.
 *   Prod'a uygularken prod DATABASE_URL'i KENDİ shell'inde ver (sohbete/koda yazma):
 *     DATABASE_URL='postgres://...' npx tsx scripts/set-org-staff-limit.ts devakent 150
 *   DATABASE_URL zaten ortamda varsa dotenv onu EZMEZ. Yoksa ENV_FILE (varsayılan .env.local — LOKAL!)
 *   yüklenir; bu durumda hedef host yazdırılır, yanlış DB'ye yazmayı önlemek için kontrol et.
 *
 * Çalıştırma (apps/web içinden):
 *   npx tsx scripts/set-org-staff-limit.ts <orgCode> <limit> [--by-name] [--dry-run]
 *     <orgCode>  Organization.code (ör. 'devakent'); --by-name ile isim (contains, duyarsız)
 *     <limit>    Pozitif tamsayı VEYA 'none'/'null'/'0' (limiti kaldır)
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

/** '150' → 150; 'none'/'null'/'0'/'' → null; geçersiz → fail. */
function parseLimit(raw: string): number | null {
  const v = raw.trim().toLowerCase()
  if (v === 'none' || v === 'null' || v === '0' || v === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1) {
    fail(`Geçersiz limit: '${raw}'. Pozitif tamsayı (ör. 150) VEYA 'none' (limiti kaldır) bekleniyor.`)
  }
  return n
}

async function main() {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const byName = argv.includes('--by-name')
  const [target, limitArg] = argv.filter(a => !a.startsWith('--'))

  if (!target || limitArg === undefined) {
    fail("Kullanım: npx tsx scripts/set-org-staff-limit.ts <orgCode> <limit> [--by-name] [--dry-run]\n" +
      "  ör (kod):  npx tsx scripts/set-org-staff-limit.ts devakent 150\n" +
      "  ör (kaldır): npx tsx scripts/set-org-staff-limit.ts devakent none\n" +
      "  ör (isim): npx tsx scripts/set-org-staff-limit.ts Devakent 150 --by-name --dry-run\n" +
      "  --by-name: <target>'ı Organization.code yerine name (contains, büyük/küçük duyarsız) ile eşleştirir")
  }

  const newLimit = parseLimit(limitArg)

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) fail('DATABASE_URL yok. Prod için shell\'de ver (koda yazma) ya da ENV_FILE ayarla.')

  // Hedefi doğrulaman için yalnızca host göster (kullanıcı adı/parola GÖSTERİLMEZ).
  let host = '(bilinmiyor)'
  try { host = new URL(DATABASE_URL).host } catch { /* parse edilemedi */ }
  console.log(`→ Hedef DB host: ${host}${dryRun ? '  [DRY RUN]' : ''}`)
  console.log(`→ ${byName ? 'İsim' : 'Kod'}: ${target} · Yeni limit: ${newLimit === null ? 'KALDIR (sınırsız/plan)' : newLimit}`)

  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  try {
    const org = byName
      ? await prisma.organization.findFirst({
          where: { name: { contains: target, mode: 'insensitive' } },
          select: { id: true, name: true, code: true, maxStaff: true },
        })
      : await prisma.organization.findUnique({
          where: { code: target },
          select: { id: true, name: true, code: true, maxStaff: true },
        })
    if (!org) fail(`Organizasyon bulunamadı (${byName ? `isim~"${target}"` : `kod="${target}"`}) — bu veritabanında.`)

    // Mevcut kullanım (aktif personel + bekleyen davet) — limitle karşılaştırıp uyar.
    const now = new Date()
    const [activeStaff, pendingInvites] = await Promise.all([
      prisma.user.count({ where: { organizationId: org.id, role: 'staff', isActive: true } }),
      prisma.invitation.count({ where: { organizationId: org.id, role: 'staff', acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
    ])
    const used = activeStaff + pendingInvites

    console.log(`  Eşleşen: ${org.name} (kod=${org.code}) · mevcut limit: ${org.maxStaff ?? '(yok)'}`)
    console.log(`  Şu anki kullanım: ${used} koltuk (aktif personel ${activeStaff} + bekleyen davet ${pendingInvites})`)
    if (newLimit !== null && used > newLimit) {
      console.log(`  ⚠ UYARI: yeni limit (${newLimit}) mevcut kullanımın (${used}) ALTINDA. Mevcut personel silinmez, ` +
        `ama YENİ ekleme/davet engellenir. Sadece limiti düşürmek istediğinden emin ol.`)
    }

    if (org.maxStaff === newLimit) {
      console.log(`✓ Zaten ayarlı (${newLimit ?? 'yok'}) — değişiklik yok.`)
      return
    }

    if (dryRun) {
      console.log(`⚠ DRY RUN — DB DEĞİŞMEDİ. Uygulanacak: ${org.maxStaff ?? '(yok)'}  →  ${newLimit ?? 'KALDIR'}`)
      console.log('  Uygulamak için --dry-run bayrağını kaldır.')
      return
    }

    await prisma.organization.update({ where: { id: org.id }, data: { maxStaff: newLimit } })
    console.log(`✓ Güncellendi: ${org.name}`)
    console.log(`  Personel limiti: ${org.maxStaff ?? '(yok)'}  →  ${newLimit ?? 'KALDIR (sınırsız/plan)'}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
