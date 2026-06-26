/**
 * Audit log hash zincirini YENİDEN TABANA AL (re-baseline) — tek seferlik onarım.
 *
 * NEDEN: Zincir başından beri ATOMİK OLMAYAN bir okuma-yazma ile kuruluyordu
 * (`createAuditLog` eski hali: "son hash'i oku → satırı yaz", transaction/kilit yok)
 * ve sıralamada `id` tie-breaker'ı yoktu. Canlı, çok kullanıcılı ortamda eşzamanlı /
 * aynı-milisaniyedeki audit yazımları zinciri ÇATALLADI/yeniden sıraladı → "Zinciri
 * Doğrula" haklı olarak "zincir bozuldu" raporluyordu. Bu KASITLI bir veri kurcalaması
 * DEĞİL, yazılım hatasıdır — dolayısıyla zinciri bir kez doğru biçimde yeniden taban
 * almak KVKK/JCI açısından meşrudur.
 *
 * NE YAPAR: Her organizasyon (ve platform-geneli `organization_id IS NULL`) için
 * kayıtları doğrulamayla AYNI deterministik sırada okur — `[createdAt asc, id asc]` —
 * ve `prevHash`/`hash`'i `computeAuditHash` ile baştan, sırayla yeniden hesaplayıp
 * yazar. `createdAt`'e DOKUNMAZ (denetim zaman damgaları gerçek kalır). Hash'siz eski
 * kayıtlar da artık hash kazanır → zincirdeki boşluklar kapanır.
 *
 * GÜVENLİK: İdempotenttir — zaten doğruysa hiçbir satırı değiştirmez (no-op). Org
 * bazında advisory kilit alır (createAuditLog ile AYNI anahtar) → çalışırken gelen
 * canlı audit yazımlarıyla yarışmaz.
 *
 * KULLANIM (apps/web cwd):
 *   pnpm tsx scripts/rechain-audit-logs.ts            # KURU ÇALIŞMA (rapor; hiçbir şey yazmaz)
 *   pnpm tsx scripts/rechain-audit-logs.ts --execute  # gerçek güncelleme
 * veya repo kökünden:
 *   pnpm rechain:audit -- --execute
 *
 * SIRA: Önce A1 (createAuditLog atomik) + A2 (verify) deploy edilmeli; SONRA bu script
 * prod'da BİR KEZ çalıştırılır. Sonrası: "Zinciri Doğrula" yeşil.
 */
import { prisma } from '@/lib/prisma'
import { computeAuditHash } from '@/lib/api-helpers'

const EXECUTE = process.argv.includes('--execute')

interface Row {
  id: string
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  hash: string | null
  prevHash: string | null
  createdAt: Date
}

/** Bir org'un (veya null org'un) zincirini yeniden hesaplar; değişen satır sayısını döner. */
async function rechainOrg(organizationId: string | null): Promise<{ total: number; changed: number }> {
  const lockKey = `audit:${organizationId ?? 'global'}`
  const label = organizationId ?? '(platform-geneli / null)'

  const rows = (await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      userId: true,
      hash: true,
      prevHash: true,
      createdAt: true,
    },
  })) as Row[]

  // Beklenen prevHash/hash'i sırayla hesapla; sapan satırları topla.
  let previousHash: string | null = null
  const updates: { id: string; hash: string; prevHash: string | null }[] = []
  for (const row of rows) {
    const expectedPrev = previousHash
    const expectedHash = computeAuditHash({
      prevHash: expectedPrev,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
    })
    if (row.hash !== expectedHash || row.prevHash !== expectedPrev) {
      updates.push({ id: row.id, hash: expectedHash, prevHash: expectedPrev })
    }
    previousHash = expectedHash
  }

  if (updates.length === 0) {
    console.log(`  ✓ ${label}: ${rows.length} kayıt — zincir zaten sağlam (değişiklik yok)`)
    return { total: rows.length, changed: 0 }
  }

  if (!EXECUTE) {
    console.log(`  ~ ${label}: ${rows.length} kayıt — ${updates.length} satır DÜZELTİLECEK (kuru çalışma)`)
    return { total: rows.length, changed: updates.length }
  }

  // Gerçek güncelleme — advisory kilit altında, tek transaction'da.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
    for (const u of updates) {
      await tx.auditLog.update({
        where: { id: u.id },
        data: { hash: u.hash, prevHash: u.prevHash },
      })
    }
  })
  console.log(`  ✔ ${label}: ${rows.length} kayıt — ${updates.length} satır güncellendi`)
  return { total: rows.length, changed: updates.length }
}

async function main() {
  console.log('')
  console.log('🔗 Audit Log Zinciri — Yeniden Tabana Alma')
  console.log(`   Mod: ${EXECUTE ? '⚠️  EXECUTE (gerçek güncelleme)' : '🔍 DRY-RUN (yalnız rapor)'}`)
  console.log('')

  // audit_logs içinde geçen tüm organizationId değerleri (null dahil).
  const distinct = await prisma.auditLog.findMany({
    distinct: ['organizationId'],
    select: { organizationId: true },
  })
  const orgIds = distinct.map((d) => d.organizationId)
  console.log(`Zincir sayısı (org + null): ${orgIds.length}`)
  console.log('')

  let totalRows = 0
  let totalChanged = 0
  for (const orgId of orgIds) {
    const { total, changed } = await rechainOrg(orgId)
    totalRows += total
    totalChanged += changed
  }

  console.log('')
  console.log(`Toplam: ${totalRows} kayıt, ${totalChanged} satır ${EXECUTE ? 'güncellendi' : 'düzeltilecek'}.`)
  if (!EXECUTE && totalChanged > 0) {
    console.log('➡️  Uygulamak için: pnpm tsx scripts/rechain-audit-logs.ts --execute')
  } else if (EXECUTE) {
    console.log('✅ Tamam. Şimdi "Zinciri Doğrula" yeşil dönmeli.')
  } else {
    console.log('✅ Tüm zincirler zaten sağlam.')
  }
  console.log('')
}

main()
  .catch((err) => {
    console.error('🛑 rechain-audit-logs başarısız:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
