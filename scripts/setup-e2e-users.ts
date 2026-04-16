/**
 * E2E test ortamı kurulumu.
 *
 * - "E2E Test Hastanesi" organization (+ trial subscription)
 * - 3 test user: admin / staff / super_admin (emailConfirm: true)
 * - Idempotent: mevcut user/org varsa skip eder
 *
 * Kullanım: pnpm tsx scripts/setup-e2e-users.ts
 */
import 'dotenv/config'
// .env.local'i de yükle (prisma import etmeden önce)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local', override: true })

// Production ortamında çalıştırılması fatal hata; yanlış DATABASE_URL ile
// canlı veriye test kullanıcısı sızdırmayı engeller.
if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  console.error('❌ E2E setup production ortamında çalıştırılamaz. NODE_ENV=development ile çalıştırın.')
  process.exit(1)
}

const ORG_NAME = 'E2E Test Hastanesi'
const ORG_CODE = 'E2E-TEST-001'

const USERS = {
  admin: {
    email: 'e2e-admin@test.local',
    password: 'E2eTestAdmin123!',
    firstName: 'E2E',
    lastName: 'Admin',
    role: 'admin' as const,
  },
  staff: {
    email: 'e2e-staff@test.local',
    password: 'E2eTestStaff123!',
    firstName: 'E2E',
    lastName: 'Staff',
    role: 'staff' as const,
  },
  superAdmin: {
    email: 'e2e-super@test.local',
    password: 'E2eTestSuper123!',
    firstName: 'E2E',
    lastName: 'SuperAdmin',
    role: 'super_admin' as const,
  },
}

async function main() {
  // Dynamic import — dotenv yüklendikten sonra prisma init olsun
  const { prisma } = await import('../src/lib/prisma')
  const { createAuthUser, AuthUserError, DbUserError } = await import('../src/lib/auth-user-factory')

  console.log('E2E test ortamı kuruluyor...\n')

  // ── Organization ──
  let org = await prisma.organization.findUnique({ where: { code: ORG_CODE } })
  if (org) {
    console.log(`✓ Organization mevcut: ${org.id}`)
  } else {
    org = await prisma.organization.create({
      data: {
        name: ORG_NAME,
        code: ORG_CODE,
        email: USERS.admin.email,
        setupCompleted: true,
      },
    })
    const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })
    if (plan) {
      const trialEndsAt = new Date()
      trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 10)
      await prisma.organizationSubscription.create({
        data: { organizationId: org.id, planId: plan.id, status: 'trial', trialEndsAt, billingCycle: 'monthly' },
      })
    }
    console.log(`✓ Organization oluşturuldu: ${org.id}`)
  }

  // ── Users ──
  async function ensureUser(u: { email: string; password: string; firstName: string; lastName: string; role: 'admin' | 'staff' | 'super_admin' }, orgId?: string) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (existing) {
      console.log(`✓ User mevcut: ${u.email} (${existing.role})`)
      return
    }
    try {
      const base = { email: u.email, password: u.password, firstName: u.firstName, lastName: u.lastName, emailConfirm: true }
      if (u.role === 'super_admin') {
        await createAuthUser({ ...base, role: 'super_admin' })
      } else {
        await createAuthUser({ ...base, role: u.role, organizationId: orgId!, isActive: true })
      }
      console.log(`✓ User oluşturuldu: ${u.email} (${u.role})`)
    } catch (err) {
      if (err instanceof AuthUserError || err instanceof DbUserError) {
        console.error(`✗ ${u.email}: ${err.message}`)
      } else throw err
    }
  }

  await ensureUser(USERS.admin, org.id)
  await ensureUser(USERS.staff, org.id)
  await ensureUser(USERS.superAdmin)

  console.log('\n✓ Kurulum tamam.\n')
  console.log('GitHub Actions secrets:')
  console.log(`  E2E_ADMIN_EMAIL=${USERS.admin.email}`)
  console.log(`  E2E_ADMIN_PASSWORD=${USERS.admin.password}`)
  console.log(`  E2E_STAFF_EMAIL=${USERS.staff.email}`)
  console.log(`  E2E_STAFF_PASSWORD=${USERS.staff.password}`)
  console.log(`  E2E_SUPER_EMAIL=${USERS.superAdmin.email}`)
  console.log(`  E2E_SUPER_PASSWORD=${USERS.superAdmin.password}`)

  await prisma.$disconnect()
}

// PgPool bağlantısı $disconnect sonrası event loop'u bloklar — process.exit ile zorla kapat
main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Hata:', err); process.exit(1) })
