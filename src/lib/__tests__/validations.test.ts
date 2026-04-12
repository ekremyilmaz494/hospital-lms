import { describe, it, expect } from 'vitest'
import {
  createOrganizationSchema,
  createUserSchema,
  createTrainingSchema,
  createQuestionSchema,
  submitExamSchema,
  createPlanSchema,
  trainingFeedbackSubmitSchema,
  trainingFeedbackFormUpsertSchema,
} from '../validations'

describe('createOrganizationSchema', () => {
  it('accepts valid organization', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'Test Hastanesi',
      code: 'TST-001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createOrganizationSchema.safeParse({
      name: '',
      code: 'TST',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'Test',
      code: 'TST',
      phone: '05551234567',
      email: 'test@test.com',
    })
    expect(result.success).toBe(true)
  })
})

describe('createUserSchema', () => {
  it('accepts valid user', () => {
    const result = createUserSchema.safeParse({
      email: 'user@test.com',
      firstName: 'Ali',
      lastName: 'Yilmaz',
      password: 'SecurePass1!',
      role: 'staff',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'invalid',
      firstName: 'Ali',
      lastName: 'Yilmaz',
      password: 'SecurePass1!',
      role: 'staff',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = createUserSchema.safeParse({
      email: 'user@test.com',
      firstName: 'Ali',
      lastName: 'Yilmaz',
      password: '123',
      role: 'staff',
    })
    expect(result.success).toBe(false)
  })

  it('rejects weak password (no complexity)', () => {
    const result = createUserSchema.safeParse({
      email: 'user@test.com',
      firstName: 'Ali',
      lastName: 'Yilmaz',
      password: '12345678',
      role: 'staff',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = createUserSchema.safeParse({
      email: 'user@test.com',
      firstName: 'Ali',
      lastName: 'Yilmaz',
      password: 'SecurePass1!',
      role: 'super_admin',
    })
    expect(result.success).toBe(false)
  })
})

describe('createTrainingSchema', () => {
  it('accepts valid training', () => {
    const result = createTrainingSchema.safeParse({
      title: 'Enfeksiyon Kontrol Egitimi',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-04-30T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('uses defaults', () => {
    const result = createTrainingSchema.safeParse({
      title: 'Test',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-04-30T00:00:00Z',
    })
    if (result.success) {
      expect(result.data.passingScore).toBe(70)
      expect(result.data.maxAttempts).toBe(3)
      expect(result.data.examDurationMinutes).toBe(30)
    }
  })
})

describe('createQuestionSchema', () => {
  it('accepts valid question with options', () => {
    const result = createQuestionSchema.safeParse({
      questionText: 'El yikama suresi kac saniye olmalidir?',
      options: [
        { optionText: '10 saniye', isCorrect: false },
        { optionText: '20 saniye', isCorrect: true },
        { optionText: '5 saniye', isCorrect: false },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects fewer than 2 options', () => {
    const result = createQuestionSchema.safeParse({
      questionText: 'Test?',
      options: [{ optionText: 'Only one', isCorrect: true }],
    })
    expect(result.success).toBe(false)
  })
})

describe('submitExamSchema', () => {
  it('accepts valid exam submission', () => {
    const result = submitExamSchema.safeParse({
      answers: [
        { questionId: '550e8400-e29b-41d4-a716-446655440000', selectedOptionId: '550e8400-e29b-41d4-a716-446655440001' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('createPlanSchema', () => {
  it('accepts valid plan', () => {
    const result = createPlanSchema.safeParse({
      name: 'Profesyonel',
      slug: 'pro',
      maxStaff: 100,
      priceMonthly: 499.99,
    })
    expect(result.success).toBe(true)
  })
})

describe('trainingFeedbackSubmitSchema', () => {
  const validAttemptId = '550e8400-e29b-41d4-a716-446655440000'
  const validItemId = '660e8400-e29b-41d4-a716-446655440001'

  it('geçerli submit payload kabul eder', () => {
    const result = trainingFeedbackSubmitSchema.safeParse({
      attemptId: validAttemptId,
      includeName: true,
      answers: [{ itemId: validItemId, score: 4 }],
    })
    expect(result.success).toBe(true)
  })

  it('UUID olmayan attemptId reddeder', () => {
    const result = trainingFeedbackSubmitSchema.safeParse({
      attemptId: 'not-a-uuid',
      answers: [{ itemId: validItemId, score: 3 }],
    })
    expect(result.success).toBe(false)
  })

  it('skor 1-5 aralığı dışına düşerse reddeder', () => {
    const tooHigh = trainingFeedbackSubmitSchema.safeParse({
      attemptId: validAttemptId,
      answers: [{ itemId: validItemId, score: 6 }],
    })
    expect(tooHigh.success).toBe(false)

    const tooLow = trainingFeedbackSubmitSchema.safeParse({
      attemptId: validAttemptId,
      answers: [{ itemId: validItemId, score: 0 }],
    })
    expect(tooLow.success).toBe(false)
  })

  it('boş answers listesini reddeder', () => {
    const result = trainingFeedbackSubmitSchema.safeParse({
      attemptId: validAttemptId,
      answers: [],
    })
    expect(result.success).toBe(false)
  })

  it('includeName default olarak false', () => {
    const result = trainingFeedbackSubmitSchema.safeParse({
      attemptId: validAttemptId,
      answers: [{ itemId: validItemId, score: 3 }],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.includeName).toBe(false)
  })

  it('textAnswer max 2000 karakter', () => {
    const result = trainingFeedbackSubmitSchema.safeParse({
      attemptId: validAttemptId,
      answers: [{ itemId: validItemId, textAnswer: 'a'.repeat(2001) }],
    })
    expect(result.success).toBe(false)
  })
})

describe('trainingFeedbackFormUpsertSchema', () => {
  const validCategory = {
    name: 'EĞİTİM PROGRAMI',
    order: 0,
    items: [
      { text: 'Soru 1', questionType: 'likert_5' as const, isRequired: true, order: 0 },
    ],
  }

  it('geçerli form kabul eder', () => {
    const result = trainingFeedbackFormUpsertSchema.safeParse({
      title: 'EY.FR.40',
      isActive: true,
      categories: [validCategory],
    })
    expect(result.success).toBe(true)
  })

  it('kategori listesi boşsa reddeder', () => {
    const result = trainingFeedbackFormUpsertSchema.safeParse({
      title: 'EY.FR.40',
      isActive: true,
      categories: [],
    })
    expect(result.success).toBe(false)
  })

  it('başlık boşsa reddeder', () => {
    const result = trainingFeedbackFormUpsertSchema.safeParse({
      title: '',
      isActive: true,
      categories: [validCategory],
    })
    expect(result.success).toBe(false)
  })

  it('geçersiz questionType reddeder', () => {
    const result = trainingFeedbackFormUpsertSchema.safeParse({
      title: 'EY.FR.40',
      isActive: true,
      categories: [{
        ...validCategory,
        items: [{ text: 'S', questionType: 'number', isRequired: true, order: 0 }],
      }],
    })
    expect(result.success).toBe(false)
  })
})
