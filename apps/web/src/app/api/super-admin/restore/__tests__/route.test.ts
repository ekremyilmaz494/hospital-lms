import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * POST /api/super-admin/restore — kritik veri-yıkım/yeniden-inşa endpoint'i.
 *
 * Bu test backup restore akışının davranış sözleşmesini koruma altına alır.
 * Sözleşme ihlali (ör: corrupt yedek sessizce restore edilirse, transaction
 * timeout'u <120s'ye düşerse, preview audit yazılmazsa) PR aşamasında bloklanır.
 *
 * Ayrıca Bulgu #2 regresyonu: prisma.$transaction çağrısı timeout >= 120s ile
 * yapılmalı — büyük yedeklerde Prisma default 5s timeout'u tx'i ortadan keser.
 */

const { prismaMock, s3Mock, cryptoMock, redisMock, apiHelpersMock } = vi.hoisted(() => ({
  prismaMock: {
    dbBackup: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  s3Mock: {
    downloadBuffer: vi.fn(),
  },
  cryptoMock: {
    decryptBackup: vi.fn(),
  },
  redisMock: {
    // Restore artık PEEK (getRateLimitCount) + başarıda CONSUME (incrementRateLimit) kullanır.
    getRateLimitCount: vi.fn().mockResolvedValue(0),
    incrementRateLimit: vi.fn().mockResolvedValue(undefined),
  },
  apiHelpersMock: {
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/s3', () => s3Mock)
vi.mock('@/lib/backup-crypto', () => cryptoMock)
vi.mock('@/lib/redis', () => redisMock)
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try {
      return await req.json()
    } catch {
      return null
    }
  },
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.status = status
    }
    toResponse() {
      return Response.json({ error: this.message }, { status: this.status })
    }
  },
  createAuditLog: apiHelpersMock.createAuditLog,
}))

vi.mock('@/lib/api-handler', () => ({
  withSuperAdminRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string | null }
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request) => {
      return handler({
        request,
        params: {} as P,
        dbUser: { id: 'super-1', role: 'super_admin', organizationId: null },
        audit: vi.fn().mockResolvedValue(undefined),
      })
    }
  },
}))

import { POST } from '../route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/super-admin/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBackupData = {
  users: [{ id: 'user-1', email: 'a@b.com', organizationId: 'org-1' }],
  departments: [],
  trainings: [],
  assignments: [],
  attempts: [],
  examAnswers: [],
  videoProgress: [],
  notifications: [],
  certificates: [],
  auditLogs: [],
  exportedAt: '2026-05-15T00:00:00Z',
  organizationId: 'org-1',
  organizationName: 'Test Hastanesi',
  schemaVersion: 2,
}

const completedBackup = {
  id: 'backup-1',
  organizationId: 'org-1',
  status: 'completed',
  fileUrl: 'backups/org-1/2026-05-15.json',
  fileSizeMb: 10,
}

describe('POST /api/super-admin/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from('encrypted-blob'))
    cryptoMock.decryptBackup.mockReturnValue(JSON.stringify(validBackupData))
    prismaMock.dbBackup.findUnique.mockResolvedValue(completedBackup)
    prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1' })
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = new Proxy({}, {
        get: () => new Proxy({}, {
          get: () => vi.fn().mockResolvedValue({ count: 0 }),
        }),
      })
      await fn(tx)
    })
    redisMock.getRateLimitCount.mockResolvedValue(0)
  })

  // ─── Body validation ───
  describe('body validation', () => {
    it('400: backupId yok', async () => {
      const res = await POST(makeRequest({ confirm: false }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/geçersiz/i)
    })

    it('400: confirm boolean değil', async () => {
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: 'yes' }))
      expect(res.status).toBe(400)
    })

    it('400: bozuk JSON body', async () => {
      const res = await POST(makeRequest('{ not json'))
      expect(res.status).toBe(400)
    })
  })

  // ─── Backup record checks ───
  describe('backup kaydı doğrulamaları', () => {
    it('404: backup kaydı bulunamadı', async () => {
      prismaMock.dbBackup.findUnique.mockResolvedValue(null)
      const res = await POST(makeRequest({ backupId: 'missing', confirm: false }))
      expect(res.status).toBe(404)
    })

    it('400: backup status=failed → restore yapılamaz', async () => {
      prismaMock.dbBackup.findUnique.mockResolvedValue({ ...completedBackup, status: 'failed' })
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/tamamlanmamış/i)
    })

    it('400: backup status=verification_failed → restore yapılamaz', async () => {
      prismaMock.dbBackup.findUnique.mockResolvedValue({ ...completedBackup, status: 'verification_failed' })
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
    })

    it('400: fileUrl boş', async () => {
      prismaMock.dbBackup.findUnique.mockResolvedValue({ ...completedBackup, fileUrl: '' })
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
    })
  })

  // ─── Preview mode ───
  describe('preview mode (confirm=false)', () => {
    it('preview döner, DB transaction çağrılmaz, restore_preview audit yazılır', async () => {
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.preview).toBe(true)
      expect(data.backupId).toBe('backup-1')
      expect(data.organizationId).toBe('org-1')
      expect(data.organizationName).toBe('Test Hastanesi')
      expect(data.counts.users).toBe(1)
      expect(data.counts.hasOrganization).toBe(0) // validBackupData.organization yok
      expect(data.counts.auditLogs).toBe(0)
      expect(data.counts.authUsers).toBe(0) // v2 backup → authUsers yok

      expect(prismaMock.$transaction).not.toHaveBeenCalled()
      expect(apiHelpersMock.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'restore_preview',
          entityType: 'DbBackup',
          entityId: 'backup-1',
        }),
      )
    })

    it('rate limit PEEK\'ine bile takılmaz (preview destructive değil)', async () => {
      redisMock.getRateLimitCount.mockResolvedValue(5)
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(200)
      expect(redisMock.getRateLimitCount).not.toHaveBeenCalled()
    })
  })

  // ─── Decrypt / parse / schema failures ───
  describe('decrypt + parse + şema doğrulaması', () => {
    it('400: decrypt başarısız (yanlış anahtar)', async () => {
      cryptoMock.decryptBackup.mockImplementation(() => {
        throw new Error('Unsupported state or unable to authenticate data')
      })
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/çözülemedi|ayrıştırılamadı|anahtar/i)
    })

    it('400: bozuk JSON → ayrıştırma hatası', async () => {
      cryptoMock.decryptBackup.mockReturnValue('{ not valid json')
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
    })

    it('400: şema geçersiz (users array eksik)', async () => {
      const broken: Record<string, unknown> = { ...validBackupData }
      delete broken.users
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify(broken))

      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/yapısı geçersiz/i)
    })

    it('400: şema geçersiz (organizationId eksik)', async () => {
      const broken: Record<string, unknown> = { ...validBackupData }
      delete broken.organizationId
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify(broken))

      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
    })

    it('v1 backup (auditLogs/organization/subscription opsiyonel) kabul edilir', async () => {
      const v1Backup = {
        users: [],
        departments: [],
        trainings: [],
        assignments: [],
        attempts: [],
        examAnswers: [],
        videoProgress: [],
        notifications: [],
        certificates: [],
        exportedAt: '2026-01-01T00:00:00Z',
        organizationId: 'org-1',
      }
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify(v1Backup))

      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.counts.auditLogs).toBe(0)
      expect(data.counts.hasOrganization).toBe(0)
    })
  })

  // ─── S3 / external errors ───
  describe('S3 hata yönetimi', () => {
    it('500: S3 download başarısız', async () => {
      s3Mock.downloadBuffer.mockRejectedValue(new Error('AccessDenied'))
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toMatch(/indirilemedi/i)
    })
  })

  // ─── Rate limit ───
  describe('rate limiting (confirm=true)', () => {
    it('429: 1 restore/saat aşıldı (peek >= 1) — budget tüketilmez', async () => {
      redisMock.getRateLimitCount.mockResolvedValue(1)
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(429)
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
      expect(redisMock.incrementRateLimit).not.toHaveBeenCalled()
    })

    it('anahtar kullanıcıya göre namespace\'lenir + budget yalnız başarılı restore\'da tüketilir', async () => {
      redisMock.getRateLimitCount.mockResolvedValue(0)
      await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(redisMock.getRateLimitCount).toHaveBeenCalledWith(expect.stringMatching(/^restore:/))
      expect(redisMock.incrementRateLimit).toHaveBeenCalledWith(expect.stringMatching(/^restore:/), 3600)
    })

    it('restore başarısızsa (org bulunamadı) budget tüketilmez (operatör kilitlenmez)', async () => {
      redisMock.getRateLimitCount.mockResolvedValue(0)
      prismaMock.organization.findUnique.mockResolvedValue(null)
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(400)
      expect(redisMock.incrementRateLimit).not.toHaveBeenCalled()
    })
  })

  // ─── Confirm/execute mode ───
  describe('confirm mode (execute)', () => {
    it('400: hedef organization mevcut değil', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null)
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/hedef organizasyon/i)
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('valid backup: transaction çalışır, restore_executed audit yazılır', async () => {
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.backupId).toBe('backup-1')
      expect(prismaMock.$transaction).toHaveBeenCalledOnce()

      expect(apiHelpersMock.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'restore_executed',
          entityType: 'DbBackup',
          entityId: 'backup-1',
        }),
      )
    })

    it('Bulgu #2 REGRESSION GUARD: transaction timeout >= 120_000ms ve maxWait set', async () => {
      await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(prismaMock.$transaction).toHaveBeenCalledOnce()

      const txOptions = prismaMock.$transaction.mock.calls[0][1] as
        | { timeout?: number; maxWait?: number }
        | undefined

      // Default Prisma timeout 5s — büyük restore'ları öldürür
      expect(txOptions?.timeout, 'restore tx timeout en az 120s olmalı (büyük kurum restore\'ları için)')
        .toBeGreaterThanOrEqual(120_000)

      // maxWait — pool tıkalıyken hızlı patlasın (sessizce uzun süre asılı kalmasın)
      expect(txOptions?.maxWait, 'restore tx maxWait set olmalı (connection pool guard)')
        .toBeGreaterThan(0)
    })
  })

  // ─── v3: authUsers restore + schemaVersion guard (KRİTİK #1/#2) ───
  describe('v3 authUsers restore + schemaVersion guard', () => {
    it('400: schemaVersion desteklenenden büyük (ileri-sürüm yedek) → sessiz veri kaybı önlenir', async () => {
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({ ...validBackupData, schemaVersion: 99 }))
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/daha yeni|güncelleyin/i)
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('v3 backup: authUsers varsa public.users\'tan ÖNCE tx.$executeRaw ile auth.users INSERT edilir', async () => {
      const executeRaw = vi.fn().mockResolvedValue(1)
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = new Proxy({}, {
          get: (_t, prop) =>
            prop === '$executeRaw'
              ? executeRaw
              : new Proxy({}, { get: () => vi.fn().mockResolvedValue({ count: 0 }) }),
        })
        await fn(tx)
      })
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({
        ...validBackupData,
        schemaVersion: 3,
        authUsers: [{ id: 'user-1', email: 'a@b.com', encrypted_password: '$2a$hash' }],
      }))

      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(200)
      expect(executeRaw).toHaveBeenCalledTimes(1)
      // INSERT hedefi auth.users + idempotent ON CONFLICT DO NOTHING olmalı (clobber yok)
      const sql = (executeRaw.mock.calls[0][0] as string[]).join('')
      expect(sql).toContain('auth.users')
      expect(sql).toMatch(/ON CONFLICT \(id\) DO NOTHING/)
    })

    it('v2 backup (authUsers yok): auth.users INSERT çalışmaz', async () => {
      const executeRaw = vi.fn().mockResolvedValue(1)
      prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = new Proxy({}, {
          get: (_t, prop) =>
            prop === '$executeRaw'
              ? executeRaw
              : new Proxy({}, { get: () => vi.fn().mockResolvedValue({ count: 0 }) }),
        })
        await fn(tx)
      })
      // validBackupData: authUsers yok, schemaVersion 2 → $executeRaw çağrılmamalı
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(200)
      expect(executeRaw).not.toHaveBeenCalled()
    })
  })

  // ─── v4 kapsam genişlemesi (27 model) ───
  describe('v4 kapsam modelleri', () => {
    // tx mock'u: hangi model accessor'ında createMany çağrıldığını kaydeder
    function trackingTransaction(calledModels: Set<string>) {
      return async (fn: (tx: unknown) => Promise<void>) => {
        const tx = new Proxy({}, {
          get: (_t, prop) => {
            if (prop === '$executeRaw') return vi.fn().mockResolvedValue(1)
            return new Proxy({}, {
              get: (__t, method) => {
                if (method === 'createMany') {
                  return (arg: { data?: unknown[] }) => {
                    calledModels.add(String(prop))
                    return Promise.resolve({ count: arg?.data?.length ?? 0 })
                  }
                }
                return vi.fn().mockResolvedValue({ count: 0 })
              },
            })
          },
        })
        await fn(tx)
      }
    }

    it('schemaVersion 4 kabul edilir + yeni model createMany çağrılır (mediaAsset/smg/kvkk)', async () => {
      const called = new Set<string>()
      prismaMock.$transaction.mockImplementation(trackingTransaction(called))
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({
        ...validBackupData,
        schemaVersion: 4,
        mediaAssets: [{ id: 'm1', fileSizeBytes: '1024' }],
        smgActivities: [{ id: 's1' }],
        kvkkRequests: [{ id: 'k1' }],
        accreditationReports: [{ id: 'r1' }],
      }))

      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(200)
      expect(called.has('mediaAsset')).toBe(true)
      expect(called.has('smgActivity')).toBe(true)
      expect(called.has('kvkkRequest')).toBe(true)
      expect(called.has('accreditationReport')).toBe(true)
    })

    it('v2 backup (v4 alanları undefined): yeni model createMany ÇAĞRILMAZ (mevcut veri korunur)', async () => {
      const called = new Set<string>()
      prismaMock.$transaction.mockImplementation(trackingTransaction(called))
      // validBackupData v4 alanları taşımaz → restore onlara dokunmamalı
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(200)
      expect(called.has('mediaAsset')).toBe(false)
      expect(called.has('scormAttempt')).toBe(false)
      expect(called.has('competencyAnswer')).toBe(false)
    })

    it('preview counts v4 modellerini sayar', async () => {
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({
        ...validBackupData,
        schemaVersion: 4,
        mediaAssets: [{ id: 'm1' }, { id: 'm2' }],
        scormAttempts: [{ id: 'sc1' }],
      }))
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.counts.mediaAssets).toBe(2)
      expect(data.counts.scormAttempts).toBe(1)
      expect(data.counts.kvkkRequests).toBe(0)
    })
  })

  // ─── v5: İK entegrasyon konfigürasyonu (StaffIntegration + IntegrationApiKey) ───
  describe('v5 İK entegrasyon modelleri', () => {
    // tx mock'u: hangi model accessor'ında hangi metodun çağrıldığını "model.metod" olarak kaydeder
    function methodTrackingTransaction(calls: Set<string>) {
      return async (fn: (tx: unknown) => Promise<void>) => {
        const tx = new Proxy({}, {
          get: (_t, prop) => {
            if (prop === '$executeRaw') return vi.fn().mockResolvedValue(1)
            return new Proxy({}, {
              get: (__t, method) => {
                return (arg: { data?: unknown[] }) => {
                  calls.add(`${String(prop)}.${String(method)}`)
                  return Promise.resolve({ count: arg?.data?.length ?? 0 })
                }
              },
            })
          },
        })
        await fn(tx)
      }
    }

    it('v5 backup: staffIntegration + integrationApiKey delete+insert edilir, schemaVersion=5 kabul', async () => {
      const calls = new Set<string>()
      prismaMock.$transaction.mockImplementation(methodTrackingTransaction(calls))
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({
        ...validBackupData,
        schemaVersion: 5,
        staffIntegrations: [{ id: 'si1', organizationId: 'org-1', channel: 'pull', pullCredentialsEncrypted: 'iv:tag:cipher' }],
        integrationApiKeys: [{ id: 'ak1', organizationId: 'org-1', keyHash: 'a'.repeat(64) }],
      }))

      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(200)
      expect(calls.has('staffIntegration.deleteMany')).toBe(true)
      expect(calls.has('staffIntegration.createMany')).toBe(true)
      expect(calls.has('integrationApiKey.deleteMany')).toBe(true)
      expect(calls.has('integrationApiKey.createMany')).toBe(true)
    })

    it('v4 backup (v5 alanları undefined): yine geçerli kabul edilir + entegrasyon tablolarına DOKUNULMAZ', async () => {
      const calls = new Set<string>()
      prismaMock.$transaction.mockImplementation(methodTrackingTransaction(calls))
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({
        ...validBackupData,
        schemaVersion: 4,
        mediaAssets: [{ id: 'm1', fileSizeBytes: '1024' }],
      }))

      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: true }))
      expect(res.status).toBe(200)
      expect(calls.has('staffIntegration.deleteMany')).toBe(false)
      expect(calls.has('staffIntegration.createMany')).toBe(false)
      expect(calls.has('integrationApiKey.deleteMany')).toBe(false)
      expect(calls.has('integrationApiKey.createMany')).toBe(false)
    })

    it('400: v5 alanı array değilse şema geçersiz', async () => {
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({
        ...validBackupData,
        schemaVersion: 5,
        staffIntegrations: 'bozuk-veri',
      }))
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/yapısı geçersiz/i)
    })

    it('preview counts v5 modellerini sayar (yedekte yoksa 0)', async () => {
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({
        ...validBackupData,
        schemaVersion: 5,
        staffIntegrations: [{ id: 'si1' }, { id: 'si2' }],
      }))
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.counts.staffIntegrations).toBe(2)
      expect(data.counts.integrationApiKeys).toBe(0)
    })

    it('400: schemaVersion 6 (v5 kodundan yeni) reddedilir', async () => {
      cryptoMock.decryptBackup.mockReturnValue(JSON.stringify({ ...validBackupData, schemaVersion: 6 }))
      const res = await POST(makeRequest({ backupId: 'backup-1', confirm: false }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/daha yeni|güncelleyin/i)
    })
  })
})
