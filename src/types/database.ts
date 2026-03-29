export type UserRole = 'super_admin' | 'admin' | 'staff';

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'expired' | 'cancelled';

export type AssignmentStatus = 'assigned' | 'in_progress' | 'passed' | 'failed' | 'locked';

export type ExamPhase = 'pre' | 'post';

export type ExamAttemptStatus = 'pre_exam' | 'watching_videos' | 'post_exam' | 'completed';

export type BackupType = 'auto' | 'manual';

export type BillingCycle = 'monthly' | 'annual';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type KvkkRequestType = 'access' | 'delete' | 'rectify' | 'restrict' | 'portability';

export type KvkkRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface User {
  id: string;
  organizationId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  tcNo: string | null;
  phone: string | null;
  department: string | null;
  departmentId: string | null;
  title: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  kvkkConsent: boolean;
  kvkkConsentDate: string | null;
  createdAt: string;
  updatedAt: string;
  departmentRel?: Department | null;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  isActive: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  suspendedAt: string | null;
  sessionTimeout: number;
  defaultPassingScore: number;
  defaultMaxAttempts: number;
  defaultExamDuration: number;
  ssoEnabled: boolean;
  ssoProvider: string | null;
  ssoEmailDomain: string | null;
  samlEntryPoint: string | null;
  samlIssuer: string | null;
  samlCert: string | null;
  oidcDiscoveryUrl: string | null;
  oidcClientId: string | null;
  oidcClientSecret: string | null;
  ssoAutoProvision: boolean;
  ssoDefaultRole: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  maxStaff: number | null;
  maxTrainings: number | null;
  maxStorageGb: number;
  priceMonthly: number | null;
  priceAnnual: number | null;
  features: string[];
  isActive: boolean;
  createdAt: string;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle | null;
  trialEndsAt: string | null;
  startedAt: string;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Training {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnailUrl: string | null;
  passingScore: number;
  maxAttempts: number;
  examDurationMinutes: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCompulsory: boolean;
  complianceDeadline: string | null;
  regulatoryBody: string | null;
  renewalPeriodMonths: number | null;
  scormManifestPath: string | null;
  scormEntryPoint: string | null;
  scormVersion: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingVideo {
  id: string;
  trainingId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  videoKey: string;
  durationSeconds: number;
  sortOrder: number;
  createdAt: string;
}

export interface Question {
  id: string;
  trainingId: string;
  questionText: string;
  questionType: string;
  points: number;
  sortOrder: number;
  options: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  questionId: string;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface TrainingAssignment {
  id: string;
  trainingId: string;
  userId: string;
  status: AssignmentStatus;
  currentAttempt: number;
  maxAttempts: number;
  assignedById: string | null;
  assignedAt: string;
  completedAt: string | null;
}

export interface ExamAttempt {
  id: string;
  assignmentId: string;
  userId: string;
  trainingId: string;
  attemptNumber: number;
  preExamScore: number | null;
  postExamScore: number | null;
  preExamStartedAt: string | null;
  preExamCompletedAt: string | null;
  postExamStartedAt: string | null;
  postExamCompletedAt: string | null;
  videosCompletedAt: string | null;
  isPassed: boolean;
  status: ExamAttemptStatus;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  organizationId: string | null;
  title: string;
  message: string;
  type: string;
  relatedTrainingId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface Certificate {
  id: string;
  userId: string;
  trainingId: string;
  attemptId: string;
  certificateCode: string;
  issuedAt: string;
  expiresAt: string | null;
}

export interface VideoProgress {
  id: string;
  attemptId: string;
  videoId: string;
  userId: string;
  watchedSeconds: number;
  totalSeconds: number;
  isCompleted: boolean;
  lastPositionSeconds: number;
  completedAt: string | null;
  updatedAt: string;
}

export interface Payment {
  id: string;
  subscriptionId: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  iyzicoPaymentId: string | null;
  iyzicoConversationId: string | null;
  cardLastFour: string | null;
  cardBrand: string | null;
  errorMessage: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  paymentId: string;
  subscriptionId: string;
  organizationId: string;
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  billingName: string;
  billingAddress: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
}

export interface ExamAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  examPhase: ExamPhase;
  answeredAt: string;
}

export interface DbBackup {
  id: string;
  organizationId: string | null;
  backupType: BackupType;
  fileUrl: string;
  fileSizeMb: number | null;
  status: string;
  createdById: string | null;
  createdAt: string;
}

export interface KvkkRequest {
  id: string;
  organizationId: string;
  userId: string;
  requestType: KvkkRequestType;
  status: KvkkRequestStatus;
  description: string;
  responseNote: string | null;
  respondedById: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ScormAttempt {
  id: string;
  organizationId: string;
  userId: string;
  trainingId: string;
  attemptId: string;
  suspendData: string | null;
  lessonStatus: string | null;
  score: number | null;
  totalTime: string | null;
  launchData: string | null;
  completionStatus: string | null;
  successStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentTrainingRule {
  id: string;
  departmentId: string;
  trainingId: string;
  organizationId: string;
  isActive: boolean;
  createdAt: string;
}
