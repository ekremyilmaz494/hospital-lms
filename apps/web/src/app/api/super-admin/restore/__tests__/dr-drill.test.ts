/**
 * FELAKET-KURTARMA (DR) RESTORE TATBİKATI — gerçek DB, gerçek route.
 *
 * Restore kodu unit-test + tsc + FK-graf ile doğrulandı; bu tatbikat tek eksik
 * kalan şeyi kapatır: UÇTAN UCA "yedekten gerçekten geri dön" provası. İzole bir
 * throwaway org'u seed eder → GERÇEK buildBackupSnapshot ile yedekler → felaketi
 * simüle eder (auth.users WIPE + veri bozma/silme) → GERÇEK restore POST handler'ını
 * çalıştırır → her şeyin (ÖZELLİKLE parola hash'lerinin) geri geldiğini doğrular.
 *
 * ÇALIŞTIRMA (yalnız yerel/staging DB ile):
 *   set -a; . apps/web/.env.local; set +a; DR_DRILL=1 pnpm --filter web dr:drill
 *
 * GÜVENLİK: YIKICI. `DR_DRILL` set değilse (normal `pnpm test`/CI) TAMAMEN ATLANIR.
 * Ayrıca prod-guard: DATABASE_URL yerel değilse `DR_ALLOW_REMOTE=1` olmadan reddeder.
 * Yalnız sabit-UUID throwaway org'a dokunur; çalışınca kendini temizler.
 *
 * Mock'lar: s3 (downloadBuffer → yedek blob), api-handler (auth bypass), api-helpers
 * (response/audit), redis (rate-limit). GERÇEK: prisma (yerel DB), backup-crypto, snapshot.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const DRILL = !!process.env.DR_DRILL

// ── Mock'lar (hoisted) ──
const h = vi.hoisted(() => ({ blob: null as Buffer | null }))

const s3Mock = { downloadBuffer: vi.fn(async () => { if (!h.blob) throw new Error('drill: yedek blob yok'); return h.blob }) }
const redisMock = {
  getRateLimitCount: vi.fn().mockResolvedValue(0),
  incrementRateLimit: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@/lib/s3', () => s3Mock)
vi.mock('@/lib/redis', () => redisMock)
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data as Record<string, unknown>, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => { try { return await req.json() } catch { return null } },
  ApiError: class ApiError extends Error { status: number; constructor(m: string, s = 400) { super(m); this.status = s } toResponse() { return Response.json({ error: this.message }, { status: this.status }) } },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/api-handler', () => ({
  withSuperAdminRoute: (handler: (ctx: unknown) => Promise<Response>) =>
    async (request: Request) => handler({ request, params: {}, dbUser: { id: U1, role: 'super_admin', organizationId: null }, audit: vi.fn() }),
}))

// ── Sabit throwaway entity UUID'leri (drill'e özel; teardown bunlara göre) ──
const ORG = 'dddddddd-0000-4000-8000-000000000001'
const U1 = 'dddddddd-0000-4000-8000-000000000011'
const U2 = 'dddddddd-0000-4000-8000-000000000012'
const DEPT_PARENT = 'dddddddd-0000-4000-8000-000000000021'
const DEPT_CHILD = 'dddddddd-0000-4000-8000-000000000022'
const TRAINING = 'dddddddd-0000-4000-8000-000000000031'
const VIDEO = 'dddddddd-0000-4000-8000-000000000041'
const QUESTION = 'dddddddd-0000-4000-8000-000000000051'
const OPTION = 'dddddddd-0000-4000-8000-000000000061'
const MEDIA = 'dddddddd-0000-4000-8000-000000000071'
const TCAT = 'dddddddd-0000-4000-8000-000000000081'
const TFFORM = 'dddddddd-0000-4000-8000-000000000091'
const TFCAT = 'dddddddd-0000-4000-8000-0000000000a1'
const TFITEM = 'dddddddd-0000-4000-8000-0000000000b1'
const ASTD = 'dddddddd-0000-4000-8000-0000000000c1'
const AREPORT = 'dddddddd-0000-4000-8000-0000000000d1'
const CERT = 'dddddddd-0000-4000-8000-0000000000e1'

// Bilinen "parola hash"leri — gerçek bcrypt DEĞİL (secret-scanner takılmasın); sadece round-trip kanıtı.
const HASH1 = 'drill-hash-u1-ORIGINAL'
const HASH2 = 'drill-hash-u2-ORIGINAL'
const VIDEO_SIZE = BigInt('1234567890')
const MEDIA_SIZE = BigInt('987654321')

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/super-admin/restore', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe.skipIf(!DRILL)('DR Restore Tatbikatı — backup → wipe → restore → verify', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let prisma: any
  let POST: (req: Request) => Promise<Response>
  let backupId: string

  async function teardown() {
    await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ANY(ARRAY[${U1}, ${U2}]::uuid[])`
    await prisma.certificate.deleteMany({ where: { organizationId: ORG } })
    await prisma.accreditationReport.deleteMany({ where: { organizationId: ORG } })
    await prisma.accreditationStandard.deleteMany({ where: { organizationId: ORG } })
    await prisma.trainingFeedbackItem.deleteMany({ where: { category: { form: { organizationId: ORG } } } })
    await prisma.trainingFeedbackCategory.deleteMany({ where: { form: { organizationId: ORG } } })
    await prisma.trainingFeedbackForm.deleteMany({ where: { organizationId: ORG } })
    await prisma.mediaAsset.deleteMany({ where: { organizationId: ORG } })
    await prisma.trainingCategory.deleteMany({ where: { organizationId: ORG } })
    await prisma.questionOption.deleteMany({ where: { question: { trainingId: TRAINING } } })
    await prisma.question.deleteMany({ where: { trainingId: TRAINING } })
    await prisma.trainingVideo.deleteMany({ where: { trainingId: TRAINING } })
    await prisma.training.deleteMany({ where: { organizationId: ORG } })
    await prisma.department.deleteMany({ where: { organizationId: ORG } })
    await prisma.user.deleteMany({ where: { organizationId: ORG } })
    await prisma.dbBackup.deleteMany({ where: { organizationId: ORG } })
    await prisma.organization.deleteMany({ where: { id: ORG } })
  }

  async function seed() {
    await teardown() // idempotent — önceki drill kalıntısını temizle
    await prisma.organization.create({ data: { id: ORG, name: 'DR Drill Hastanesi', code: 'DR-DRILL-ORG' } })
    await prisma.user.create({ data: { id: U1, email: 'dr-drill-u1@example.local', firstName: 'Drill', lastName: 'AdminUser', role: 'admin', organizationId: ORG } })
    await prisma.user.create({ data: { id: U2, email: 'dr-drill-u2@example.local', firstName: 'Drill', lastName: 'StaffUser', role: 'staff', organizationId: ORG } })
    // auth.users — parola geri-yükleme kanıtının kalbi (bilinen hash'ler)
    await prisma.$executeRaw`
      INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
      VALUES (${U1}::uuid, 'dr-drill-u1@example.local', ${HASH1}, now(), now()),
             (${U2}::uuid, 'dr-drill-u2@example.local', ${HASH2}, now(), now())
      ON CONFLICT (id) DO NOTHING`
    // departments — parent + child (self-FK iki-geçiş testi)
    await prisma.department.create({ data: { id: DEPT_PARENT, organizationId: ORG, name: 'Üst Departman' } })
    await prisma.department.create({ data: { id: DEPT_CHILD, organizationId: ORG, name: 'Alt Departman', parentId: DEPT_PARENT } })
    // training + video(BigInt) + question + option
    await prisma.training.create({ data: { id: TRAINING, organizationId: ORG, title: 'Drill Eğitimi', startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-12-31T00:00:00Z') } })
    await prisma.trainingVideo.create({ data: { id: VIDEO, trainingId: TRAINING, title: 'Drill Video', videoUrl: '', videoKey: 'drill/v.mp4', durationSeconds: 120, fileSizeBytes: VIDEO_SIZE } })
    await prisma.question.create({ data: { id: QUESTION, trainingId: TRAINING, questionText: 'Drill soru?' } })
    await prisma.questionOption.create({ data: { id: OPTION, questionId: QUESTION, optionText: 'Şık A' } })
    // mediaAsset (BigInt) — v4
    await prisma.mediaAsset.create({ data: { id: MEDIA, organizationId: ORG, title: 'Drill Medya', mediaType: 'video', s3Key: 'drill/m.mp4', fileSizeBytes: MEDIA_SIZE, uploadedById: U1 } })
    // trainingCategory — v4
    await prisma.trainingCategory.create({ data: { id: TCAT, organizationId: ORG, value: 'drill-cat', label: 'Drill Kategori', icon: 'book' } })
    // feedback form→category→item — v4 transitive
    await prisma.trainingFeedbackForm.create({ data: { id: TFFORM, organizationId: ORG } })
    await prisma.trainingFeedbackCategory.create({ data: { id: TFCAT, formId: TFFORM, name: 'Drill FB Kategori' } })
    await prisma.trainingFeedbackItem.create({ data: { id: TFITEM, categoryId: TFCAT, text: 'Drill FB madde' } })
    // accreditation standard + report (Restrict→user) — v4
    await prisma.accreditationStandard.create({ data: { id: ASTD, organizationId: ORG, code: 'DRILL-STD', title: 'Drill Standart', standardBody: 'JCI' } })
    await prisma.accreditationReport.create({ data: { id: AREPORT, organizationId: ORG, title: 'Drill Rapor', standardBody: 'JCI', generatedBy: U1, periodStart: new Date('2026-01-01T00:00:00Z'), periodEnd: new Date('2026-06-30T00:00:00Z') } })
    // certificate (Restrict→user/training/org; attempt'siz)
    await prisma.certificate.create({ data: { id: CERT, userId: U2, trainingId: TRAINING, certificateCode: 'DRILL-CERT-001', organizationId: ORG } })
  }

  beforeAll(async () => {
    // ── Prod güvenlik guard'ı ──
    const dbUrl = process.env.DATABASE_URL ?? ''
    let host = ''
    try { host = new URL(dbUrl).hostname } catch { /* ignore */ }
    if (!['127.0.0.1', 'localhost'].includes(host) && process.env.DR_ALLOW_REMOTE !== '1') {
      throw new Error(`DR drill prod-guard: DATABASE_URL host '${host || '?'}' yerel değil — yıkıcı drill iptal. (Bilerek staging için: DR_ALLOW_REMOTE=1)`)
    }
    // Sentetik drill verisi → düz-metin yedek (encryptBackup'ın tam bu durum için açtığı yol).
    // Şifreleme backup-crypto.test.ts'te ayrıca test edilir; drill RESTORE doğruluğuna odaklanır.
    delete process.env.BACKUP_ENCRYPTION_KEY
    process.env.ALLOW_PLAINTEXT_BACKUP = 'true'

    // Dinamik import: yalnız drill koşunca (CI'da skipIf → prisma client hiç instantiate olmaz)
    ;({ prisma } = await import('@/lib/prisma'))
    const { buildBackupSnapshot } = await import('@/lib/backup/snapshot')
    const { encryptBackup, stringifyBackup } = await import('@/lib/backup-crypto')
    ;({ POST } = await import('../route'))

    await seed()

    // ── Yedekle (gerçek pipeline) ──
    const snap = await buildBackupSnapshot(ORG, { includeAuthUsers: true })
    const json = stringifyBackup(snap)
    const { data } = encryptBackup(json)
    h.blob = Buffer.from(data, 'utf-8')
    const backup = await prisma.dbBackup.create({
      data: { organizationId: ORG, backupType: 'manual', fileUrl: 'drill/backup-key', fileSizeMb: 0.01, status: 'completed', createdById: U1 },
    })
    backupId = backup.id

    // ── Felaketi simüle et ──
    await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ANY(ARRAY[${U1}, ${U2}]::uuid[])` // tam auth wipe
    await prisma.user.update({ where: { id: U1 }, data: { firstName: 'CORRUPTED' } })
    await prisma.department.deleteMany({ where: { id: DEPT_CHILD } })
    await prisma.certificate.deleteMany({ where: { id: CERT } })
    await prisma.mediaAsset.update({ where: { id: MEDIA }, data: { title: 'CHANGED' } })
  }, 120_000)

  afterAll(async () => {
    if (prisma) { await teardown(); await prisma.$disconnect() }
  }, 60_000)

  it('GERÇEK restore: auth.users parolaları + tüm veri (BigInt, dept hiyerarşi, Restrict, v4) geri gelir', async () => {
    const res = await POST(makeRequest({ backupId, confirm: true }))
    expect(res.status, await res.text().catch(() => '')).toBe(200)

    // 1) auth.users — orijinal parola hash'leri GERİ (DR'nin asıl kanıtı)
    const authRows = (await prisma.$queryRaw`
      SELECT id::text, encrypted_password FROM auth.users WHERE id = ANY(ARRAY[${U1}, ${U2}]::uuid[])`) as Array<{ id: string; encrypted_password: string }>
    expect(authRows).toHaveLength(2)
    expect(authRows.find((r) => r.id === U1)?.encrypted_password).toBe(HASH1)
    expect(authRows.find((r) => r.id === U2)?.encrypted_password).toBe(HASH2)

    // 2) public.users — bozulan ad geri yüklendi
    expect((await prisma.user.findUnique({ where: { id: U1 } }))?.firstName).toBe('Drill')

    // 3) departman self-FK hiyerarşisi sağlam (iki-geçiş)
    const child = await prisma.department.findUnique({ where: { id: DEPT_CHILD } })
    expect(child?.parentId).toBe(DEPT_PARENT)

    // 4) BigInt alanlar doğru geri geldi
    expect((await prisma.trainingVideo.findUnique({ where: { id: VIDEO } }))?.fileSizeBytes).toBe(VIDEO_SIZE)
    const media = await prisma.mediaAsset.findUnique({ where: { id: MEDIA } })
    expect(media?.fileSizeBytes).toBe(MEDIA_SIZE)
    expect(media?.title).toBe('Drill Medya') // değiştirilen başlık geri

    // 5) Restrict-kenarlı modeller geri (certificate, accreditationReport)
    expect(await prisma.certificate.findUnique({ where: { id: CERT } })).toBeTruthy()
    expect(await prisma.accreditationReport.findUnique({ where: { id: AREPORT } })).toBeTruthy()

    // 6) v4 transitive zincir geri (feedback form→category→item)
    expect(await prisma.trainingFeedbackItem.findUnique({ where: { id: TFITEM } })).toBeTruthy()
    expect(await prisma.trainingCategory.findUnique({ where: { id: TCAT } })).toBeTruthy()
  }, 120_000)
  /* eslint-enable @typescript-eslint/no-explicit-any */
})
