/**
 * Demo hastane grubu seed'i — çok-hastaneli müşteri özelliğini uçtan uca denemek için.
 *
 * Oluşturur:
 *   • 1 OrganizationGroup ("Klinovax Sağlık Grubu (Demo)")
 *   • 2 hastane (Merkez + Şube), gruba bağlı
 *   • Her hastaneye personel + 1 zorunlu eğitim + atamalar (KPI'lar dolsun)
 *   • 1 grup yöneticisi (esas yönetici) — Supabase auth + DB (giriş yapabilir)
 *
 * Çalıştır:  pnpm exec tsx scripts/seed-group-demo.ts
 * Temizle:   pnpm exec tsx scripts/seed-group-demo.ts --clean
 *
 * NOT: yalnız LOKAL geliştirme içindir (.env.local → 127.0.0.1 Supabase). İdempotent:
 * aynı kodla tekrar çalışınca mevcut grubu bulur/temizleyip yeniden kurar.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { randomUUID } from 'crypto'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- duplicate @types/pg versions cause type mismatch (bkz. src/lib/prisma.ts)
const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const GROUP_CODE = 'demo-saglik-grubu'
const OWNER_EMAIL = 'grup.yonetici@demo-grup.local'
// Yalnız YEREL demo seed'i için sabit parola (gerçek sır DEĞİL, .env.local → 127.0.0.1 Supabase).
// İstenirse GROUP_SEED_PASSWORD env'i ile ezilir. secret-scanner false-positive → disable.
const OWNER_PASSWORD = process.env.GROUP_SEED_PASSWORD || 'GrupYonetici!2026' // secret-scanner-disable-line

async function clean() {
  const group = await prisma.organizationGroup.findUnique({ where: { code: GROUP_CODE }, select: { id: true, ownerUserId: true, organizations: { select: { id: true } } } })
  if (!group) { console.log('Temizlenecek grup yok.'); return }
  for (const org of group.organizations) {
    await prisma.trainingAssignment.deleteMany({ where: { organizationId: org.id } })
    await prisma.training.deleteMany({ where: { organizationId: org.id } })
    await prisma.user.deleteMany({ where: { organizationId: org.id } })
    await prisma.organization.delete({ where: { id: org.id } })
  }
  if (group.ownerUserId) {
    await prisma.user.delete({ where: { id: group.ownerUserId } }).catch(() => {})
    await supabase.auth.admin.deleteUser(group.ownerUserId).catch(() => {})
  }
  await prisma.organizationGroup.delete({ where: { id: group.id } })
  console.log('✅ Demo grup temizlendi.')
}

async function seedHospital(groupId: string, name: string, code: string, staffCount: number, passedCount: number, overdueCount: number, planId: string | null) {
  const org = await prisma.organization.create({
    data: { name, code, groupId, sector: 'healthcare', setupCompleted: true, maxStaff: 100 },
    select: { id: true },
  })
  // Aktif abonelik — aksi halde write-guard (checkWritePermission) her yazmayı "abonelik sona erdi"
  // ile 403'ler (ör. ortak personel provizyonu). Plan yoksa atlanır (yazma testleri için plan seed'le).
  if (planId) {
    await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id, planId, status: 'active', billingCycle: 'yearly',
        startedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000),
      },
    })
  }
  const training = await prisma.training.create({
    data: {
      organizationId: org.id,
      title: 'İş Sağlığı ve Güvenliği (Zorunlu)',
      isCompulsory: true,
      isActive: true,
      publishStatus: 'published',
      passingScore: 70,
      startDate: new Date(Date.now() - 30 * 86400000),
      endDate: new Date(Date.now() - 3 * 86400000), // 3 gün önce bitti (overdue testi)
    },
    select: { id: true },
  })
  const now = new Date()
  for (let i = 0; i < staffCount; i++) {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        email: `personel${i + 1}@${code}.local`,
        firstName: `Personel${i + 1}`,
        lastName: name.split(' ')[0],
        role: 'staff',
        isActive: true,
      },
      select: { id: true },
    })
    const status = i < passedCount ? 'passed' : i < passedCount + overdueCount ? 'assigned' : 'assigned'
    const isOverdue = i >= passedCount && i < passedCount + overdueCount
    await prisma.trainingAssignment.create({
      data: {
        organizationId: org.id,
        trainingId: training.id,
        userId: user.id,
        status,
        assignedAt: now,
        ...(isOverdue ? { dueDate: new Date(Date.now() - 2 * 86400000) } : {}),
      },
    })
  }
  console.log(`  🏥 ${name}: ${staffCount} personel, ${passedCount} geçti, ${overdueCount} geciken`)
  return org.id
}

async function main() {
  if (process.argv.includes('--clean')) { await clean(); return }

  await clean() // idempotent — önce eskiyi temizle

  const group = await prisma.organizationGroup.create({
    data: { name: 'Klinovax Sağlık Grubu (Demo)', code: GROUP_CODE, maxOrganizations: 5 },
    select: { id: true, name: true },
  })
  console.log(`📦 Grup: ${group.name}`)

  // Aktif abonelik için bir plan seç (yoksa null → subscription atlanır; write testleri için plan seed'le).
  const plan = await prisma.subscriptionPlan.findFirst({ select: { id: true } })
  if (!plan) console.warn('⚠️  Abonelik planı yok — demo hastaneleri aboneliksiz kurulur (yazma işlemleri write-guard\'a takılır). Önce plan seed\'leyin.')
  const planId = plan?.id ?? null

  await seedHospital(group.id, 'Demo Merkez Hastanesi', 'demo-merkez', 10, 7, 2, planId)
  await seedHospital(group.id, 'Demo Şube Hastanesi', 'demo-sube', 6, 3, 1, planId)

  // Grup yöneticisi (esas yönetici) — auth + DB.
  const { data: authData, error } = await supabase.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: 'Esas', last_name: 'Yönetici' },
    app_metadata: { role: 'admin', group_owner: true, group_id: group.id },
  })
  if (error || !authData.user) { console.error('Owner auth hatası:', error?.message); throw error }
  await prisma.user.create({
    data: {
      id: authData.user.id,
      email: OWNER_EMAIL,
      firstName: 'Esas',
      lastName: 'Yönetici',
      role: 'admin',
      organizationId: null,
      groupId: group.id,
      isActive: true,
    },
  })
  await prisma.organizationGroup.update({ where: { id: group.id }, data: { ownerUserId: authData.user.id } })
  console.log(`👤 Grup yöneticisi: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`)
  console.log('\n✅ Seed tamam. Giriş yapıp /group/dashboard konsolide panelini görün.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await pool.end() })
