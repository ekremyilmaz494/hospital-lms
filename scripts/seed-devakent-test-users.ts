/**
 * Devakent Hastanesi için 50 test kullanıcısı oluşturur.
 *
 * Amaç: modal pagination, atama akışı, query performansı vb. benchmark testleri
 * için yeterli sayıda personel.
 *
 * Yöntem: `createAuthUser` factory ile Auth + DB senkron oluşturma.
 * SQL insert YASAK (memory: 102 kullanıcı bozulması dersi).
 *
 * Kullanım:
 *   pnpm tsx scripts/seed-devakent-test-users.ts --confirm
 *
 * Cleanup:
 *   pnpm tsx scripts/cleanup-devakent-test-users.ts --confirm
 *
 * Üretilen kullanıcılar:
 * - role=staff, isActive=true, departman=Dahiliye
 * - email: test-{tcHashShort}@devakent.invalid (sentetik, .invalid TLD KVKK güvenli)
 * - password: Test1234!
 * - TC: NVI algoritması ile valid 11-haneli, "9" ile başlar
 */
import 'dotenv/config'
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local', override: true })

const DEVAKENT_ORG_ID = '0da8142b-9244-4c8b-86b9-4fc1e8df62eb'
const DEPT_NAME = 'Dahiliye'
const TARGET_COUNT = 50
// Test kullanıcı parolası — sadece bu seed scripti için. Dev/staging-only.
const PASSWORD = 'Test1234!' // secret-scanner-disable-line
const EMAIL_DOMAIN = 'devakent.invalid'

// Production guard — yanlışlıkla canlı ortamda çalışmasın.
if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  console.error('❌ Production ortamında çalıştırılamaz.')
  process.exit(1)
}

if (!process.argv.includes('--confirm')) {
  console.error('❌ --confirm flag gerekli.')
  console.error('   Örnek: pnpm tsx scripts/seed-devakent-test-users.ts --confirm')
  process.exit(1)
}

// ── Türkçe isim havuzu ────────────────────────────────────────────
const FIRST_NAMES = [
  'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'İbrahim', 'Hasan', 'Osman',
  'Yusuf', 'Murat', 'Emre', 'Burak', 'Onur', 'Serkan', 'Cem',
  'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Merve', 'Esra',
  'Selin', 'Büşra', 'Pınar', 'Gizem', 'Sevgi', 'Yasemin', 'Aslı',
]

const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk',
  'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin',
  'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Aksoy',
  'Bulut', 'Erdoğan', 'Acar', 'Güneş', 'Tunç', 'Bozkurt', 'Yalçın',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── TC üretici (NVİ algoritması) ──────────────────────────────────
/**
 * Geçerli 11-haneli TC üretir. İlk hane 9 (test serisi).
 *
 * Algoritma (`src/lib/tc.ts:34-41` formülünün tersi):
 *   d10 = ((d1+d3+d5+d7+d9)*7 - (d2+d4+d6+d8)) mod 10
 *   d11 = sum(d1..d10) mod 10
 */
function generateTestTc(): string {
  const d: number[] = [9] // d1 sabit 9, test serisi
  for (let i = 1; i < 9; i++) {
    d.push(Math.floor(Math.random() * 10))
  }
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8]
  const evenSum = d[1] + d[3] + d[5] + d[7]
  const d10 = ((oddSum * 7) - evenSum + 1000) % 10 // +1000 negatife karşı
  d.push(d10)
  const d11 = d.reduce((a, b) => a + b, 0) % 10
  d.push(d11)
  return d.join('')
}

function generateUniqueTcs(count: number, validate: (tc: string) => boolean): string[] {
  const set = new Set<string>()
  let safety = 0
  while (set.size < count) {
    if (++safety > count * 10) throw new Error('TC üretici döngüde sıkıştı')
    const tc = generateTestTc()
    if (!validate(tc)) continue // self-validate (defansif)
    set.add(tc)
  }
  return Array.from(set)
}

// ── Ana akış ──────────────────────────────────────────────────────
async function main() {
  // Dynamic import — dotenv yüklendikten sonra prisma init olsun
  const { prisma } = await import('../src/lib/prisma')
  const { createAuthUser, AuthUserError, DbUserError } = await import('../src/lib/auth-user-factory')
  const { isValidTcKimlik } = await import('../src/lib/tc')
  const { hashTcKimlik } = await import('../src/lib/tc-crypto')

  console.log('▸ Devakent Hastanesi test kullanıcı seed scripti başlatılıyor…\n')

  // 1) Org doğrula
  const org = await prisma.organization.findUnique({
    where: { id: DEVAKENT_ORG_ID },
    select: { id: true, name: true },
  })
  if (!org) {
    console.error(`❌ Organizasyon bulunamadı: ${DEVAKENT_ORG_ID}`)
    process.exit(1)
  }
  console.log(`✓ Organizasyon: ${org.name}`)

  // 2) Departman doğrula (yoksa oluştur)
  let dept = await prisma.department.findFirst({
    where: { organizationId: DEVAKENT_ORG_ID, name: DEPT_NAME },
    select: { id: true, name: true },
  })
  if (!dept) {
    console.log(`▸ Departman bulunamadı, oluşturuluyor: ${DEPT_NAME}`)
    dept = await prisma.department.create({
      data: { organizationId: DEVAKENT_ORG_ID, name: DEPT_NAME, isActive: true },
      select: { id: true, name: true },
    })
  }
  console.log(`✓ Departman: ${dept.name} (${dept.id})\n`)

  // 3) Mevcut test kullanıcı sayısı
  const existing = await prisma.user.count({
    where: { organizationId: DEVAKENT_ORG_ID, email: { endsWith: `@${EMAIL_DOMAIN}` } },
  })
  if (existing > 0) {
    console.log(`⚠ Zaten ${existing} sentetik test kullanıcısı var (${EMAIL_DOMAIN}).`)
    console.log(`  Önce cleanup-devakent-test-users.ts ile temizleyebilirsin.\n`)
  }

  // 4) 50 unique valid TC üret
  const tcs = generateUniqueTcs(TARGET_COUNT, isValidTcKimlik)
  console.log(`✓ ${tcs.length} adet valid test TC üretildi\n`)

  // 5) Sequential olarak Auth+DB üzerinden oluştur
  let success = 0
  let failed = 0
  const failures: Array<{ tc: string; reason: string }> = []

  for (let i = 0; i < tcs.length; i++) {
    const tc = tcs[i]
    const tcShort = hashTcKimlik(tc).slice(0, 12)
    const firstName = pick(FIRST_NAMES)
    const lastName = pick(LAST_NAMES)
    const email = `test-${tcShort}@${EMAIL_DOMAIN}`

    try {
      await createAuthUser({
        email,
        password: PASSWORD,
        firstName,
        lastName,
        role: 'staff',
        organizationId: DEVAKENT_ORG_ID,
        departmentId: dept.id,
        isActive: true,
        emailConfirm: true,
        tcKimlik: tc,
      })
      success++
      const num = String(i + 1).padStart(2, '0')
      console.log(`  [${num}/${TARGET_COUNT}] ✓ ${firstName} ${lastName} (${email})`)
    } catch (err) {
      failed++
      const reason = err instanceof AuthUserError || err instanceof DbUserError
        ? err.safeMessage
        : (err as Error).message
      failures.push({ tc, reason })
      const num = String(i + 1).padStart(2, '0')
      console.log(`  [${num}/${TARGET_COUNT}] ✗ ${firstName} ${lastName} — ${reason}`)
    }
  }

  // 6) Özet
  console.log(`\n═══════════════════════════════════════`)
  console.log(`✓ Başarılı: ${success}/${TARGET_COUNT}`)
  if (failed > 0) {
    console.log(`✗ Başarısız: ${failed}`)
    failures.forEach(f => console.log(`  - TC ${f.tc.slice(0, 5)}***** : ${f.reason}`))
  }
  console.log(`═══════════════════════════════════════`)
  console.log(`\nLogin için kullanılabilecek parola: ${PASSWORD}`)
  console.log(`Email pattern: test-XXX@${EMAIL_DOMAIN}\n`)
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
