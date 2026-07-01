/**
 * 'Deneme Organizasyonu' demo seed — potansiyel müşteriye sistemin çalışma mantığını göstermek için.
 *
 * Idempotent (upsert / findFirst-then-create): tekrar çalıştırmada veri çoğaltmaz, mevcut veriye
 * dokunmaz; yalnızca bu org'a ait demo veriyi EKLER. Şablon: prisma/seed.ts.
 *
 * Çalıştırma (apps/web içinden):
 *   İsteğe bağlı SEED_PASSWORD ortam değişkenini ayarlayıp npx tsx scripts/seed-deneme.ts çalıştırın.
 */
import { randomBytes } from 'node:crypto'
import { config } from 'dotenv'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from '@supabase/supabase-js'
config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Eksik env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY gerekli.')
  process.exit(1)
}
const DEMO_PASSWORD = process.env.SEED_PASSWORD || `Pass${randomBytes(4).toString('hex').toUpperCase()}!1`

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ORG_CODE = 'deneme-org'
const ORG_NAME = 'Deneme Organizasyonu'
const EMAIL_DOMAIN = 'deneme-organizasyonu.com'
// Demo kurum logosu — public/ altındaki paket asset. resolveOrgLogoDataUrl bunu diskten okur,
// böylece hem panel (sol üst) hem tüm PDF'ler S3 yüklemesi olmadan logolu görünür.
const ORG_LOGO = '/logos/devakent.png'

async function ensureSupabaseUser(email: string, metadata: Record<string, string>): Promise<string> {
  // KVKK onayını auth metadata'ya gömüyoruz — yoksa middleware her girişte 'kvkk-required'
  // ile login'e geri atar (demo'da her kullanıcıya modal çıkar). Demo için ön-onaylı.
  const meta = { ...metadata, kvkk_notice_acknowledged_at: new Date().toISOString() }
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)
  if (existingUser) {
    await supabase.auth.admin.updateUserById(existingUser.id, { user_metadata: meta })
    return existingUser.id
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: meta,
  })
  if (error) throw new Error(`Supabase Auth hata (${email}): ${error.message}`)
  return data.user.id
}

const DEPARTMENTS = [
  { name: 'Hemşirelik Hizmetleri', color: '#0d9668', sortOrder: 1 },
  { name: 'Acil Servis', color: '#dc2626', sortOrder: 2 },
  { name: 'Laboratuvar', color: '#7c3aed', sortOrder: 3 },
]

const STAFF = [
  { firstName: 'Ayşe', lastName: 'Yılmaz', title: 'Hemşire', deptIndex: 0 },
  { firstName: 'Mehmet', lastName: 'Demir', title: 'Acil Tıp Teknisyeni', deptIndex: 1 },
  { firstName: 'Fatma', lastName: 'Şahin', title: 'Laboratuvar Teknikeri', deptIndex: 2 },
  { firstName: 'Ali', lastName: 'Çelik', title: 'Hemşire', deptIndex: 0 },
  { firstName: 'Zeynep', lastName: 'Güneş', title: 'Acil Tıp Hemşiresi', deptIndex: 1 },
  { firstName: 'Hüseyin', lastName: 'Aydın', title: 'Biyolog', deptIndex: 2 },
  { firstName: 'Elif', lastName: 'Koç', title: 'Hemşire', deptIndex: 0 },
  { firstName: 'Mustafa', lastName: 'Doğan', title: 'Acil Tıp Teknisyeni', deptIndex: 1 },
]

interface TSeed {
  title: string; description: string; category: string; video: string
  questions: { questionText: string; options: { optionText: string; isCorrect: boolean }[] }[]
}

const TRAININGS: TSeed[] = [
  {
    title: 'El Hijyeni ve Enfeksiyon Kontrolü',
    description: 'Hastane enfeksiyonlarının önlenmesi, el hijyeni ve izolasyon tedbirleri eğitimi.',
    category: 'Enfeksiyon Kontrolü',
    video: 'egitim-el-hijyeni.webm',
    questions: [
      { questionText: 'El hijyeni için en etkili yöntem hangisidir?', options: [
        { optionText: 'Sadece su ile yıkama', isCorrect: false },
        { optionText: 'Alkol bazlı el antiseptiği ile ovma', isCorrect: true },
        { optionText: 'Eldiven giyme', isCorrect: false },
        { optionText: 'Kağıt havlu ile silme', isCorrect: false } ] },
      { questionText: 'Temas izolasyonunda hangi ekipman kullanılır?', options: [
        { optionText: 'Önlük ve eldiven', isCorrect: true },
        { optionText: 'Sadece maske', isCorrect: false },
        { optionText: 'Yalnızca bone', isCorrect: false },
        { optionText: 'Hiçbiri', isCorrect: false } ] },
      { questionText: 'Hastane enfeksiyonlarının en sık bulaşma yolu hangisidir?', options: [
        { optionText: 'Hava yolu', isCorrect: false },
        { optionText: 'Temas yolu (kontamine eller)', isCorrect: true },
        { optionText: 'Kan yolu', isCorrect: false },
        { optionText: 'Yiyecekler', isCorrect: false } ] },
    ],
  },
  {
    title: 'Yangın Güvenliği ve Tahliye',
    description: 'Hastanede yangın önleme, söndürücü kullanımı ve tahliye prosedürleri eğitimi.',
    category: 'İş Güvenliği',
    video: 'egitim-yangin-guvenligi.webm',
    questions: [
      { questionText: 'Yangın söndürücü kullanırken doğru sıralama hangisidir?', options: [
        { optionText: 'Çek - Sık - Nişan al - Süpür (ÇSNS)', isCorrect: true },
        { optionText: 'Sık - Çek - Süpür - Nişan al', isCorrect: false },
        { optionText: 'Nişan al - Çek - Sık - Süpür', isCorrect: false },
        { optionText: 'Süpür - Nişan al - Çek - Sık', isCorrect: false } ] },
      { questionText: 'Yangın çıktığında ilk yapılması gereken nedir?', options: [
        { optionText: 'Yangın söndürücüyü almak', isCorrect: false },
        { optionText: 'Yangın ihbar butonuna basmak', isCorrect: true },
        { optionText: 'Pencereyi açmak', isCorrect: false },
        { optionText: 'Asansörü kullanmak', isCorrect: false } ] },
      { questionText: 'Tahliye sırasında asansör neden kullanılmaz?', options: [
        { optionText: 'Yavaş olduğu için', isCorrect: false },
        { optionText: 'Elektrik kesilirse mahsur kalınabilir', isCorrect: true },
        { optionText: 'Kapasitesi az olduğu için', isCorrect: false },
        { optionText: 'Gürültülü olduğu için', isCorrect: false } ] },
    ],
  },
]

async function main() {
  console.log('\n=== Deneme Organizasyonu — Demo Seed ===\n')

  // 1) ORG
  const org = await prisma.organization.upsert({
    where: { code: ORG_CODE },
    update: { name: ORG_NAME, isActive: true, setupCompleted: true, setupStep: 5, logoUrl: ORG_LOGO },
    create: {
      name: ORG_NAME, code: ORG_CODE, slug: ORG_CODE, logoUrl: ORG_LOGO,
      address: 'Demo Mah., Ankara', phone: '0312 000 00 00', email: `info@${EMAIL_DOMAIN}`,
      setupCompleted: true, setupStep: 5, isActive: true,
      defaultPassingScore: 70, defaultMaxAttempts: 3, defaultExamDuration: 30, sessionTimeout: 30,
    },
  })
  console.log(`[org] ${org.name} (${org.id})`)

  // 2) SUBSCRIPTION (plan + org aboneliği) — app'in tam çalışması için
  const plan = await prisma.subscriptionPlan.upsert({
    where: { slug: 'demo-pro' },
    update: {},
    create: {
      name: 'Profesyonel', slug: 'demo-pro', description: 'Demo plan',
      maxStaff: 500, maxTrainings: 100, maxStorageGb: 50,
      priceMonthly: 499, priceAnnual: 4999,
      features: ['Video eğitim', 'Sınav modülü', 'Raporlama', 'E-posta bildirimleri'], isActive: true,
    },
  })
  await prisma.organizationSubscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id, planId: plan.id, status: 'active', billingCycle: 'annual',
      startedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 864e5),
    },
  })

  // 3) DEPARTMENTS
  const deptIds: string[] = []
  for (const d of DEPARTMENTS) {
    const ex = await prisma.department.findFirst({ where: { organizationId: org.id, name: d.name, parentId: null }, select: { id: true } })
    const dep = ex
      ? await prisma.department.update({ where: { id: ex.id }, data: { color: d.color, sortOrder: d.sortOrder } })
      : await prisma.department.create({ data: { organizationId: org.id, name: d.name, color: d.color, sortOrder: d.sortOrder, isActive: true } })
    deptIds.push(dep.id)
  }
  console.log(`[dept] ${deptIds.length} departman`)

  // 4) ADMIN
  const adminEmail = `admin@${EMAIL_DOMAIN}`
  const adminId = await ensureSupabaseUser(adminEmail, { role: 'admin', organizationId: org.id, firstName: 'Deneme', lastName: 'Yönetici' })
  await prisma.user.upsert({
    where: { id: adminId },
    update: { firstName: 'Deneme', lastName: 'Yönetici', role: 'admin', organizationId: org.id, isActive: true },
    create: {
      id: adminId, email: adminEmail, firstName: 'Deneme', lastName: 'Yönetici', role: 'admin',
      title: 'Kalite Yöneticisi', organizationId: org.id, isActive: true, kvkkNoticeAcknowledgedAt: new Date(),
    },
  })
  console.log(`[admin] ${adminEmail}`)

  // 5) STAFF
  const staffIds: string[] = []
  for (let i = 0; i < STAFF.length; i++) {
    const s = STAFF[i]
    const email = `personel${i + 1}@${EMAIL_DOMAIN}`
    const uid = await ensureSupabaseUser(email, { role: 'staff', organizationId: org.id, firstName: s.firstName, lastName: s.lastName })
    await prisma.user.upsert({
      where: { id: uid },
      update: { firstName: s.firstName, lastName: s.lastName, role: 'staff', organizationId: org.id, departmentId: deptIds[s.deptIndex], title: s.title, isActive: true },
      create: {
        id: uid, email, firstName: s.firstName, lastName: s.lastName, role: 'staff', title: s.title,
        organizationId: org.id, departmentId: deptIds[s.deptIndex], isActive: true, kvkkNoticeAcknowledgedAt: new Date(),
      },
    })
    staffIds.push(uid)
  }
  console.log(`[staff] ${staffIds.length} personel`)

  // 6) TRAININGS + QUESTIONS
  const now = new Date()
  const endDate = new Date(now.getTime() + 180 * 864e5)
  const trainingIds: string[] = []
  for (const t of TRAININGS) {
    let tr = await prisma.training.findFirst({ where: { organizationId: org.id, title: t.title } })
    if (tr) {
      tr = await prisma.training.update({ where: { id: tr.id }, data: { description: t.description, category: t.category, isCompulsory: true, passingScore: 70, maxAttempts: 3, examDurationMinutes: 20, isActive: true, publishStatus: 'published', examOnly: false, startDate: now, endDate, createdById: adminId } })
    } else {
      tr = await prisma.training.create({ data: { organizationId: org.id, title: t.title, description: t.description, category: t.category, isCompulsory: true, passingScore: 70, maxAttempts: 3, examDurationMinutes: 20, isActive: true, publishStatus: 'published', examOnly: false, startDate: now, endDate, createdById: adminId } })
    }
    trainingIds.push(tr.id)
    // Video (lokal /uploads — resolver legacy path'i doğrudan döndürür; S3 gerekmez). Idempotent.
    const vCount = await prisma.trainingVideo.count({ where: { trainingId: tr.id } })
    if (vCount === 0) {
      await prisma.trainingVideo.create({ data: {
        trainingId: tr.id, title: `${t.title} — Tanıtım`,
        videoUrl: `/uploads/${t.video}`, videoKey: '', durationSeconds: 18,
        contentType: 'video', sortOrder: 1,
      } })
    } else {
      await prisma.trainingVideo.updateMany({ where: { trainingId: tr.id }, data: { videoUrl: `/uploads/${t.video}`, videoKey: '', durationSeconds: 18, contentType: 'video' } })
    }
    // Sorular — idempotent (ExamAnswer FK'si yüzünden silinemez → yalnızca yoksa oluştur)
    const qCount = await prisma.question.count({ where: { trainingId: tr.id } })
    if (qCount === 0) {
      for (let qi = 0; qi < t.questions.length; qi++) {
        const q = t.questions[qi]
        const question = await prisma.question.create({ data: { trainingId: tr.id, questionText: q.questionText, questionType: 'multiple_choice', points: 10, sortOrder: qi + 1 } })
        for (let oi = 0; oi < q.options.length; oi++) {
          await prisma.questionOption.create({ data: { questionId: question.id, optionText: q.options[oi].optionText, isCorrect: q.options[oi].isCorrect, sortOrder: oi + 1 } })
        }
      }
    }
    console.log(`[training] ${tr.title} (video + ${t.questions.length} soru)`)
  }

  // 7) ASSIGNMENTS (her 2 eğitim, 8 personel) — durum karışımı
  //    0-3: passed · 4-5: in_progress · 6-7: assigned
  const SCORES = [100, 90, 85, 80]
  const assignedAt = new Date(now.getTime() - 25 * 864e5)
  for (let tIdx = 0; tIdx < trainingIds.length; tIdx++) {
    const trainingId = trainingIds[tIdx]
    for (let si = 0; si < staffIds.length; si++) {
      const userId = staffIds[si]
      const status = si < 4 ? 'passed' : si < 6 ? 'in_progress' : 'assigned'
      const completedAt = status === 'passed' ? new Date(now.getTime() - 10 * 864e5) : null
      const ex = await prisma.trainingAssignment.findFirst({ where: { trainingId, userId } })
      if (ex) {
        await prisma.trainingAssignment.update({ where: { id: ex.id }, data: { status, currentAttempt: status === 'assigned' ? 0 : 1, completedAt } })
      } else {
        await prisma.trainingAssignment.create({ data: {
          trainingId, userId, organizationId: org.id, status,
          currentAttempt: status === 'assigned' ? 0 : 1, maxAttempts: 3,
          assignedById: adminId, assignedAt, completedAt,
        } })
      }
    }
    console.log(`[assign] ${TRAININGS[tIdx].title} → ${staffIds.length} personel`)
  }

  // 8) ATAMA BİLDİRİMLERİ (Eğitim Duyuru Formu'nu besler)
  for (let tIdx = 0; tIdx < trainingIds.length; tIdx++) {
    const trainingId = trainingIds[tIdx]
    const startStr = assignedAt.toLocaleDateString('tr-TR')
    const endStr = endDate.toLocaleDateString('tr-TR')
    for (const userId of staffIds) {
      const exists = await prisma.notification.findFirst({ where: { userId, relatedTrainingId: trainingId, type: 'assignment' } })
      if (!exists) {
        await prisma.notification.create({ data: {
          userId, organizationId: org.id, senderId: adminId,
          title: 'Yeni Eğitim Atandı',
          message: `"${TRAININGS[tIdx].title}" adlı eğitim sizlere atandı. ${startStr} – ${endStr} tarihleri arasında tamamlamanız gerekmektedir.`,
          type: 'assignment', relatedTrainingId: trainingId,
        } })
      }
    }
  }
  console.log('[notif] atama bildirimleri oluşturuldu')

  // 9) SINAV DENEMELERİ + SERTİFİKALAR (passed atamalar için)
  const passedAssigns = await prisma.trainingAssignment.findMany({
    where: { status: 'passed', training: { organizationId: org.id } },
    include: { training: { include: { questions: { include: { options: true } } } } },
  })
  let certCount = 0
  for (const a of passedAssigns) {
    const exAtt = await prisma.examAttempt.findUnique({ where: { assignmentId_attemptNumber: { assignmentId: a.id, attemptNumber: 1 } } })
    if (exAtt) continue
    const completedDate = a.completedAt ?? new Date(now.getTime() - 10 * 864e5)
    const post = SCORES[(certCount + passedAssigns.indexOf(a)) % SCORES.length]
    const attempt = await prisma.examAttempt.create({ data: {
      assignmentId: a.id, userId: a.userId, trainingId: a.trainingId, organizationId: org.id,
      attemptNumber: 1, preExamScore: 60, postExamScore: post,
      preExamStartedAt: new Date(completedDate.getTime() - 60 * 6e4),
      preExamCompletedAt: new Date(completedDate.getTime() - 50 * 6e4),
      postExamStartedAt: new Date(completedDate.getTime() - 20 * 6e4),
      postExamCompletedAt: completedDate, videosCompletedAt: new Date(completedDate.getTime() - 30 * 6e4),
      isPassed: true, status: 'completed',
    } })
    for (const q of a.training.questions) {
      const correct = q.options.find((o) => o.isCorrect)
      if (!correct) continue
      for (const phase of ['pre', 'post'] as const) {
        await prisma.examAnswer.upsert({
          where: { attemptId_questionId_examPhase: { attemptId: attempt.id, questionId: q.id, examPhase: phase } },
          update: {},
          create: { attemptId: attempt.id, questionId: q.id, selectedOptionId: correct.id, isCorrect: true, examPhase: phase },
        })
      }
    }
    if (certCount < 3) {
      const certCode = `DENEME-${now.getFullYear()}-${String(certCount + 1).padStart(4, '0')}`
      const exCert = await prisma.certificate.findUnique({ where: { certificateCode: certCode } })
      if (!exCert) {
        await prisma.certificate.create({ data: {
          userId: a.userId, trainingId: a.trainingId, attemptId: attempt.id, organizationId: org.id,
          certificateCode: certCode, issuedAt: completedDate, expiresAt: new Date(completedDate.getTime() + 365 * 864e5),
        } })
        certCount++
      }
    }
  }
  console.log(`[exam] ${passedAssigns.length} sınav denemesi · ${certCount} sertifika`)

  console.log('\n=== TAMAM ===')
  console.log(JSON.stringify({
    org: ORG_NAME, code: ORG_CODE, departman: DEPARTMENTS.length,
    egitim: TRAININGS.length, personel: STAFF.length, sertifika: certCount,
    admin: adminEmail, personelMail: `personel1..${STAFF.length}@${EMAIL_DOMAIN}`, sifre: DEMO_PASSWORD,
  }, null, 2))
}

main()
  .catch((e) => { console.error('Seed hatası:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
