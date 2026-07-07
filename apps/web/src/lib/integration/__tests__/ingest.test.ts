import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock'lar ──────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    syncRun: { create: vi.fn(), update: vi.fn() },
    syncRowResult: { createMany: vi.fn() },
    user: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    department: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    organizationSubscription: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api-helpers', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
}))

// Redis yok → memory lock fallback (dev yolu)
vi.mock('@/lib/redis', () => ({ getRedis: () => null }))

// Deterministik TC hash — ENCRYPTION_KEY gerektirmesin
vi.mock('@/lib/tc-crypto', () => ({
  hashTcKimlik: (tc: string) => `hash-${tc}`,
}))

vi.mock('@/lib/auth-user-factory', () => {
  class AuthUserError extends Error {
    readonly safeMessage = 'Kullanıcı oluşturulamadı'
  }
  class DbUserError extends Error {
    readonly safeMessage = 'Kullanıcı veritabanına kaydedilemedi. Lütfen tekrar deneyin.'
  }
  return { createAuthUser: vi.fn(), AuthUserError, DbUserError }
})

vi.mock('@/lib/passwords', () => ({ generateTempPassword: () => 'PassAB12CD34!1' }))
vi.mock('@/lib/synthetic-email', () => ({
  generateSyntheticEmail: (hash: string) => `staff-${hash.slice(0, 16)}.invalid@klinovax.invalid`,
}))
vi.mock('@/lib/auto-assign', () => ({ autoAssignByDepartment: vi.fn().mockResolvedValue(0) }))
vi.mock('@/lib/staff-deactivate', () => ({ deactivateStaff: vi.fn() }))
vi.mock('@/lib/subscription-guard', () => ({ checkSubscriptionLimit: vi.fn() }))
vi.mock('@/lib/deployment', () => ({ isOnPrem: () => false }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

// ExcelJS bağımlılığını teste sokmamak için basit exact matcher (davranış exact eşleşme)
vi.mock('../staff-row', () => ({
  matchDepartment: (input: string, departments: Array<{ id: string; name: string }>) => {
    const normalized = input.trim().toLowerCase()
    const hit = departments.find(d => d.name.toLowerCase() === normalized)
    return hit ? { type: 'exact', dept: hit } : { type: 'none' }
  },
}))

import { runSync } from '../ingest'
import type { StaffRecord, SyncOptions } from '../types'
import { prisma } from '@/lib/prisma'
import { createAuthUser } from '@/lib/auth-user-factory'
import { deactivateStaff } from '@/lib/staff-deactivate'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { createServiceClient } from '@/lib/supabase/server'

const mockSyncRunCreate = prisma.syncRun.create as ReturnType<typeof vi.fn>
const mockSyncRunUpdate = prisma.syncRun.update as ReturnType<typeof vi.fn>
const mockRowCreateMany = prisma.syncRowResult.createMany as ReturnType<typeof vi.fn>
const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>
const mockUserUpdate = prisma.user.update as ReturnType<typeof vi.fn>
const mockUserCount = prisma.user.count as ReturnType<typeof vi.fn>
const mockDeptFindMany = prisma.department.findMany as ReturnType<typeof vi.fn>
const mockDeptCreate = prisma.department.create as ReturnType<typeof vi.fn>
const mockSubFindUnique = prisma.organizationSubscription.findUnique as ReturnType<typeof vi.fn>
const mockCreateAuthUser = createAuthUser as unknown as ReturnType<typeof vi.fn>
const mockDeactivateStaff = deactivateStaff as unknown as ReturnType<typeof vi.fn>
const mockCheckLimit = checkSubscriptionLimit as unknown as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as unknown as ReturnType<typeof vi.fn>

const ORG = 'org-1'

interface TestOrgUser {
  id: string
  externalId: string | null
  tcHash: string | null
  email: string
  firstName: string
  lastName: string
  phone: string | null
  title: string | null
  departmentId: string | null
  isActive: boolean
  role: string
  hireDate: Date | null
}

function makeUser(overrides: Partial<TestOrgUser> & { id: string }): TestOrgUser {
  return {
    externalId: null,
    tcHash: null,
    email: `${overrides.id}@hastane.com`,
    firstName: 'Ad',
    lastName: 'Soyad',
    phone: null,
    title: null,
    departmentId: null,
    isActive: true,
    role: 'staff',
    hireDate: null,
    ...overrides,
  }
}

function setupUsers(opts: {
  orgUsers?: TestOrgUser[]
  crossTc?: Array<{ tcHash: string }>
  crossEmail?: Array<{ email: string }>
} = {}) {
  const { orgUsers = [], crossTc = [], crossEmail = [] } = opts
  mockUserFindMany.mockImplementation((args?: { where?: Record<string, unknown> }) => {
    const where = (args?.where ?? {}) as Record<string, unknown>
    if ('tcHash' in where) return Promise.resolve(crossTc)
    if ('email' in where) return Promise.resolve(crossEmail)
    return Promise.resolve(orgUsers)
  })
}

function baseOpts(overrides: Partial<SyncOptions> = {}): SyncOptions {
  return {
    organizationId: ORG,
    channel: 'push',
    trigger: 'api',
    syncMode: 'delta',
    dryRun: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSyncRunCreate.mockResolvedValue({ id: 'run-1' })
  mockSyncRunUpdate.mockResolvedValue({})
  mockRowCreateMany.mockResolvedValue({ count: 0 })
  mockUserUpdate.mockResolvedValue({})
  mockUserCount.mockResolvedValue(0)
  mockDeptFindMany.mockResolvedValue([])
  mockDeptCreate.mockResolvedValue({ id: 'dept-new' })
  mockSubFindUnique.mockResolvedValue(null) // plan limiti yok → sınırsız
  mockCheckLimit.mockResolvedValue(null) // limit kapısı açık
  mockDeactivateStaff.mockResolvedValue(undefined)
  mockCreateAuthUser.mockImplementation(async (params: { email: string; firstName: string; lastName: string }) => ({
    authUser: { id: `auth-${params.email}`, email: params.email },
    dbUser: {
      id: `new-${params.email}`,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      role: 'staff',
      organizationId: ORG,
    },
  }))
  mockCreateServiceClient.mockResolvedValue({
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
  })
  setupUsers()
})

describe('runSync — eşleşme önceliği (a)', () => {
  it('externalId eşleşmesi tcHash ve email eşleşmelerinden önce gelir', async () => {
    const uExt = makeUser({ id: 'u-ext', externalId: 'E1', tcHash: 'hash-99999999998', email: 'ext@h.com', firstName: 'Ext', lastName: 'User' })
    const uTc = makeUser({ id: 'u-tc', tcHash: 'hash-TC1', email: 'tc@h.com' })
    const uMail = makeUser({ id: 'u-mail', email: 'mail@h.com' })
    setupUsers({ orgUsers: [uExt, uTc, uMail] })

    // Kayıt üç anahtarı da taşıyor: externalId uExt'e, TC uTc'ye, email uMail'e işaret ediyor.
    const records: StaffRecord[] = [
      { externalId: 'E1', tcKimlik: 'TC1', email: 'mail@h.com', firstName: 'Ext', lastName: 'User' },
    ]

    const result = await runSync(records, baseOpts())
    expect(result.rowResults[0].userId).toBe('u-ext')
  })

  it('externalId yoksa tcHash, o da yoksa email ile eşleşir', async () => {
    const uTc = makeUser({ id: 'u-tc', tcHash: 'hash-TC1', email: 'tc@h.com', firstName: 'Tc', lastName: 'User' })
    const uMail = makeUser({ id: 'u-mail', email: 'mail@h.com', firstName: 'Mail', lastName: 'User' })
    setupUsers({ orgUsers: [uTc, uMail] })

    // TC hem uTc'yi hem email uMail'i işaret ediyor → tcHash öncelikli.
    const byTc = await runSync(
      [{ tcKimlik: 'TC1', email: 'mail@h.com', firstName: 'Tc', lastName: 'User' }],
      baseOpts(),
    )
    expect(byTc.rowResults[0].userId).toBe('u-tc')

    // Yalnız email → uMail.
    const byMail = await runSync(
      [{ email: 'mail@h.com', firstName: 'Mail', lastName: 'User' }],
      baseOpts(),
    )
    expect(byMail.rowResults[0].userId).toBe('u-mail')
  })
})

describe('runSync — snapshot güvenlik eşiği (b)', () => {
  function snapshotFixture() {
    // 30 aktif entegrasyon-yönetimli personel; feed yalnız ilk 10'u içeriyor → 20 deaktivasyon planı.
    const orgUsers = Array.from({ length: 30 }, (_, i) =>
      makeUser({ id: `u-${i + 1}`, externalId: `E${i + 1}`, firstName: `Ad${i + 1}`, lastName: `Soyad${i + 1}` }),
    )
    const records: StaffRecord[] = Array.from({ length: 10 }, (_, i) => ({
      externalId: `E${i + 1}`,
      firstName: `Ad${i + 1}`,
      lastName: `Soyad${i + 1}`,
    }))
    setupUsers({ orgUsers })
    return records
  }

  it('eşik aşılırsa koşu ABORT edilir — hiçbir şey uygulanmaz, satırlar persist edilir', async () => {
    const records = snapshotFixture()

    const result = await runSync(records, baseOpts({ syncMode: 'snapshot', deactivateMissing: true }))

    // eşik = max(5, ceil(30 * %20)) = 6; planlanan 20 > 6 → abort
    expect(result.status).toBe('aborted')
    expect(result.counts.deactivatedRows).toBe(0)
    expect(mockDeactivateStaff).not.toHaveBeenCalled()
    expect(mockCreateAuthUser).not.toHaveBeenCalled()
    // Plan satırları yine persist edilir (denetim + UI için)
    expect(mockRowCreateMany).toHaveBeenCalledTimes(1)
    expect(mockSyncRunUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'aborted' }),
    }))
    const summary = mockSyncRunUpdate.mock.calls[0][0].data.errorSummary as { message: string }
    expect(summary.message).toContain('Güvenlik eşiği aşıldı')
  })

  it('force=true eşiği geçer ve deaktivasyonları uygular', async () => {
    const records = snapshotFixture()

    const result = await runSync(records, baseOpts({ syncMode: 'snapshot', deactivateMissing: true, force: true }))

    expect(result.status).toBe('completed')
    expect(result.counts.deactivatedRows).toBe(20)
    expect(result.counts.skippedRows).toBe(10)
    expect(mockDeactivateStaff).toHaveBeenCalledTimes(20)
    expect(mockDeactivateStaff).toHaveBeenCalledWith('u-11', { organizationId: ORG, wasActive: true })
  })
})

describe('runSync — cross-org çakışması (c)', () => {
  it("TC başka kurumda kayıtlıysa satır conflict olur ve uygulanmaz", async () => {
    setupUsers({ crossTc: [{ tcHash: 'hash-TCX' }] })

    const result = await runSync(
      [{ externalId: 'E9', tcKimlik: 'TCX', firstName: 'Ali', lastName: 'Kaya' }],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('conflict')
    expect(result.rowResults[0].message).toContain('başka bir kurumda')
    expect(result.counts.failedRows).toBe(1)
    expect(result.status).toBe('completed_with_errors')
    expect(mockCreateAuthUser).not.toHaveBeenCalled()
  })

  it('e-posta başka kurumda kayıtlıysa da conflict olur', async () => {
    setupUsers({ crossEmail: [{ email: 'ortak@h.com' }] })

    const result = await runSync(
      [{ externalId: 'E9', email: 'ortak@h.com', firstName: 'Ali', lastName: 'Kaya' }],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('conflict')
    expect(mockCreateAuthUser).not.toHaveBeenCalled()
  })
})

describe('runSync — admin koruması (d)', () => {
  it('eşleşen kullanıcı staff değilse satır conflict olur, güncelleme yapılmaz', async () => {
    setupUsers({ orgUsers: [makeUser({ id: 'u-adm', externalId: 'E1', role: 'admin', firstName: 'Yönetici' })] })

    const result = await runSync(
      [{ externalId: 'E1', firstName: 'Değişik', lastName: 'İsim' }],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('conflict')
    expect(result.rowResults[0].message).toBe('Yönetici hesapları entegrasyonla güncellenemez')
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })
})

describe('runSync — manuel personel koruması (e)', () => {
  it('externalId=null manuel personel snapshot eksik-listesinde deaktive EDİLMEZ', async () => {
    const integUser = makeUser({ id: 'u-int', externalId: 'E1', firstName: 'Ad1', lastName: 'Soyad1' })
    const manualUser = makeUser({ id: 'u-manual', externalId: null })
    const adminUser = makeUser({ id: 'u-admin', externalId: 'E-ADM', role: 'admin' })
    setupUsers({ orgUsers: [integUser, manualUser, adminUser] })

    const result = await runSync(
      [{ externalId: 'E1', firstName: 'Ad1', lastName: 'Soyad1' }],
      baseOpts({ syncMode: 'snapshot', deactivateMissing: true }),
    )

    // Yalnız feed satırı var — manuel personel ve admin için deactivate satırı üretilmedi
    expect(result.rowResults).toHaveLength(1)
    expect(result.counts.deactivatedRows).toBe(0)
    expect(mockDeactivateStaff).not.toHaveBeenCalled()
  })
})

describe('runSync — koltuk limiti (f)', () => {
  it("headroom'u aşan create satırları error olur, koşu durmaz", async () => {
    mockSubFindUnique.mockResolvedValue({ plan: { maxStaff: 5 } })
    mockUserCount.mockResolvedValue(4) // headroom = 1

    const records: StaffRecord[] = [
      { externalId: 'N1', firstName: 'Bir', lastName: 'Yeni' },
      { externalId: 'N2', firstName: 'İki', lastName: 'Yeni' },
      { externalId: 'N3', firstName: 'Üç', lastName: 'Yeni' },
    ]

    const result = await runSync(records, baseOpts())

    expect(mockCreateAuthUser).toHaveBeenCalledTimes(1)
    expect(result.counts.createdRows).toBe(1)
    expect(result.counts.failedRows).toBe(2)
    expect(result.rowResults[1].action).toBe('error')
    expect(result.rowResults[1].message).toContain('Personel limiti doldu')
    expect(result.rowResults[2].action).toBe('error')
    expect(result.status).toBe('completed_with_errors')
  })

  it('limit kapısı (checkSubscriptionLimit) doluysa hiçbir create uygulanmaz', async () => {
    mockCheckLimit.mockResolvedValue(new Response('limit', { status: 403 }))

    const result = await runSync(
      [{ externalId: 'N1', firstName: 'Bir', lastName: 'Yeni' }],
      baseOpts(),
    )

    expect(mockCreateAuthUser).not.toHaveBeenCalled()
    expect(result.counts.createdRows).toBe(0)
    expect(result.counts.failedRows).toBe(1)
  })
})

describe('runSync — reactivate (g)', () => {
  it('pasif entegrasyon-yönetimli kullanıcı feed’de aktif gelirse yeniden aktifleştirilir', async () => {
    setupUsers({
      orgUsers: [makeUser({ id: 'u-r', externalId: 'E1', isActive: false, firstName: 'Ali', lastName: 'Kaya' })],
    })

    const result = await runSync(
      [{ externalId: 'E1', firstName: 'Ali', lastName: 'Kaya' }],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('reactivate')
    expect(result.counts.reactivatedRows).toBe(1)
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u-r' },
      data: expect.objectContaining({ isActive: true, deactivatedAt: null }),
    }))
  })

  it('pasif MANUEL kullanıcı (externalId=null) reactivate edilmez — skip', async () => {
    setupUsers({
      orgUsers: [makeUser({ id: 'u-m', externalId: null, tcHash: 'hash-TC1', isActive: false, firstName: 'Ali', lastName: 'Kaya' })],
    })

    const result = await runSync(
      [{ tcKimlik: 'TC1', firstName: 'Ali', lastName: 'Kaya' }],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('skip')
    expect(result.rowResults[0].message).toContain('entegrasyon tarafından yönetilmiyor')
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })
})

describe('runSync — dryRun (h)', () => {
  it('dryRun hiçbir yazma yapmaz ama planı persist eder', async () => {
    setupUsers({
      orgUsers: [
        makeUser({ id: 'u-1', externalId: 'E1', firstName: 'Eski', lastName: 'İsim' }),
        makeUser({ id: 'u-2', externalId: 'E2', isActive: false }),
      ],
    })

    const result = await runSync(
      [
        { externalId: 'E1', firstName: 'Yeni', lastName: 'İsim' }, // update planı
        { externalId: 'N1', firstName: 'Sıfırdan', lastName: 'Kayıt' }, // create planı
        { externalId: 'E2', firstName: 'Ad', lastName: 'Soyad', active: false }, // zaten pasif → skip
      ],
      baseOpts({ dryRun: true }),
    )

    expect(result.status).toBe('completed')
    expect(result.counts.updatedRows).toBe(1)
    expect(result.counts.createdRows).toBe(1)
    expect(result.counts.skippedRows).toBe(1)
    // Hiçbir write yok:
    expect(mockCreateAuthUser).not.toHaveBeenCalled()
    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockDeactivateStaff).not.toHaveBeenCalled()
    expect(mockDeptCreate).not.toHaveBeenCalled()
    // Plan satırları persist edilir + run kapatılır
    expect(mockRowCreateMany).toHaveBeenCalledTimes(1)
    expect(mockSyncRunUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed' }),
    }))
  })
})

describe('runSync — feed-içi duplicate (i)', () => {
  it('aynı externalId ikinci satırda conflict üretir (ilk satır işlenir)', async () => {
    const result = await runSync(
      [
        { externalId: 'E1', firstName: 'Bir', lastName: 'Kayıt' },
        { externalId: 'E1', firstName: 'Kopya', lastName: 'Kayıt' },
      ],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('create')
    expect(result.rowResults[1].action).toBe('conflict')
    expect(result.rowResults[1].message).toContain('tekrarlayan sicil no')
    expect(mockCreateAuthUser).toHaveBeenCalledTimes(1)
  })

  it('aynı TC ikinci satırda conflict üretir', async () => {
    const result = await runSync(
      [
        { externalId: 'E1', tcKimlik: 'TC1', firstName: 'Bir', lastName: 'Kayıt' },
        { externalId: 'E2', tcKimlik: 'TC1', firstName: 'Kopya', lastName: 'Kayıt' },
      ],
      baseOpts(),
    )

    expect(result.rowResults[1].action).toBe('conflict')
    expect(result.rowResults[1].message).toContain('tekrarlayan TC')
  })
})

describe('runSync — diğer değişmezler', () => {
  it('eşleme anahtarı olmayan satır error olur (duplicate bombası koruması)', async () => {
    const result = await runSync(
      [{ firstName: 'Anahtarsız', lastName: 'Kayıt' }],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('error')
    expect(result.rowResults[0].message).toContain('Eşleme anahtarı yok')
  })

  it('tcHash ile eşleşen externalId=null kullanıcıya feed externalId backfill edilir', async () => {
    setupUsers({
      orgUsers: [makeUser({ id: 'u-b', externalId: null, tcHash: 'hash-TC1', firstName: 'Ali', lastName: 'Kaya' })],
    })

    const result = await runSync(
      [{ externalId: 'E1', tcKimlik: 'TC1', firstName: 'Ali', lastName: 'Kaya' }],
      baseOpts(),
    )

    expect(result.rowResults[0].action).toBe('update')
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u-b' },
      data: expect.objectContaining({ externalId: 'E1' }),
    }))
  })

  it("payloadMasked'e TC yazılmaz, e-posta maskelenir", async () => {
    await runSync(
      [{ externalId: 'E1', tcKimlik: 'TC1', email: 'ahmet@hastane.com', firstName: 'Ahmet', lastName: 'Öz' }],
      baseOpts({ dryRun: true }),
    )

    const persisted = mockRowCreateMany.mock.calls[0][0].data as Array<{ payloadMasked?: Record<string, unknown> }>
    const payload = persisted[0].payloadMasked as Record<string, unknown>
    expect(payload.tcProvided).toBe(true)
    expect(JSON.stringify(payload)).not.toContain('TC1')
    expect(payload.email).toBe('ah***@hastane.com')
  })

  it('aynı org için ikinci eşzamanlı koşu 409 ApiError fırlatır', async () => {
    // İlk koşuyu yavaşlat: syncRun.create bekletilirken ikinci koşu kilide çarpsın
    let resolveCreate: (v: { id: string }) => void = () => {}
    mockSyncRunCreate.mockImplementationOnce(
      () => new Promise<{ id: string }>(resolve => { resolveCreate = resolve }),
    )

    const first = runSync([{ externalId: 'E1', firstName: 'A', lastName: 'B' }], baseOpts())
    // Kilit alınana kadar mikrotick bekle
    await new Promise(r => setTimeout(r, 0))

    await expect(
      runSync([{ externalId: 'E2', firstName: 'C', lastName: 'D' }], baseOpts()),
    ).rejects.toMatchObject({ status: 409 })

    resolveCreate({ id: 'run-1' })
    await first
  })
})
