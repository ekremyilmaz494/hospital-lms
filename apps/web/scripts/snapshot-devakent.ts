/**
 * Devakent baseline snapshot — refactor öncesi/sonrası "tek satır bile kaybolmadı"
 * garantisi için. Devakent organizasyonuna `organizationId` ile bağlı her child
 * tablonun row sayısını + Devakent org satırının kendi alanlarının hash'ini
 * JSON dosyasına yazar.
 *
 * Kullanım:
 *   pnpm tsx scripts/snapshot-devakent.ts              # snapshots/devakent-<env>-<timestamp>.json yazar
 *   pnpm tsx scripts/snapshot-devakent.ts --diff <a>   # önceki snapshot ile diff
 *
 * Refactor sırasında: her Phase adımı öncesi `--diff` ile karşılaştır. Sıfır
 * fark beklenir (sadece updatedAt değişebilir → diff'te göz ardı edilir).
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '@/lib/prisma'

type Counts = Record<string, number>
type Snapshot = {
  takenAt: string
  env: string
  org: {
    id: string
    name: string
    slug: string | null
    code: string
    sector: string
    isActive: boolean
    fieldsHash: string
  }
  counts: Counts
}

async function takeSnapshot(): Promise<Snapshot> {
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'devakent', mode: 'insensitive' } },
  })
  if (!org) throw new Error('Devakent organizasyonu bulunamadı.')

  const where = { organizationId: org.id }

  // Supabase pooler session mode pool_size: 15 — 29 paralel sorgu EMAXCONNSESSION verir.
  // 5'erli batch'lerle sequential çalıştır (snapshot zamanı ~5-10sn, refactor günde tek seferlik).
  const countTasks: { key: string; fn: () => Promise<number> }[] = [
    { key: 'users',                  fn: () => prisma.user.count({ where }) },
    { key: 'departments',            fn: () => prisma.department.count({ where }) },
    { key: 'trainings',              fn: () => prisma.training.count({ where }) },
    { key: 'trainingAssignments',    fn: () => prisma.trainingAssignment.count({ where }) },
    { key: 'trainingPeriods',        fn: () => prisma.trainingPeriod.count({ where }) },
    { key: 'trainingCategories',     fn: () => prisma.trainingCategory.count({ where }) },
    { key: 'examAttempts',           fn: () => prisma.examAttempt.count({ where }) },
    { key: 'examAttemptRequests',    fn: () => prisma.examAttemptRequest.count({ where }) },
    { key: 'certificates',           fn: () => prisma.certificate.count({ where }) },
    { key: 'questionBanks',          fn: () => prisma.questionBank.count({ where }) },
    { key: 'feedbackForms',          fn: () => prisma.trainingFeedbackForm.count({ where }) },
    { key: 'feedbackResponses',      fn: () => prisma.trainingFeedbackResponse.count({ where }) },
    { key: 'smgActivities',          fn: () => prisma.smgActivity.count({ where }) },
    { key: 'smgPeriods',             fn: () => prisma.smgPeriod.count({ where }) },
    { key: 'smgCategories',          fn: () => prisma.smgCategory.count({ where }) },
    { key: 'smgTargets',             fn: () => prisma.smgTarget.count({ where }) },
    { key: 'accreditationReports',   fn: () => prisma.accreditationReport.count({ where }) },
    { key: 'accreditationStandards', fn: () => prisma.accreditationStandard.count({ where }) },
    { key: 'competencyForms',        fn: () => prisma.competencyForm.count({ where }) },
    { key: 'contentLibraryInstalls', fn: () => prisma.organizationContentLibrary.count({ where }) },
    { key: 'orgContentLibrary',      fn: () => prisma.contentLibrary.count({ where }) },
    { key: 'notifications',          fn: () => prisma.notification.count({ where }) },
    { key: 'auditLogs',              fn: () => prisma.auditLog.count({ where }) },
    { key: 'dbBackups',              fn: () => prisma.dbBackup.count({ where }) },
    { key: 'kvkkRequests',           fn: () => prisma.kvkkRequest.count({ where }) },
    { key: 'invitations',            fn: () => prisma.invitation.count({ where }) },
    { key: 'subscription',           fn: () => prisma.organizationSubscription.count({ where: { organizationId: org.id } }) },
  ]
  const counts: Counts = {}
  const BATCH = 5
  for (let i = 0; i < countTasks.length; i += BATCH) {
    const batch = countTasks.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(t => t.fn()))
    batch.forEach((t, idx) => { counts[t.key] = results[idx] })
  }

  // Org satırının kritik alanlarının deterministik hash'i — refactor sırasında
  // updatedAt dışındaki herhangi bir alan değişirse fark eder.
  const orgFingerprint = {
    name: org.name, code: org.code, slug: org.slug, sector: org.sector,
    isActive: org.isActive, isSuspended: org.isSuspended,
    brandColor: org.brandColor, secondaryColor: org.secondaryColor,
    customDomain: org.customDomain, language: org.language,
    ownerUserId: org.ownerUserId,
  }
  const fieldsHash = createHash('sha256')
    .update(JSON.stringify(orgFingerprint, Object.keys(orgFingerprint).sort()))
    .digest('hex')
    .slice(0, 16)

  return {
    takenAt: new Date().toISOString(),
    env: process.env.NODE_ENV ?? process.env.SUPABASE_ENV ?? 'unknown',
    org: {
      id: org.id, name: org.name, slug: org.slug, code: org.code,
      sector: org.sector, isActive: org.isActive, fieldsHash,
    },
    counts,
  }
}

function formatCounts(counts: Counts): string {
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  const width = Math.max(...rows.map(([k]) => k.length))
  return rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`).join('\n')
}

function diffSnapshots(prev: Snapshot, curr: Snapshot): { ok: boolean; report: string } {
  const lines: string[] = []
  if (prev.org.id !== curr.org.id) lines.push(`✗ org.id değişti: ${prev.org.id} → ${curr.org.id}`)
  if (prev.org.fieldsHash !== curr.org.fieldsHash) {
    lines.push(`✗ org alanları değişti (fieldsHash ${prev.org.fieldsHash} → ${curr.org.fieldsHash})`)
  }
  for (const [k, prevCount] of Object.entries(prev.counts)) {
    const currCount = curr.counts[k]
    if (currCount === undefined) {
      lines.push(`✗ tablo kayboldu: ${k}`)
    } else if (currCount < prevCount) {
      lines.push(`✗ ${k}: ${prevCount} → ${currCount} (${currCount - prevCount} VERİ KAYBI)`)
    } else if (currCount > prevCount) {
      lines.push(`◐ ${k}: ${prevCount} → ${currCount} (+${currCount - prevCount} eklenmiş — beklenmedik mi?)`)
    }
  }
  for (const k of Object.keys(curr.counts)) {
    if (!(k in prev.counts)) lines.push(`◐ yeni tablo: ${k} = ${curr.counts[k]}`)
  }
  const lossy = lines.some((l) => l.startsWith('✗'))
  return {
    ok: !lossy,
    report: lines.length === 0 ? '  (fark yok)' : lines.map((l) => `  ${l}`).join('\n'),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const diffIdx = args.indexOf('--diff')

  const snap = await takeSnapshot()
  const outDir = join(process.cwd(), 'snapshots')
  await mkdir(outDir, { recursive: true })
  const fname = `devakent-${snap.env}-${snap.takenAt.replace(/[:.]/g, '-')}.json`
  const outPath = join(outDir, fname)
  await writeFile(outPath, JSON.stringify(snap, null, 2), 'utf8')

  console.log(`\n◐ ${snap.org.name}  (env=${snap.env}, fieldsHash=${snap.org.fieldsHash})`)
  console.log(formatCounts(snap.counts))
  console.log(`\nSnapshot: ${outPath}`)

  if (diffIdx >= 0 && args[diffIdx + 1]) {
    const prev: Snapshot = JSON.parse(await readFile(args[diffIdx + 1], 'utf8'))
    const { ok, report } = diffSnapshots(prev, snap)
    console.log(`\n${ok ? '✓' : '✗'} Diff vs ${args[diffIdx + 1]}:\n${report}`)
    if (!ok) process.exitCode = 1
  }
}

main().finally(() => prisma.$disconnect())
