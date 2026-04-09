import type { UserRole } from '@/types/database'

/**
 * Demo authentication helper.
 * Supabase bağlantısı olmadan demo giriş bilgileriyle çalışmayı sağlar.
 * Sadece development ortamında veya Supabase yapılandırılmadığında aktiftir.
 */

const DEMO_PASSWORD = 'demo123456' // secret-scanner-disable-line

export interface DemoUser {
  id: string
  email: string
  role: UserRole
  firstName: string
  lastName: string
  organizationId: string | null
  departmentId: string | null
  department: string | null
  title: string | null
  phone: string | null
  tcNo: string | null
  avatarUrl: string | null
  isActive: boolean
  kvkkConsent: boolean
  kvkkConsentDate: string | null
  createdAt: string
  updatedAt: string
}

const DEMO_USERS: Record<string, DemoUser> = {
  'super@demo.com': {
    id: 'demo-super-admin-00000000',
    email: 'super@demo.com',
    role: 'super_admin',
    firstName: 'Demo',
    lastName: 'Super Admin',
    organizationId: null,
    departmentId: null,
    department: null,
    title: 'Platform Yöneticisi',
    phone: null,
    tcNo: null,
    avatarUrl: null,
    isActive: true,
    kvkkConsent: true,
    kvkkConsentDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'admin@demo.com': {
    id: 'demo-admin-00000000',
    email: 'admin@demo.com',
    role: 'admin',
    firstName: 'Demo',
    lastName: 'Hastane Admin',
    organizationId: 'demo-org-00000000',
    departmentId: null,
    department: null,
    title: 'Eğitim Koordinatörü',
    phone: null,
    tcNo: null,
    avatarUrl: null,
    isActive: true,
    kvkkConsent: true,
    kvkkConsentDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'staff@demo.com': {
    id: 'demo-staff-00000000',
    email: 'staff@demo.com',
    role: 'staff',
    firstName: 'Demo',
    lastName: 'Personel',
    organizationId: 'demo-org-00000000',
    departmentId: 'demo-dept-00000000',
    department: 'Acil Servis',
    title: 'Hemşire',
    phone: null,
    tcNo: null,
    avatarUrl: null,
    isActive: true,
    kvkkConsent: true,
    kvkkConsentDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
}

/** Demo modu aktif mi? Supabase URL yoksa veya placeholder ise demo modundayız. */
export function isDemoMode(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return (
    !supabaseUrl ||
    supabaseUrl === 'https://your-project.supabase.co' ||
    supabaseUrl.includes('your-project')
  )
}

/** Verilen email+password demo kullanıcıya ait mi? */
export function authenticateDemoUser(email: string, password: string): DemoUser | null {
  if (password !== DEMO_PASSWORD) return null
  const normalized = email.trim().toLowerCase()
  return DEMO_USERS[normalized] ?? null
}

/** Demo session cookie değerini oluştur (base64 JSON) */
export function createDemoSessionValue(user: DemoUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64')
}

/** Demo session cookie değerini parse et */
export function parseDemoSession(cookieValue: string): DemoUser | null {
  try {
    const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded) as DemoUser
    // Temel alanların varlığını doğrula
    if (!parsed.id || !parsed.email || !parsed.role) return null
    return parsed
  } catch {
    return null
  }
}

/** Demo session cookie adı */
export const DEMO_SESSION_COOKIE = 'demo-session'

/** Demo kullanıcı listesini döndürür (login sayfasında göstermek için) */
export function getDemoCredentials(): Array<{ email: string; password: string; role: string; label: string }> {
  return [
    { email: 'super@demo.com', password: DEMO_PASSWORD, role: 'super_admin', label: 'Super Admin' },
    { email: 'admin@demo.com', password: DEMO_PASSWORD, role: 'admin', label: 'Hastane Admin' },
    { email: 'staff@demo.com', password: DEMO_PASSWORD, role: 'staff', label: 'Personel' },
  ]
}
