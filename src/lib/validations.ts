import { z } from 'zod/v4'

/**
 * Türkiye Cumhuriyeti Kimlik Numarası (TCKN) doğrulama algoritması.
 *
 * Kurallar:
 *  1. 11 rakamdan oluşur, tümü sayısal
 *  2. İlk rakam 0 olamaz
 *  3. 10. rakam = (7×(d0+d2+d4+d6+d8) − (d1+d3+d5+d7)) mod 10
 *  4. 11. rakam = (d0+d1+…+d9) mod 10
 */
function isValidTCKN(tc: string): boolean {
  if (!/^\d{11}$/.test(tc)) return false
  if (tc[0] === '0') return false
  const d = tc.split('').map(Number)
  const oddSum  = d[0] + d[2] + d[4] + d[6] + d[8]
  const evenSum = d[1] + d[3] + d[5] + d[7]
  const d10 = ((7 * oddSum - evenSum) % 10 + 10) % 10  // +10 handles negative mod
  if (d[9] !== d10) return false
  const totalSum = d[0]+d[1]+d[2]+d[3]+d[4]+d[5]+d[6]+d[7]+d[8]+d[9]
  return d[10] === totalSum % 10
}

// ── Organization ──
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50),
  address: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.email().optional(),
  logoUrl: z.string().url().optional(),
  // Subscription alanları — hastane oluşturmada plan bağlamak için
  planId: z.string().uuid().optional(),
  trialDays: z.number().int().min(0).max(365).default(14),
})

export const updateOrganizationSchema = createOrganizationSchema.partial().extend({
  isActive: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  suspendedReason: z.string().max(500).optional(),
})

// ── Department ──
export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial()

// ── User ──
export const createUserSchema = z.object({
  email: z.string().min(1).max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Geçerli bir e-posta adresi girin'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'staff']),
  organizationId: z.string().uuid().optional(),
  tcNo: z.string().length(11).refine(isValidTCKN, { message: 'Geçersiz TC kimlik numarası' }).optional(),
  phone: z.string().max(20).optional(),
  department: z.string().max(100).optional(),
  departmentId: z.string().uuid().optional(),
  title: z.string().max(100).optional(),
}).strict()

export const updateUserSchema = createUserSchema.omit({ password: true, email: true }).partial()

// ── Training ──
const trainingBaseSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  thumbnailUrl: z.string().url().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  examDurationMinutes: z.coerce.number().int().max(180).default(30).transform(v => v < 5 ? 30 : v),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  // G5.4 — Training state machine
  publishStatus: z.enum(['draft', 'published', 'archived']).optional(),
})

export const createTrainingSchema = trainingBaseSchema.refine(
  data => new Date(data.endDate) > new Date(data.startDate),
  { message: 'Bitis tarihi baslangic tarihinden sonra olmali', path: ['endDate'] }
)

export const updateTrainingSchema = trainingBaseSchema.partial().refine(
  data => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) > new Date(data.startDate)
    }
    return true
  },
  { message: 'Bitis tarihi baslangic tarihinden sonra olmali', path: ['endDate'] }
)

// ── Training Wizard Body (videos, questions, assignments) ──
const trainingVideoInputSchema = z.object({
  title: z.string().max(500).optional(),
  url: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
})

const trainingQuestionInputSchema = z.object({
  text: z.string().min(1),
  points: z.coerce.number().int().min(1).default(10),
  correct: z.coerce.number().int().min(-1).transform(v => v < 0 ? 0 : v),
  options: z.array(z.string().min(1)).min(2).max(6),
})

export const createTrainingBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  thumbnailUrl: z.string().url().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  examDurationMinutes: z.coerce.number().int().max(180).default(30).transform(v => v < 5 ? 30 : v),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  // Compliance alanları
  isCompulsory: z.boolean().default(false),
  complianceDeadline: z.string().datetime().nullable().optional(),
  regulatoryBody: z.string().max(200).nullable().optional(),
  renewalPeriodMonths: z.coerce.number().int().min(1).max(120).nullable().optional(),
  videos: z.array(trainingVideoInputSchema).optional(),
  questions: z.array(trainingQuestionInputSchema).optional(),
  selectedDepts: z.array(z.string().uuid()).optional(),
  excludedStaff: z.array(z.string().uuid()).optional(),
}).refine(
  data => new Date(data.endDate) > new Date(data.startDate),
  { message: 'Bitis tarihi baslangic tarihinden sonra olmali', path: ['endDate'] }
)

// ── Question ──
export const createQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['multiple_choice', 'true_false']).default('multiple_choice'),
  points: z.number().int().min(1).default(10),
  sortOrder: z.number().int().default(0),
  options: z.array(z.object({
    optionText: z.string().min(1),
    isCorrect: z.boolean(),
    sortOrder: z.number().int().default(0),
  })).min(2),
})

// ── Assignment ──
export const createAssignmentSchema = z.object({
  trainingId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(5000),  // max toplu atama
  maxAttempts: z.number().int().min(1).max(10).default(3),
}).strict()

// ── Exam ──
export const submitExamSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionId: z.string().uuid(),
  }).strict()).max(200),  // max 200 cevap — DoS koruması
  phase: z.enum(['pre', 'post']).optional(),
}).strict()

// ── Subscription Plan ──
export const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50),
  description: z.string().optional(),
  maxStaff: z.number().int().positive().optional(),
  maxTrainings: z.number().int().positive().optional(),
  maxStorageGb: z.number().int().positive().default(10),
  priceMonthly: z.number().positive().optional(),
  priceAnnual: z.number().positive().optional(),
  features: z.array(z.string()).default([]),
})

export const updatePlanSchema = createPlanSchema.partial()

// ── Subscription ──
export const createSubscriptionSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
  trialEndsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
})

// ── Notification ──
export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(500),
  message: z.string().min(1),
  type: z.string().max(50),
  relatedTrainingId: z.string().uuid().optional(),
})

// ── Video Progress ──
export const updateVideoProgressSchema = z.object({
  watchedSeconds: z.number().int().min(0),
  lastPositionSeconds: z.number().int().min(0),
})
