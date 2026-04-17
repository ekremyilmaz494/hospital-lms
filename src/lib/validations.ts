import { z } from 'zod/v4'

// ── Self-Service Kayıt ──
export const selfRegisterSchema = z.object({
  hospitalName: z.string().min(2, 'Hastane adı en az 2 karakter olmalıdır').max(255, 'Hastane adı en fazla 255 karakter olabilir'),
  hospitalCode: z.string()
    .min(3, 'Hastane kodu en az 3 karakter olmalıdır')
    .max(20, 'Hastane kodu en fazla 20 karakter olabilir')
    .regex(/^[a-z0-9-]+$/, 'Hastane kodu sadece küçük harf, rakam ve tire içerebilir'),
  address: z.string().max(500, 'Adres en fazla 500 karakter olabilir').optional(),
  phone: z.string().max(20, 'Telefon en fazla 20 karakter olabilir').optional(),
  firstName: z.string().min(2, 'Ad en az 2 karakter olmalıdır').max(100, 'Ad en fazla 100 karakter olabilir'),
  lastName: z.string().min(2, 'Soyad en az 2 karakter olmalıdır').max(100, 'Soyad en fazla 100 karakter olabilir'),
  email: z.email('Geçerli bir e-posta adresi girin'),
  password: z.string()
    .min(8, 'Şifre en az 8 karakter olmalıdır')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
      'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'
    ),
})

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

/** Super Admin hastane + admin hesabı oluşturma */
export const createHospitalWithAdminSchema = createOrganizationSchema.extend({
  adminFirstName: z.string().min(1, 'Admin adı zorunludur').max(100),
  adminLastName: z.string().min(1, 'Admin soyadı zorunludur').max(100),
  adminEmail: z.string().min(1).max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Geçerli bir e-posta adresi girin'),
  adminPassword: z.string().min(8, 'Şifre en az 8 karakter olmalıdır').max(128).optional(),
})

export const updateOrganizationSchema = createOrganizationSchema.partial().extend({
  isActive: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  suspendedReason: z.string().max(500).optional(),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Sadece küçük harf, rakam ve tire kullanılabilir').optional(),
  customDomain: z.string().min(3).max(255).optional(),
})

/** Slug doğrulama şeması — sadece küçük harf, rakam ve tire */
export const slugSchema = z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Sadece küçük harf, rakam ve tire kullanılabilir')

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
  password: z.string().min(8).max(128).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'
  ),
  role: z.enum(['admin', 'staff']),
  organizationId: z.string().uuid({ message: 'Geçersiz organizasyon kimliği' }).optional(),
  phone: z.string().max(20).optional(),
  department: z.string().max(100).optional(),
  departmentId: z.string().uuid({ message: 'Geçersiz departman kimliği' }).optional(),
  title: z.string().max(100).optional(),
}).strict()

export const updateUserSchema = createUserSchema.omit({ password: true, email: true }).partial()

export const passwordSchema = z.string()
  .min(8, 'Şifre en az 8 karakter olmalıdır')
  .max(128, 'Şifre en fazla 128 karakter olabilir')

// ── Training ──
const trainingBaseSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  thumbnailUrl: z.string().url().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  feedbackMandatory: z.coerce.boolean().default(false),
  examDurationMinutes: z.coerce.number().int().min(1).max(180).default(30),
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
  durationSeconds: z.number().int().min(0).optional(),
  contentType: z.enum(['video', 'pdf', 'audio']).default('video'),
  pageCount: z.number().int().positive().optional(),
  documentKey: z.string().optional(),
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
  feedbackMandatory: z.coerce.boolean().default(false),
  examDurationMinutes: z.coerce.number().int().min(1).max(180).default(30),
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
).refine(
  // PDF içerikler son sınava geçişi tetiklemez — bu yüzden eğitimde en az 1 video/ses zorunludur.
  // videos verilmemiş veya boşsa draft kabul edilir; içerik eklendiyse video/ses şartı aranır.
  data => {
    if (!data.videos || data.videos.length === 0) return true
    return data.videos.some(v => v.contentType === 'video' || v.contentType === 'audio')
  },
  { message: 'Eğitimde en az bir video veya ses içeriği bulunmalıdır (PDF tek başına yeterli değildir).', path: ['videos'] }
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
  tabSwitchCount: z.number().int().min(0).max(10000).optional(),
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
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  type: z.string().max(50),
  relatedTrainingId: z.string().uuid().optional(),
})

// ── Video Progress ──
export const updateVideoProgressSchema = z.object({
  watchedSeconds: z.number().int().min(0),
  lastPositionSeconds: z.number().int().min(0),
})

// ── İçerik Kütüphanesi ──
export const contentLibraryCategoryEnum = z.enum([
  'INFECTION_CONTROL',
  'FIRE_SAFETY',
  'PATIENT_RIGHTS',
  'KVKK',
  'OCCUPATIONAL_HEALTH',
  'FIRST_AID',
  'MEDICAL_WASTE',
  'HAND_HYGIENE',
  'WORKPLACE_VIOLENCE',
  'EMERGENCY_PROCEDURES',
])

export const createContentLibrarySchema = z.object({
  title:        z.string().min(1).max(500),
  description:  z.string().optional(),
  category:     contentLibraryCategoryEnum,
  thumbnailUrl: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
  duration:     z.coerce.number().int().min(1).max(480),
  smgPoints:    z.coerce.number().int().min(0).max(100).default(0),
  difficulty:   z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED']),
  targetRoles:  z.array(z.string().min(1)).min(1).max(10),
  isActive:     z.boolean().default(true),
})

export const updateContentLibrarySchema = createContentLibrarySchema.partial()

export const bulkInstallSchema = z.object({
  category: contentLibraryCategoryEnum,
})

// ── SMG ──
export const createSmgPeriodSchema = z.object({
  name: z.string().min(2).max(255),
  startDate: z.string().date(),
  endDate: z.string().date(),
  requiredPoints: z.coerce.number().int().min(1).max(9999),
  isActive: z.boolean().optional().default(true),
}).refine(
  data => new Date(data.endDate) > new Date(data.startDate),
  { message: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır', path: ['endDate'] }
)

// SKS denetimi için her SMG aktivitesinin bir kategoriye bağlı olması zorunludur.
// activityType kategori code'undan türetilir — route katmanında set edilir.
export const createSmgActivitySchema = z.object({
  categoryId: z.string().uuid('Kategori seçmek zorunludur'),
  activityType: z.enum(['EXTERNAL_TRAINING', 'CONFERENCE', 'PUBLICATION', 'COURSE_COMPLETION']).optional(),
  title: z.string().min(2).max(255),
  provider: z.string().max(255).optional(),
  completionDate: z.string().date(),
  smgPoints: z.coerce.number().int().min(1).max(999),
  certificateUrl: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
})

// ── SMG KATEGORİ ŞEMALARI ──
export const createSmgCategorySchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(255),
  code: z.string().min(2).max(50).regex(/^[A-Z_]+$/, 'Sadece büyük harf ve alt çizgi'),
  description: z.string().max(1000).optional(),
  maxPointsPerActivity: z.coerce.number().int().min(1).max(9999).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
})

export const updateSmgCategorySchema = createSmgCategorySchema.partial()

// ── SMG HEDEF ŞEMALARI ──
export const createSmgTargetSchema = z.object({
  periodId: z.string().uuid(),
  unvan: z.string().max(100).optional(),
  userId: z.string().uuid().optional(),
  requiredPoints: z.coerce.number().int().min(1).max(9999),
}).refine(
  data => !(data.unvan && data.userId),
  { message: 'Unvan veya kullanıcı belirtilebilir, ikisi birden olamaz' }
)

export const updateSmgTargetSchema = z.object({
  requiredPoints: z.coerce.number().int().min(1).max(9999),
})

// ── SKS DENETİM RAPORU ŞEMASI ──
export const inspectionReportQuerySchema = z.object({
  periodId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  departmentId: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
})

export const approveSmgActivitySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(500).optional(),
})

export const updateSmgPeriodSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  requiredPoints: z.coerce.number().int().min(1).max(9999).optional(),
  isActive: z.boolean().optional(),
}).refine(
  // Sadece iki tarih de verildiyse schema düzeyinde doğrula.
  // Tek tarih verildiğinde karşılaştırma route katmanında DB'den çekilen değerle yapılır.
  data => !data.startDate || !data.endDate || new Date(data.endDate) > new Date(data.startDate),
  { message: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır', path: ['endDate'] }
)

// ── HIS Entegrasyon ──
export const hisIntegrationSchema = z.object({
  name:         z.string().min(1).max(255),
  baseUrl:      z.string().url('Geçerli bir URL girin'),
  authType:     z.enum(['API_KEY', 'BASIC_AUTH', 'OAUTH2']),
  credentials:  z.record(z.string(), z.string()),
  syncInterval: z.coerce.number().int().min(1).max(1440).default(60),
  fieldMapping: z.record(z.string(), z.string()).default({}),
  isActive:     z.boolean().default(true),
})

export const hisSyncSchema = z.object({
  syncType: z.enum(['STAFF_IMPORT', 'DEPARTMENT_IMPORT', 'FULL_SYNC']).default('STAFF_IMPORT'),
})

export const hisWebhookSchema = z.object({
  event: z.string().min(1).max(100),
  data:  z.unknown(),
})

// ── 360° YETKİNLİK DEĞERLENDİRME ──
export const competencyItemSchema = z.object({
  text: z.string().min(2).max(500),
  description: z.string().max(1000).optional(),
  order: z.coerce.number().int().min(0).default(0),
})

export const competencyCategorySchema = z.object({
  name: z.string().min(2).max(255),
  weight: z.coerce.number().int().min(0).max(100).default(0),
  order: z.coerce.number().int().min(0).default(0),
  items: z.array(competencyItemSchema).min(1).max(20),
})

export const createCompetencyFormSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  targetRole: z.string().max(100).optional(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  isActive: z.boolean().optional().default(true),
  categories: z.array(competencyCategorySchema).min(1).max(10),
})

export const startEvaluationSchema = z.object({
  formId: z.string().uuid(),
  subjectId: z.string().uuid(),
  managerId: z.string().uuid().optional(),
  peerIds: z.array(z.string().uuid()).max(5).default([]),
  subordinateIds: z.array(z.string().uuid()).max(3).default([]),
  includeSelf: z.boolean().default(true),
})

export const submitEvaluationSchema = z.object({
  answers: z.array(z.object({
    itemId: z.string().uuid(),
    score: z.coerce.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  })).min(1),
})

// ── EĞİTİM KATEGORİLERİ ──
export const createTrainingCategorySchema = z.object({
  label: z.string().min(1, 'Kategori adı zorunludur').max(30, 'Kategori adı en fazla 30 karakter olabilir'),
  icon:  z.string().min(1, 'İkon zorunludur').max(30),
  order: z.coerce.number().int().min(0).optional(),
})

export const updateTrainingCategorySchema = z.object({
  label: z.string().min(1).max(30).optional(),
  icon:  z.string().min(1).max(30).optional(),
  order: z.coerce.number().int().min(0).optional(),
})

// ── BAĞIMSIZ SINAV ──
export const createStandaloneExamSchema = z.object({
  title: z.string().min(3, 'Başlık en az 3 karakter olmalı').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  examDurationMinutes: z.coerce.number().int().min(1).max(180).default(30),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isCompulsory: z.boolean().default(false),
  questions: z.array(z.object({
    text: z.string().min(5, 'Soru metni en az 5 karakter olmalı'),
    points: z.coerce.number().int().min(1).max(100).default(10),
    correctOptionIndex: z.coerce.number().int().min(0).max(3),
    options: z.array(z.string().min(1)).length(4, 'Her soru için 4 şık gereklidir'),
  })).min(1, 'En az 1 soru gerekli').max(200),
  selectedDepts: z.array(z.string().uuid()).optional(),
  excludedStaff: z.array(z.string().uuid()).optional(),
  randomizeQuestions: z.boolean().default(false),
  randomQuestionCount: z.coerce.number().int().min(1).optional(),
})

export const updateStandaloneExamSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(10).optional(),
  examDurationMinutes: z.coerce.number().int().min(1).max(180).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isCompulsory: z.boolean().optional(),
  isActive: z.boolean().optional(),
  publishStatus: z.enum(['draft', 'published', 'archived']).optional(),
  randomizeQuestions: z.boolean().optional(),
  randomQuestionCount: z.coerce.number().int().min(1).nullable().optional(),
  questions: z.array(z.object({
    id: z.string().uuid().optional(),
    text: z.string().min(5, 'Soru metni en az 5 karakter olmalı'),
    points: z.coerce.number().int().min(1).max(100).default(10),
    correctOptionIndex: z.coerce.number().int().min(0).max(3),
    options: z.array(z.string().min(1)).length(4, 'Her soru için 4 şık gereklidir'),
  })).max(200).optional(),
})

// ── SORU BANKASI ──
export const createQuestionBankSchema = z.object({
  text: z.string().min(5, 'Soru metni en az 5 karakter olmalı').max(2000),
  category: z.string().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  tags: z.array(z.string().max(50)).max(10).default([]),
  points: z.coerce.number().int().min(1).max(100).default(10),
  options: z.array(z.object({
    text: z.string().min(1, 'Şık metni boş olamaz'),
    isCorrect: z.boolean(),
    order: z.coerce.number().int().min(0),
  })).min(2).max(6),
})

export const updateQuestionBankSchema = z.object({
  text: z.string().min(5).max(2000).optional(),
  category: z.string().min(1).max(100).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  points: z.coerce.number().int().min(1).max(100).optional(),
  options: z.array(z.object({
    text: z.string().min(1),
    isCorrect: z.boolean(),
    order: z.coerce.number().int().min(0),
  })).min(2).max(6).optional(),
})

// ── AI İçerik Stüdyosu ──

export const aiConnectSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  browser: z.enum(['chromium', 'msedge']).default('chromium'),
})

export const aiSourceAddSchema = z.object({
  notebookId: z.string().uuid().optional(),
  title: z.string().min(1).max(500).optional(),
  sourceType: z.enum(['url', 'youtube', 'text']),
  url: z.string().url().max(2000).optional(),
  content: z.string().min(10).max(500000).optional(),
  textTitle: z.string().min(1).max(500).optional(),
}).refine(
  (d) => {
    if (d.sourceType === 'url' || d.sourceType === 'youtube') return !!d.url
    if (d.sourceType === 'text') return !!d.content && !!d.textTitle
    return true
  },
  { message: 'Kaynak türüne göre url veya text alanı zorunludur' }
)

export const aiGenerateSchema = z.object({
  notebookId: z.string().uuid(),
  artifactType: z.enum([
    'audio', 'video', 'slide_deck', 'quiz', 'flashcards',
    'report', 'infographic', 'data_table', 'mind_map',
  ]),
  title: z.string().min(1).max(500),
  instructions: z.string().max(2000).optional(),
  settings: z.record(z.string(), z.string()).optional().default({}),
})

export const aiEvaluateSchema = z.object({
  evaluation: z.enum(['approved', 'rejected']),
  note: z.string().max(1000).optional(),
})

export const aiApproveSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: contentLibraryCategoryEnum,
  difficulty: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED']),
  targetRoles: z.array(z.string().min(1)).min(1).max(10),
  duration: z.coerce.number().int().min(1).max(480),
  smgPoints: z.coerce.number().int().min(0).max(100).default(0),
})

export const aiBulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
})

// ── Hastane Kurulum Sihirbazı ──
export const setupWizardSchema = z.object({
  step: z.number().int().min(1).max(4),
  // Step 1: Hospital info
  name: z.string().min(2).max(255).optional(),
  code: z.string().min(2).max(50).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.email().optional(),
  // Step 2: Departments
  departments: z.array(z.string().min(1).max(100)).min(1).optional(),
  // Step 3: Training defaults
  defaultPassingScore: z.number().int().min(1).max(100).optional(),
  defaultMaxAttempts: z.number().int().min(1).max(10).optional(),
  defaultExamDuration: z.number().int().min(5).max(180).optional(),
  // Step 4: Complete
  complete: z.boolean().optional(),
})

// ── EY.FR.40 EĞİTİM GERİ BİLDİRİM ──

export const feedbackQuestionTypeSchema = z.enum(['likert_5', 'yes_partial_no', 'text'])

/** Staff tarafından gönderilen geri bildirim yanıtı */
export const trainingFeedbackSubmitSchema = z.object({
  attemptId: z.uuid(),
  includeName: z.boolean().default(false),
  answers: z.array(z.object({
    itemId: z.uuid(),
    score: z.number().int().min(1).max(5).optional(),
    textAnswer: z.string().max(2000).optional(),
  })).min(1).max(200),
})

/** Admin form editörü: tüm formu replace eder */
export const trainingFeedbackFormUpsertSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  documentCode: z.string().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
  categories: z.array(z.object({
    id: z.uuid().optional(),
    name: z.string().min(1).max(255),
    order: z.number().int().min(0).max(999),
    items: z.array(z.object({
      id: z.uuid().optional(),
      text: z.string().min(1).max(500),
      questionType: feedbackQuestionTypeSchema,
      isRequired: z.boolean().default(true),
      order: z.number().int().min(0).max(999),
    })).min(0).max(100),
  })).min(1).max(20),
})
