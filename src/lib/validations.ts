import { z } from 'zod/v4'

// ── Organization ──
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50),
  address: z.string().optional(),
  phone: z.string().max(20).regex(/^\+?[0-9\s\-\(\)]{10,20}$/, 'Geçerli bir telefon numarası girin').optional(),
  email: z.email().optional(),
  logoUrl: z.string().url().optional(),
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
  email: z.string().min(1).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Geçerli bir e-posta adresi girin'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'
  ),
  role: z.enum(['admin', 'staff']),
  organizationId: z.string().uuid().optional(),
  tcNo: z.string().length(11).regex(/^\d{11}$/, 'TC No sadece rakamlardan oluşmalıdır').optional(),
  phone: z.string().max(20).regex(/^\+?[0-9\s\-\(\)]{10,20}$/, 'Geçerli bir telefon numarası girin').optional(),
  department: z.string().max(100).optional(),
  departmentId: z.string().uuid().optional(),
  title: z.string().max(100).optional(),
})

export const updateUserSchema = createUserSchema.omit({ password: true, email: true }).partial()

// ── Training ──
const trainingBaseSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  thumbnailUrl: z.string().url().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  examDurationMinutes: z.coerce.number().int().min(5, 'Sınav süresi en az 5 dakika olmalıdır').max(180).default(30),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
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
  options: z.array(z.string().min(1)).min(2).max(6).refine(opts => new Set(opts).size === opts.length, 'Seçeneklerde tekrar olamaz'),
})

export const createTrainingBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  thumbnailUrl: z.string().url().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  examDurationMinutes: z.coerce.number().int().min(5, 'Sınav süresi en az 5 dakika olmalıdır').max(180).default(30),
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
  })).min(2).refine(opts => new Set(opts.map(o => o.optionText)).size === opts.length, 'Seçeneklerde tekrar olamaz'),
})

// ── Assignment ──
export const createAssignmentSchema = z.object({
  trainingId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1),
  maxAttempts: z.number().int().min(1).max(10).default(3),
})

// ── Exam ──
export const submitExamSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionId: z.string().uuid(),
  })),
  phase: z.enum(['pre', 'post']).optional(),
})

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
  organizationId: z.string().uuid().optional(),
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

// ── Training Video (standalone) ──
export const createTrainingVideoSchema = z.object({
  trainingId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
  videoUrl: z.string().url(),
  videoKey: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  sortOrder: z.number().int().min(0).default(0),
})

// ── Payment ──
export const createPaymentSchema = z.object({
  subscriptionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('TRY'),
  paymentMethod: z.string().max(30).optional(),
})

// ── Invoice ──
export const createInvoiceSchema = z.object({
  paymentId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  invoiceNumber: z.string().min(1).max(30),
  amount: z.number().positive(),
  taxAmount: z.number().min(0).default(0),
  totalAmount: z.number().positive(),
  currency: z.string().length(3).default('TRY'),
  billingName: z.string().min(1).max(255),
  billingAddress: z.string().optional(),
  taxNumber: z.string().max(20).optional(),
  taxOffice: z.string().max(100).optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
})

// ── Exam Answer ──
export const saveExamAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid(),
  examPhase: z.enum(['pre', 'post']),
})

// ── Certificate ──
export const createCertificateSchema = z.object({
  userId: z.string().uuid(),
  trainingId: z.string().uuid(),
  attemptId: z.string().uuid(),
  certificateCode: z.string().min(8).max(50),
  expiresAt: z.string().datetime().optional(),
})

// ── Db Backup ──
export const createBackupSchema = z.object({
  organizationId: z.string().uuid().optional(),
  backupType: z.enum(['auto', 'manual']),
  fileUrl: z.string().url(),
  fileSizeMb: z.number().positive().optional(),
})

// ── KVKK Request ──
export const createKvkkRequestSchema = z.object({
  requestType: z.enum(['access', 'delete', 'rectify', 'restrict', 'portability']),
  description: z.string().min(10).max(2000),
})

export const respondKvkkRequestSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'rejected']),
  responseNote: z.string().min(1).max(2000),
})

// ── SCORM Attempt ──
export const updateScormAttemptSchema = z.object({
  suspendData: z.string().optional(),
  lessonStatus: z.string().max(30).optional(),
  score: z.number().min(0).max(100).optional(),
  totalTime: z.string().max(50).optional(),
  launchData: z.string().optional(),
  completionStatus: z.string().max(30).optional(),
  successStatus: z.string().max(30).optional(),
})

// ── Department Training Rule ──
export const createDeptTrainingRuleSchema = z.object({
  departmentId: z.string().uuid(),
  trainingId: z.string().uuid(),
  isActive: z.boolean().default(true),
})

// ── Settings (Organization) ──
export const updateOrgSettingsSchema = z.object({
  sessionTimeout: z.number().int().min(5).max(480).optional(),
  defaultPassingScore: z.number().int().min(0).max(100).optional(),
  defaultMaxAttempts: z.number().int().min(1).max(10).optional(),
  defaultExamDuration: z.number().int().min(5).max(180).optional(),
})
