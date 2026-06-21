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
  organization: { findUnique: vi.fn().mockResolvedValue(null) },
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
])

const INTENTIONALLY_EXCLUDED = new Set([
  // Global (org-bağımsız) — yedek scope'unda değil
  'SubscriptionPlan',
  'TrainingCategory',
  'AccreditationStandard',
  'ContentLibrary',
  'QuestionBank',
  'QuestionBankOption',

  // Backup sisteminin kendisi — kendi metadata'sını yedeklemez (sonsuz döngü)
  'DbBackup',

  // Finansal — fatura/ödeme süreci ayrı tutuluyor (PCI scope dışı)
  'Payment',
  'Invoice',

  // Workflow / per-org — yedek scope'una alınmadı (kapsamı sonra genişletilebilir)
  'ExamAttemptRequest',
  'TrainingPeriod',
  'KvkkRequest',
  'ScormAttempt',
  'DepartmentTrainingRule',
  'AccreditationReport',

  // SMG (sürekli mesleki gelişim) — ayrı modül, henüz backup scope'unda değil
  'SmgActivity',
  'SmgPeriod',
  'SmgCategory',
  'SmgTarget',

  // Oyunlaştırma Faz 1 (Günün Soruları) — yeni modül, henüz backup scope'unda değil.
  // DailyReview cron ile geçilen sınavlardan yeniden seed edilir (regenerable);
  // DailySubmission Faz 1'de puan/idempotency snapshot'ıdır. Faz 2'de puan kullanıcıya
  // görünür olunca INCLUDED_MODELS'a taşı + BACKUP_SCHEMA_VERSION artır.
  'DailyReview',
  'DailySubmission',

  // Oyunlaştırma Faz 2 (Puan/Streak/Rozet) — yeni modül, henüz backup scope'unda değil.
  // Badge global katalog (org-bağımsız, migration seed'i). PointLedger/UserStreak/UserBadge
  // per-org engagement verisi; puan kullanıcıya görünür olunca INCLUDED'a taşı + schemaVersion artır.
  'PointLedger',
  'UserStreak',
  'Badge',
  'UserBadge',

  // İçerik kütüphanesi link tablosu — global tabloya bağlı
  'OrganizationContentLibrary',

  // Yetkinlik değerlendirme modülü (yeni feature — henüz backup scope'unda değil)
  'CompetencyForm',
  'CompetencyCategory',
  'CompetencyItem',
  'CompetencyEvaluation',
  'CompetencyAnswer',

  // Push bildirim aboneliği (cihaz-spesifik, restore edilmez — kullanıcı yeniden subscribe olur)
  'PushSubscription',
  'ExpoPushToken',
  'ExpoPushTicket',

  // Eğitim geri bildirim formları (yeni feature — henüz backup scope'unda değil)
  'TrainingFeedbackForm',
  'TrainingFeedbackCategory',
  'TrainingFeedbackItem',
  'TrainingFeedbackResponse',
  'TrainingFeedbackAnswer',

  // MFA güvenlik (cihaz-spesifik trust token, restore edilmez)
  'TrustedDevice',

  // Davet (geçici/expire eden link, restore edilmemeli — sahte invite'ı reanimate eder)
  'Invitation',
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

  it('auditLog 90 günlük cutoff ile çekiliyor', async () => {
    await buildBackupSnapshot('org-1')

    const call = prismaMock.auditLog.findMany.mock.calls[0]?.[0] as
      | { where?: { organizationId?: string; createdAt?: { gte?: Date } } }
      | undefined
    expect(call?.where?.organizationId).toBe('org-1')
    expect(call?.where?.createdAt?.gte).toBeInstanceOf(Date)

    const cutoff = call!.where!.createdAt!.gte!.getTime()
    const expected = Date.now() - 90 * 24 * 60 * 60 * 1000
    expect(Math.abs(cutoff - expected)).toBeLessThan(5000) // ±5s tolerans
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
