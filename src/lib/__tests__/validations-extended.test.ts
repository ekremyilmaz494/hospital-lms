import { describe, it, expect } from 'vitest'
import {
  createTrainingVideoSchema,
  createPaymentSchema,
  createInvoiceSchema,
  saveExamAnswerSchema,
  createCertificateSchema,
  createBackupSchema,
  createKvkkRequestSchema,
  respondKvkkRequestSchema,
  updateScormAttemptSchema,
  createDeptTrainingRuleSchema,
  updateOrgSettingsSchema,
} from '../validations'

const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('createTrainingVideoSchema', () => {
  const validVideo = {
    trainingId: UUID,
    title: 'Enfeksiyon Kontrol Egitimi',
    videoUrl: 'https://cdn.example.com/video.mp4',
    videoKey: 'videos/video.mp4',
    durationSeconds: 600,
    sortOrder: 1,
  }

  it('accepts a valid video', () => {
    const result = createTrainingVideoSchema.safeParse(validVideo)
    expect(result.success).toBe(true)
  })

  it('rejects missing videoUrl', () => {
    const { videoUrl, ...rest } = validVideo
    const result = createTrainingVideoSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing videoKey', () => {
    const { videoKey, ...rest } = validVideo
    const result = createTrainingVideoSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects negative sortOrder', () => {
    const result = createTrainingVideoSchema.safeParse({ ...validVideo, sortOrder: -1 })
    expect(result.success).toBe(false)
  })

  it('defaults sortOrder to 0 when omitted', () => {
    const { sortOrder, ...rest } = validVideo
    const result = createTrainingVideoSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sortOrder).toBe(0)
    }
  })
})

describe('createPaymentSchema', () => {
  const validPayment = {
    subscriptionId: UUID,
    organizationId: UUID,
    amount: 299.99,
  }

  it('accepts a valid payment', () => {
    const result = createPaymentSchema.safeParse(validPayment)
    expect(result.success).toBe(true)
  })

  it('defaults currency to TRY', () => {
    const result = createPaymentSchema.safeParse(validPayment)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency).toBe('TRY')
    }
  })

  it('rejects zero amount', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, amount: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, amount: -50 })
    expect(result.success).toBe(false)
  })

  it('rejects missing subscriptionId', () => {
    const { subscriptionId, ...rest } = validPayment
    const result = createPaymentSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing organizationId', () => {
    const { organizationId, ...rest } = validPayment
    const result = createPaymentSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})

describe('createInvoiceSchema', () => {
  const validInvoice = {
    paymentId: UUID,
    subscriptionId: UUID,
    organizationId: UUID,
    invoiceNumber: 'INV-2026-001',
    amount: 250,
    taxAmount: 45,
    totalAmount: 295,
    currency: 'TRY',
    billingName: 'Ankara Hastanesi A.S.',
    periodStart: '2026-01-01T00:00:00Z',
    periodEnd: '2026-02-01T00:00:00Z',
  }

  it('accepts a valid invoice', () => {
    const result = createInvoiceSchema.safeParse(validInvoice)
    expect(result.success).toBe(true)
  })

  it('rejects invalid periodStart date format', () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, periodStart: 'not-a-date' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid periodEnd date format', () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, periodEnd: '2026-13-99' })
    expect(result.success).toBe(false)
  })

  it('rejects missing billingName', () => {
    const { billingName, ...rest } = validInvoice
    const result = createInvoiceSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects negative totalAmount', () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, totalAmount: -10 })
    expect(result.success).toBe(false)
  })
})

describe('saveExamAnswerSchema', () => {
  const validAnswer = {
    questionId: UUID,
    selectedOptionId: UUID,
    examPhase: 'pre' as const,
  }

  it('accepts a valid answer with pre phase', () => {
    const result = saveExamAnswerSchema.safeParse(validAnswer)
    expect(result.success).toBe(true)
  })

  it('accepts a valid answer with post phase', () => {
    const result = saveExamAnswerSchema.safeParse({ ...validAnswer, examPhase: 'post' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid phase value', () => {
    const result = saveExamAnswerSchema.safeParse({ ...validAnswer, examPhase: 'midterm' })
    expect(result.success).toBe(false)
  })

  it('rejects missing questionId', () => {
    const { questionId, ...rest } = validAnswer
    const result = saveExamAnswerSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing selectedOptionId', () => {
    const { selectedOptionId, ...rest } = validAnswer
    const result = saveExamAnswerSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})

describe('createCertificateSchema', () => {
  const validCert = {
    userId: UUID,
    trainingId: UUID,
    attemptId: UUID,
    certificateCode: 'CERT-2026-ABCD1234',
  }

  it('accepts a valid certificate', () => {
    const result = createCertificateSchema.safeParse(validCert)
    expect(result.success).toBe(true)
  })

  it('accepts certificate with optional expiresAt', () => {
    const result = createCertificateSchema.safeParse({
      ...validCert,
      expiresAt: '2027-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects certificate code shorter than 8 chars', () => {
    const result = createCertificateSchema.safeParse({ ...validCert, certificateCode: 'SHORT' })
    expect(result.success).toBe(false)
  })

  it('rejects missing userId', () => {
    const { userId, ...rest } = validCert
    const result = createCertificateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing trainingId', () => {
    const { trainingId, ...rest } = validCert
    const result = createCertificateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})

describe('createBackupSchema', () => {
  const validBackup = {
    backupType: 'manual' as const,
    fileUrl: 'https://s3.example.com/backup-2026.sql.gz',
  }

  it('accepts a valid manual backup', () => {
    const result = createBackupSchema.safeParse(validBackup)
    expect(result.success).toBe(true)
  })

  it('accepts a valid auto backup', () => {
    const result = createBackupSchema.safeParse({ ...validBackup, backupType: 'auto' })
    expect(result.success).toBe(true)
  })

  it('accepts optional organizationId', () => {
    const result = createBackupSchema.safeParse({ ...validBackup, organizationId: UUID })
    expect(result.success).toBe(true)
  })

  it('rejects invalid backupType', () => {
    const result = createBackupSchema.safeParse({ ...validBackup, backupType: 'incremental' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid fileUrl', () => {
    const result = createBackupSchema.safeParse({ ...validBackup, fileUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})

describe('createKvkkRequestSchema', () => {
  const validRequest = {
    requestType: 'access' as const,
    description: 'Kisisel verilerimin bir kopyasini talep ediyorum.',
  }

  it('accepts a valid KVKK request', () => {
    const result = createKvkkRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
  })

  it('accepts all valid request types', () => {
    const types = ['access', 'delete', 'rectify', 'restrict', 'portability'] as const
    for (const requestType of types) {
      const result = createKvkkRequestSchema.safeParse({ ...validRequest, requestType })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid requestType', () => {
    const result = createKvkkRequestSchema.safeParse({ ...validRequest, requestType: 'export' })
    expect(result.success).toBe(false)
  })

  it('rejects description shorter than 10 chars', () => {
    const result = createKvkkRequestSchema.safeParse({ ...validRequest, description: 'Kisa' })
    expect(result.success).toBe(false)
  })

  it('rejects description longer than 2000 chars', () => {
    const result = createKvkkRequestSchema.safeParse({
      ...validRequest,
      description: 'A'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe('respondKvkkRequestSchema', () => {
  const validResponse = {
    status: 'completed' as const,
    responseNote: 'Talebiniz isleme alinmistir.',
  }

  it('accepts a valid response', () => {
    const result = respondKvkkRequestSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it('accepts all valid status values', () => {
    const statuses = ['in_progress', 'completed', 'rejected'] as const
    for (const status of statuses) {
      const result = respondKvkkRequestSchema.safeParse({ ...validResponse, status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = respondKvkkRequestSchema.safeParse({ ...validResponse, status: 'pending' })
    expect(result.success).toBe(false)
  })

  it('rejects empty responseNote', () => {
    const result = respondKvkkRequestSchema.safeParse({ ...validResponse, responseNote: '' })
    expect(result.success).toBe(false)
  })
})

describe('updateScormAttemptSchema', () => {
  it('accepts a valid SCORM update', () => {
    const result = updateScormAttemptSchema.safeParse({
      lessonStatus: 'completed',
      score: 85,
      totalTime: '00:30:00',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = updateScormAttemptSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects score below 0', () => {
    const result = updateScormAttemptSchema.safeParse({ score: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects score above 100', () => {
    const result = updateScormAttemptSchema.safeParse({ score: 101 })
    expect(result.success).toBe(false)
  })

  it('accepts score at boundaries', () => {
    expect(updateScormAttemptSchema.safeParse({ score: 0 }).success).toBe(true)
    expect(updateScormAttemptSchema.safeParse({ score: 100 }).success).toBe(true)
  })
})

describe('createDeptTrainingRuleSchema', () => {
  const validRule = {
    departmentId: UUID,
    trainingId: UUID,
  }

  it('accepts a valid rule', () => {
    const result = createDeptTrainingRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
  })

  it('defaults isActive to true', () => {
    const result = createDeptTrainingRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(true)
    }
  })

  it('rejects missing departmentId', () => {
    const { departmentId, ...rest } = validRule
    const result = createDeptTrainingRuleSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing trainingId', () => {
    const { trainingId, ...rest } = validRule
    const result = createDeptTrainingRuleSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid uuid for departmentId', () => {
    const result = createDeptTrainingRuleSchema.safeParse({ ...validRule, departmentId: 'not-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('updateOrgSettingsSchema', () => {
  it('accepts valid settings', () => {
    const result = updateOrgSettingsSchema.safeParse({
      sessionTimeout: 30,
      defaultPassingScore: 70,
      defaultMaxAttempts: 3,
      defaultExamDuration: 60,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = updateOrgSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects sessionTimeout below minimum (5)', () => {
    const result = updateOrgSettingsSchema.safeParse({ sessionTimeout: 2 })
    expect(result.success).toBe(false)
  })

  it('rejects sessionTimeout above maximum (480)', () => {
    const result = updateOrgSettingsSchema.safeParse({ sessionTimeout: 500 })
    expect(result.success).toBe(false)
  })

  it('accepts sessionTimeout at boundaries', () => {
    expect(updateOrgSettingsSchema.safeParse({ sessionTimeout: 5 }).success).toBe(true)
    expect(updateOrgSettingsSchema.safeParse({ sessionTimeout: 480 }).success).toBe(true)
  })

  it('accepts partial settings', () => {
    const result = updateOrgSettingsSchema.safeParse({ defaultPassingScore: 80 })
    expect(result.success).toBe(true)
  })
})
