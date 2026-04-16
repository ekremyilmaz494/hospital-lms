export interface CertUser {
  id: string
  name: string
  email: string
  department: string
  title: string
  initials: string
}

export interface CertTraining {
  id: string
  title: string
  category: string
}

export interface Certificate {
  id: string
  certificateCode: string
  issuedAt: string
  expiresAt: string | null
  isExpired: boolean
  isRevoked: boolean
  revokedAt: string | null
  revocationReason: string | null
  user: CertUser
  training: CertTraining
  score: number
  attemptNumber: number
}

export interface TrainingOption {
  id: string
  title: string
  category: string
  count: number
}

export interface CertStats {
  totalCerts: number
  activeCerts: number
  expiredCerts: number
  revokedCerts: number
  expiringSoon: number
}

export interface CertPageData {
  certificates: Certificate[]
  stats: CertStats
  trainings: TrainingOption[]
  categories: string[]
  trainingsWithoutRenewal: { id: string; title: string }[]
}

export type StatusFilter = 'all' | 'active' | 'expiring' | 'expired' | 'revoked'
export type ViewMode = 'grouped' | 'flat'

export interface CertGroup {
  training: TrainingOption
  certificates: Certificate[]
}

export interface FilterState {
  search: string
  status: StatusFilter
  trainingId: string
  category: string
}

export interface FilterStats {
  visible: number
  active: number
  expired: number
  revoked: number
  expiring: number
}
