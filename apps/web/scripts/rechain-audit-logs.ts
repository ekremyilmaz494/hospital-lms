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
 * kayıtları doğrulamayla AYNI deterministik sırada okur — `[created_at asc, id asc]` —
 * ve `prev_hash`/`hash`'i `computeAuditHash` ile baştan, sırayla yeniden hesaplayıp
 * yazar. `created_at`'e DOKUNMAZ (denetim zaman damgaları gerçek kalır). Hash'siz eski
 * kayıtlar da artık hash kazanır → zincirdeki boşluklar kapanır.
 *
 * NEDEN HAM `pg` (Prisma değil): Prisma client'ı Supabase pooler ile (hem 6543 hem 5432)
 * bu ortamda takılıyor; ham `pg` sorunsuz çalışıyor. Hash fonksiyonu tek kaynak olan
 * `audit-hash.ts`'ten gelir (drift yok). DB tablo/kolon: `audit_logs` (snake_case).
 *
 * GÜVENLİK: İdempotenttir — zaten doğruysa hiçbir satırı değiştirmez (no-op). Org
 * bazında advisory kilit alır (createAuditLog ile AYNI anahtar) → çalışırken gelen
 * canlı audit yazımlarıyla yarışmaz.
 *
 * KULLANIM (repo kökü = hospital-lms klasörü):
 *   pnpm rechain:audit                 # KURU ÇALIŞMA (rapor; hiçbir şey yazmaz)
 *   pnpm rechain:audit -- --execute    # gerçek güncelleme
 *
 * Script HANGİ veritabanına bağlıysa ONU düzeltir (process.env.DATABASE_URL). Varsayılan
 * `.env.local`'dir (genelde YEREL). Devakent'i (CANLI) düzeltmek için canlı bağlantıyı
 * ortam değişkeni olarak ver — shell env `.env.local`'i geçersiz kılar:
 *   DATABASE_URL="postgresql://...CANLI..." pnpm rechain:audit               # kuru
 *   DATABASE_URL="postgresql://...CANLI..." pnpm rechain:audit -- --execute  # uygula
 *
 * SIRA: Önce yeni kod (atomik createAuditLog + verify) deploy edilmeli; SONRA bu script
 * BİR KEZ çalıştırılır. Sonrası: "Zinciri Doğrula" yeşil.
 */
import 'dotenv/config'
import { config as loadEnv } from 'dotenv'
// .env.local'i de yükle AMA override YOK: dışarıdan verilen DATABASE_URL (canlı) kazanır.
loadEnv({ path: '.env.local' })
import { Client } from 'pg'
import { computeAuditHash } from '../src/lib/audit-hash'

const EXECUTE = process.argv.includes('--execute')

type DbRow = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  user_id: string | null
  hash: string | null
  prev_hash: string | null
  created_at: Date
}

/** Bir org'un (veya null org'un) zincirini yeniden hesaplar; değişen satır sayısını döner. */
async function rechainOrg(client: Client, organizationId: string | null): Promise<{ total: number; changed: number }> {
  const lockKey = `audit:${organizationId ?? 'global'}`
  const label = organizationId ?? '(platform-geneli / null)'
  const where = organizationId === null ? 'organization_id IS NULL' : 'organization_id = $1'
  const params = organizationId === null ? [] : [organizationId]

  const { rows } = await client.query<DbRow>(
    `SELECT id, action, entity_type, entity_id, user_id, hash, prev_hash, created_at
       FROM audit_logs
      WHERE ${where}
      ORDER BY created_at ASC, id ASC`,
    params,
  )

  // Beklenen prev_hash/hash'i sırayla hesapla; sapan satırları topla.
  let previousHash: string | null = null
  const updates: { id: string; hash: string; prevHash: string | null }[] = []
  for (const r of rows) {
    const expectedPrev = previousHash
    const expectedHash = computeAuditHash({
      prevHash: expectedPrev,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      userId: r.user_id,
      createdAt: new Date(r.created_at).toISOString(),
    })
    if (r.hash !== expectedHash || r.prev_hash !== expectedPrev) {
      updates.push({ id: r.id, hash: expectedHash, prevHash: expectedPrev })
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

  // Gerçek güncelleme — advisory kilit altında tek transaction.
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])
    for (const u of updates) {
      await client.query('UPDATE audit_logs SET hash = $1, prev_hash = $2 WHERE id = $3', [u.hash, u.prevHash, u.id])
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
  console.log(`  ✔ ${label}: ${rows.length} kayıt — ${updates.length} satır güncellendi`)
  return { total: rows.length, changed: updates.length }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('🛑 DATABASE_URL tanımlı değil.')
    console.error('   Canlı için: DATABASE_URL="postgresql://...CANLI..." pnpm rechain:audit')
    process.exit(1)
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 120000 })
  await client.connect()
  try {
    console.log('')
    console.log('🔗 Audit Log Zinciri — Yeniden Tabana Alma')
    console.log(`   Mod: ${EXECUTE ? '⚠️  EXECUTE (gerçek güncelleme)' : '🔍 DRY-RUN (yalnız rapor)'}`)
    console.log('')

    // audit_logs içinde geçen tüm organization_id değerleri (null dahil).
    const { rows: orgRows } = await client.query<{ organization_id: string | null }>(
      'SELECT DISTINCT organization_id FROM audit_logs',
    )
    const orgIds = orgRows.map((r) => r.organization_id)
    console.log(`Zincir sayısı (org + null): ${orgIds.length}`)
    console.log('')

    let totalRows = 0
    let totalChanged = 0
    for (const orgId of orgIds) {
      const { total, changed } = await rechainOrg(client, orgId)
      totalRows += total
      totalChanged += changed
    }

    console.log('')
    console.log(`Toplam: ${totalRows} kayıt, ${totalChanged} satır ${EXECUTE ? 'güncellendi' : 'düzeltilecek'}.`)
    if (!EXECUTE && totalChanged > 0) {
      console.log('➡️  Uygulamak için: aynı komutu sonuna `-- --execute` ekleyerek çalıştır.')
    } else if (EXECUTE) {
      console.log('✅ Tamam. Şimdi "Zinciri Doğrula" yeşil dönmeli.')
    } else {
      console.log('✅ Tüm zincirler zaten sağlam.')
    }
    console.log('')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('🛑 rechain-audit-logs başarısız:', err)
  process.exitCode = 1
})
