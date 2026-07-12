import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * SCHEMA DRIFT GUARD — Bulgu #4
 *
 * `snapshot.ts` MANUEL bir listeyle 12 üst-düzey alan (Organization, User, Training, ...)
 * + Training içinde nested 3 alan (videos, questions, options) yedekler. schema.prisma'ya
 * yeni bir model eklenirse otomatik dahil edilmez — bu test geliştiriciyi PR aşamasında uyarır.
 *
 * Yeni model eklediğinde aşağıdaki iki listeden BİRİNE eklemek ZORUNLU:
 *  • INCLUDED_MODELS         → yedek payload'ına dahil edilecek per-org veri
 *  • INTENTIONALLY_EXCLUDED  → bilinçli dışarıda bırakılan model (gerekçe yorumla)
 *
 * Yedeğe dahil etmeyi UNUTMAK = restore sonrası sessiz veri kaybı.
 */

const prismaMock = vi.hoisted(() => ({
  // dataRetentionDays: 200 → auditLog cutoff'unun org ayarından okunduğunu doğrular (eskiden 90g sabitti)
  organization: { findUnique: vi.fn().mockResolvedValue({ dataRetentionDays: 200 }) },
  organizationSubscription: { findUnique: vi.fn().mockResolvedValue(null) },
  user: { findMany: vi.fn().mockResolvedValue([]) },
  department: { findMany: vi.fn().mockResolvedValue([]) },
  training: { findMany: vi.fn().mockResolvedValue([]) },
  trainingAssignment: { findMany: vi.fn().mockResolvedValue([]) },
  examAttempt: { findMany: vi.fn().mockResolvedValue([]) },
  examAnswer: { findMany: vi.fn().mockResolvedValue([]) },
  videoProgress: { findMany: vi.fn().mockResolvedValue([]) },
  notification: { findMany: vi.fn().mockResolvedValue([]) },
  certificate: { findMany: vi.fn().mockResolvedValue([]) },
  auditLog: { findMany: vi.fn().mockResolvedValue([]) },
  // v4 kapsam modelleri
  mediaAsset: { findMany: vi.fn().mockResolvedValue([]) },
  trainingCategory: { findMany: vi.fn().mockResolvedValue([]) },
  trainingPeriod: { findMany: vi.fn().mockResolvedValue([]) },
  scormAttempt: { findMany: vi.fn().mockResolvedValue([]) },
  trainingFeedbackForm: { findMany: vi.fn().mockResolvedValue([]) },
  trainingFeedbackCategory: { findMany: vi.fn().mockResolvedValue([]) },
  trainingFeedbackItem: { findMany: vi.fn().mockResolvedValue([]) },
  trainingFeedbackResponse: { findMany: vi.fn().mockResolvedValue([]) },
  trainingFeedbackAnswer: { findMany: vi.fn().mockResolvedValue([]) },
  smgPeriod: { findMany: vi.fn().mockResolvedValue([]) },
  smgCategory: { findMany: vi.fn().mockResolvedValue([]) },
  smgActivity: { findMany: vi.fn().mockResolvedValue([]) },
  smgTarget: { findMany: vi.fn().mockResolvedValue([]) },
  accreditationStandard: { findMany: vi.fn().mockResolvedValue([]) },
  accreditationReport: { findMany: vi.fn().mockResolvedValue([]) },
  departmentTrainingRule: { findMany: vi.fn().mockResolvedValue([]) },
  questionBank: { findMany: vi.fn().mockResolvedValue([]) },
  questionBankOption: { findMany: vi.fn().mockResolvedValue([]) },
  competencyForm: { findMany: vi.fn().mockResolvedValue([]) },
  competencyCategory: { findMany: vi.fn().mockResolvedValue([]) },
  competencyItem: { findMany: vi.fn().mockResolvedValue([]) },
  competencyEvaluation: { findMany: vi.fn().mockResolvedValue([]) },
  competencyAnswer: { findMany: vi.fn().mockResolvedValue([]) },
  examAttemptRequest: { findMany: vi.fn().mockResolvedValue([]) },
  kvkkRequest: { findMany: vi.fn().mockResolvedValue([]) },
  dailyReview: { findMany: vi.fn().mockResolvedValue([]) },
  dailySubmission: { findMany: vi.fn().mockResolvedValue([]) },
  // v5 — İK entegrasyon konfigürasyonu
  staffIntegration: { findMany: vi.fn().mockResolvedValue([]) },
  integrationApiKey: { findMany: vi.fn().mockResolvedValue([]) },
  // v6 — ortak personel üyelikleri
  organizationMembership: { findMany: vi.fn().mockResolvedValue([]) },
  // auth.users raw sorgusu (includeAuthUsers=true iken)
  $queryRaw: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { buildBackupSnapshot, BACKUP_SCHEMA_VERSION } from '../snapshot'

const INCLUDED_MODELS = new Set([
  'Organization',
  'OrganizationSubscription',
  'User',
  'Department',
  'Training',
  'TrainingVideo',   // nested under Training
  'Question',        // nested under Training
  'QuestionOption',  // nested under Training.questions
  'TrainingAssignment',
  'ExamAttempt',
  'ExamAnswer',
  'VideoProgress',
  'Notification',
  'Certificate',
  'AuditLog',
  // ── v4 kapsam genişlemesi (27 model) ──
  'MediaAsset',
  'ScormAttempt',
  'TrainingFeedbackForm',
  'TrainingFeedbackCategory',
  'TrainingFeedbackItem',
  'TrainingFeedbackResponse',
  'TrainingFeedbackAnswer',
  'SmgActivity',
  'SmgCategory',
  'SmgPeriod',
  'SmgTarget',
  'AccreditationStandard',
  'AccreditationReport',
  'DepartmentTrainingRule',
  'TrainingCategory',
  'TrainingPeriod',
  'QuestionBank',
  'QuestionBankOption',
  'CompetencyForm',
  'CompetencyCategory',
  'CompetencyItem',
  'CompetencyEvaluation',
  'CompetencyAnswer',
  'ExamAttemptRequest',
  'DailyReview',
  'DailySubmission',
  'KvkkRequest',
  // ── v5: İK entegrasyon konfigürasyonu (per-org; restore sonrası hastanenin İK/HBYS
  // entegrasyonu ve API anahtarları çalışmaya devam etmeli). StaffIntegration'ın
  // pullCredentialsEncrypted alanı AES-256-GCM şifreli (ENCRYPTION_KEY olmadan açılmaz);
  // IntegrationApiKey yalnız SHA-256 hash taşır, düz anahtar yok. ──
  'StaffIntegration',
  'IntegrationApiKey',
  // ── v6: ortak personel üyelikleri (çok-hastaneli grup). Per-org (org silinince cascade);
  // restore'da yoksa ortak personelin bu hastanedeki üyeliği/eğitim görünürlüğü kaybolurdu. ──
  'OrganizationMembership',
])

const INTENTIONALLY_EXCLUDED = new Set([
  // Global / platform (org-bağımsız) — per-org yedek scope'unda değil
  'SubscriptionPlan',
  'Badge', // global rozet kataloğu (migration seed'i, org-bağımsız)
  // Hastane grubu — birden çok org'u KAPSAYAN üst-katman entity (çok-hastaneli müşteri).
  // Tek bir org'un yedeğine ait değil (super_admin yönetir). Organization.groupId kolonu
  // zaten Organization satırıyla (INCLUDED) yedeklenir → restore'da grup varsa bağ korunur.
  'OrganizationGroup',
  // On-prem platform lisansı — kuruluma (instance) bağlıdır, org verisi DEĞİL;
  // yedeğe girse başka kuruluma restore'da lisans/instanceId taşınırdı (kötüye
  // kullanım + SaaS anomali takibinin kirlenmesi). Kayıpta yeniden aktivasyon yeterli.
  'PlatformLicense',
  // Lisans sunucusu (SaaS platform-düzeyi) — org verisi değil; kaynak-of-truth
  // lisans JWT'nin kendisi + super-admin kayıtları, per-org yedek scope'u dışında.
  'License',
  'LicenseActivation',
  'LicenseHeartbeat',

  // İletişim/demo formu mesajları — platform-düzeyi (org-bağımsız, super-admin gelen
  // kutusu). ContactMessage'da organizationId yok → per-org yedek scope'unda değil.
  'ContactMessage',

  // Backup sisteminin kendisi — kendi metadata'sını yedeklemez (sonsuz döngü)
  'DbBackup',

  // Finansal — fatura/ödeme süreci ayrı tutuluyor (PCI scope dışı)
  'Payment',
  'Invoice',

  // Oyunlaştırma Faz 2 (Puan/Streak/Rozet) — kullanıcıya görünür puan henüz yok (internal).
  // Görünür olunca INCLUDED_MODELS'a taşı + BACKUP_SCHEMA_VERSION artır.
  'PointLedger',
  'UserStreak',
  'UserBadge',

  // Cihaz-spesifik — restore edilmez (kullanıcı yeniden subscribe olur / cihazı yeniden güvenilir kılar)
  'PushSubscription',
  'ExpoPushToken',
  'ExpoPushTicket',
  'TrustedDevice',

  // Davet (geçici/expire eden link, restore edilmemeli — sahte invite'ı reanimate eder)
  'Invitation',

  // İK/HBYS senkron TELEMETRİSİ — operasyonel koşu geçmişi, restore değeri yok.
  // KVKK veri-minimizasyonu: SyncRowResult.payloadMasked maskeli de olsa PII izi taşır
  // ve cron/cleanup 90 günde imha eder — yedeğe girse imha edilmiş veriyi reanimate
  // ederdi. Yüksek hacim (satır-bazlı sonuç) yedek boyutunu şişirir. Konfigürasyon
  // (StaffIntegration/IntegrationApiKey) INCLUDED — telemetri değil.
  'SyncRun',
  'SyncRowResult',
])

describe('Backup Snapshot — Schema Drift Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schema.prisma\'daki her model ya INCLUDED ya da INTENTIONALLY_EXCLUDED listesinde olmalı', () => {
    const schemaPath = path.resolve(__dirname, '../../../../prisma/schema.prisma')
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8')
    const modelMatches = schemaContent.match(/^model\s+(\w+)\s+{/gm) ?? []
    const allModels = modelMatches.map(m =>
      m.replace(/^model\s+/, '').replace(/\s+{$/, '')
    )

    const unknown: string[] = []
    for (const model of allModels) {
      if (!INCLUDED_MODELS.has(model) && !INTENTIONALLY_EXCLUDED.has(model)) {
        unknown.push(model)
      }
    }

    expect(
      unknown,
      [
        '',
        `Yeni Prisma model(ler)i tespit edildi: ${unknown.join(', ')}`,
        '',
        'Bu modeller yedek snapshot\'ına dahil edilmedi VE intentionally-excluded listesinde de yok.',
        'Lütfen karar verip:',
        '  • Per-org veri tutuyorsa → src/lib/backup/snapshot.ts\'i güncelle + INCLUDED_MODELS\'a ekle + schemaVersion artır',
        '  • Kasıtlı dışarıda mı → bu testteki INTENTIONALLY_EXCLUDED listesine ekle + neden olduğunu yorumla',
        '',
        'Restore sonrası sessiz veri kaybını engellemek için.',
      ].join('\n')
    ).toEqual([])
  })

  it('INCLUDED ve INTENTIONALLY_EXCLUDED listelerinde duplicate yok', () => {
    const intersection = [...INCLUDED_MODELS].filter(m => INTENTIONALLY_EXCLUDED.has(m))
    expect(
      intersection,
      `Model(ler) hem dahil hem hariç listesinde: ${intersection.join(', ')}`
    ).toEqual([])
  })

  it('buildBackupSnapshot tüm beklenen alanları payload\'a koyar', async () => {
    const result = await buildBackupSnapshot('org-1', { organizationName: 'Test Hastanesi' })

    expect(result).toHaveProperty('organization')
    expect(result).toHaveProperty('subscription')
    expect(result).toHaveProperty('users')
    expect(result).toHaveProperty('departments')
    expect(result).toHaveProperty('trainings')
    expect(result).toHaveProperty('assignments')
    expect(result).toHaveProperty('attempts')
    expect(result).toHaveProperty('examAnswers')
    expect(result).toHaveProperty('videoProgress')
    expect(result).toHaveProperty('notifications')
    expect(result).toHaveProperty('certificates')
    expect(result).toHaveProperty('auditLogs')

    expect(result.organizationId).toBe('org-1')
    expect(result.organizationName).toBe('Test Hastanesi')
    expect(result.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(typeof result.exportedAt).toBe('string')
  })

  it('v4 payload 27 kapsam modelinin TAMAMINI içerir', async () => {
    const result = await buildBackupSnapshot('org-1') as Record<string, unknown>
    const v4Keys = [
      'mediaAssets', 'trainingCategories', 'trainingPeriods', 'scormAttempts',
      'trainingFeedbackForms', 'trainingFeedbackCategories', 'trainingFeedbackItems',
      'trainingFeedbackResponses', 'trainingFeedbackAnswers',
      'smgPeriods', 'smgCategories', 'smgActivities', 'smgTargets',
      'accreditationStandards', 'accreditationReports', 'departmentTrainingRules',
      'questionBanks', 'questionBankOptions',
      'competencyForms', 'competencyCategories', 'competencyItems', 'competencyEvaluations', 'competencyAnswers',
      'examAttemptRequests', 'kvkkRequests', 'dailyReviews', 'dailySubmissions',
    ]
    expect(v4Keys).toHaveLength(27)
    for (const k of v4Keys) {
      expect(result[k], `v4 model ${k} snapshot payload'ında eksik`).toBeDefined()
    }
  })

  it('v5 payload İK entegrasyon konfigürasyonunu içerir', async () => {
    const result = await buildBackupSnapshot('org-1') as Record<string, unknown>
    for (const k of ['staffIntegrations', 'integrationApiKeys']) {
      expect(result[k], `v5 model ${k} snapshot payload'ında eksik`).toBeDefined()
    }
    // Org-scope: her iki sorgu da organizationId filtresiyle çağrılmalı (multi-tenant izolasyon)
    expect(prismaMock.staffIntegration.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } })
    expect(prismaMock.integrationApiKey.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } })
  })

  it('v6 payload ortak personel üyeliklerini içerir (org-scope) + schemaVersion=6', async () => {
    const result = await buildBackupSnapshot('org-1') as Record<string, unknown>
    expect(result.organizationMemberships, 'v6 organizationMemberships snapshot payload\'ında eksik').toBeDefined()
    expect(prismaMock.organizationMembership.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } })
    expect(result.schemaVersion).toBe(6)
  })

  it('training.findMany nested videos/questions/options include eder (nested drift\'i de yakala)', async () => {
    await buildBackupSnapshot('org-1')

    const call = prismaMock.training.findMany.mock.calls[0]?.[0] as
      | { include?: Record<string, unknown> }
      | undefined
    expect(call?.include).toBeDefined()
    expect(call!.include).toHaveProperty('videos')
    expect(call!.include).toHaveProperty('questions')

    const questionsInclude = (call!.include?.questions as { include?: Record<string, unknown> } | undefined)?.include
    expect(questionsInclude).toHaveProperty('options')
  })

  it('auditLog cutoff org dataRetentionDays\'ten okunur (90g sabit DEĞİL)', async () => {
    await buildBackupSnapshot('org-1')

    const call = prismaMock.auditLog.findMany.mock.calls[0]?.[0] as
      | { where?: { organizationId?: string; createdAt?: { gte?: Date } } }
      | undefined
    expect(call?.where?.organizationId).toBe('org-1')
    expect(call?.where?.createdAt?.gte).toBeInstanceOf(Date)

    const cutoff = call!.where!.createdAt!.gte!.getTime()
    // Mock org.dataRetentionDays = 200 → cutoff 200 gün önce (eskiden hardcoded 90g idi)
    const expected = Date.now() - 200 * 24 * 60 * 60 * 1000
    expect(Math.abs(cutoff - expected)).toBeLessThan(5000) // ±5s tolerans
  })

  it('includeAuthUsers=true → authUsers payload\'a eklenir + auth.users sorgusu çalışır', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.c', encrypted_password: '$2a$hash' },
    ])
    const result = await buildBackupSnapshot('org-1', { includeAuthUsers: true }) as Record<string, unknown>

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(result.authUsers).toBeDefined()
    expect(Array.isArray(result.authUsers)).toBe(true)
    expect((result.authUsers as unknown[]).length).toBe(1)
  })

  it('includeAuthUsers verilmezse authUsers payload\'a EKLENMEZ + auth.users sorgusu çalışmaz', async () => {
    const result = await buildBackupSnapshot('org-1') as Record<string, unknown>

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    expect('authUsers' in result).toBe(false)
  })

  it('exportedAt opsiyonu pas edildiğinde aynen kullanılır (test/fallback determinism)', async () => {
    const fixed = new Date('2026-05-16T12:00:00Z')
    const result = await buildBackupSnapshot('org-1', { exportedAt: fixed })
    expect(result.exportedAt).toBe(fixed.toISOString())
  })

  it('organizationName opsiyonu yoksa output\'ta görünmez', async () => {
    const result = await buildBackupSnapshot('org-1') as Record<string, unknown>
    expect(result.organizationName).toBeUndefined()
  })
})
