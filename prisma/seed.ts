/**
 * Prisma Seed Script — Hospital LMS Demo Data
 *
 * Idempotent: upsert kullanir, tekrar calistirmada hata vermez.
 *
 * Kullanim:
 *   npx tsx prisma/seed.ts
 *   veya
 *   npx prisma db seed
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from '@supabase/supabase-js'

// ── ENV CHECK ──────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Eksik ortam degiskenleri: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY gerekli.'
  )
  process.exit(1)
}

// ── CLIENTS ────────────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = process.env.SEED_PASSWORD
if (!DEMO_PASSWORD) { console.error('SEED_PASSWORD env değişkeni eksik'); process.exit(1) }

// ── HELPERS ────────────────────────────────────────────────
async function ensureSupabaseUser(
  email: string,
  metadata: Record<string, string>
): Promise<string> {
  // Try to find existing user first
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)

  if (existingUser) {
    // Update metadata if needed
    await supabase.auth.admin.updateUserById(existingUser.id, {
      user_metadata: metadata,
    })
    console.log(`  [Auth] Mevcut kullanici: ${email} (${existingUser.id})`)
    return existingUser.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (error) {
    throw new Error(`Supabase Auth hata (${email}): ${error.message}`)
  }

  console.log(`  [Auth] Yeni kullanici: ${email} (${data.user.id})`)
  return data.user.id
}

// ── SEED DATA ──────────────────────────────────────────────

const ORG_CODE = 'demo-hastane'

const DEPARTMENTS = [
  { name: 'Dahiliye', description: 'Dahiliye (İç Hastalıkları) Bölümü', color: '#0d9668', sortOrder: 1 },
  { name: 'Cerrahi', description: 'Genel Cerrahi Bölümü', color: '#2563eb', sortOrder: 2 },
  { name: 'Acil Servis', description: 'Acil Servis Bölümü', color: '#dc2626', sortOrder: 3 },
  { name: 'Laboratuvar', description: 'Laboratuvar Bölümü', color: '#7c3aed', sortOrder: 4 },
  { name: 'Hemşirelik', description: 'Hemşirelik Hizmetleri Bölümü', color: '#f59e0b', sortOrder: 5 },
]

const STAFF_USERS = [
  { firstName: 'Ahmet', lastName: 'Yılmaz', title: 'Uzman Doktor', deptIndex: 0 },
  { firstName: 'Ayşe', lastName: 'Demir', title: 'Hemşire', deptIndex: 4 },
  { firstName: 'Mehmet', lastName: 'Kaya', title: 'Cerrah', deptIndex: 1 },
  { firstName: 'Fatma', lastName: 'Çelik', title: 'Laboratuvar Teknisyeni', deptIndex: 3 },
  { firstName: 'Mustafa', lastName: 'Şahin', title: 'Acil Tıp Uzmanı', deptIndex: 2 },
  { firstName: 'Zeynep', lastName: 'Arslan', title: 'Hemşire', deptIndex: 4 },
  { firstName: 'Emre', lastName: 'Öztürk', title: 'Dahiliye Uzmanı', deptIndex: 0 },
  { firstName: 'Elif', lastName: 'Koç', title: 'Biyolog', deptIndex: 3 },
  { firstName: 'Burak', lastName: 'Aydın', title: 'Cerrah', deptIndex: 1 },
  { firstName: 'Seda', lastName: 'Yıldız', title: 'Acil Tıp Hemşiresi', deptIndex: 2 },
]

interface TrainingSeed {
  title: string
  description: string
  category: string
  isCompulsory: boolean
  passingScore: number
  maxAttempts: number
  examDurationMinutes: number
  questions: {
    questionText: string
    options: { optionText: string; isCorrect: boolean }[]
  }[]
}

const TRAININGS: TrainingSeed[] = [
  {
    title: 'Enfeksiyon Kontrol Eğitimi',
    description: 'Hastane enfeksiyonlarının önlenmesi, el hijyeni ve izolasyon tedbirleri hakkında temel eğitim.',
    category: 'Enfeksiyon Kontrol',
    isCompulsory: true,
    passingScore: 70,
    maxAttempts: 3,
    examDurationMinutes: 20,
    questions: [
      {
        questionText: 'El hijyeni için en etkili yöntem hangisidir?',
        options: [
          { optionText: 'Sadece su ile yıkama', isCorrect: false },
          { optionText: 'Alkol bazlı el antiseptiği ile ovma', isCorrect: true },
          { optionText: 'Eldiven giyme', isCorrect: false },
          { optionText: 'Kağıt havlu ile silme', isCorrect: false },
        ],
      },
      {
        questionText: 'İzolasyon tedbirlerinde sarı önlük hangi durumda giyilir?',
        options: [
          { optionText: 'Temas izolasyonunda', isCorrect: true },
          { optionText: 'Sadece ameliyathanede', isCorrect: false },
          { optionText: 'Yoğun bakım girişinde', isCorrect: false },
          { optionText: 'Laboratuvar çalışmasında', isCorrect: false },
        ],
      },
      {
        questionText: 'Hastane enfeksiyonlarının en sık bulaşma yolu hangisidir?',
        options: [
          { optionText: 'Hava yolu', isCorrect: false },
          { optionText: 'Kan yolu', isCorrect: false },
          { optionText: 'Temas yolu (kontamine eller)', isCorrect: true },
          { optionText: 'Yiyecek ve içecekler', isCorrect: false },
        ],
      },
    ],
  },
  {
    title: 'Yangın Güvenliği',
    description: 'Hastanede yangın önleme, yangın söndürücü kullanımı ve tahliye prosedürleri eğitimi.',
    category: 'İş Güvenliği',
    isCompulsory: true,
    passingScore: 70,
    maxAttempts: 3,
    examDurationMinutes: 15,
    questions: [
      {
        questionText: 'Yangın söndürücü kullanırken doğru sıralama hangisidir?',
        options: [
          { optionText: 'Çek - Sık - Nişan al - Süpür (ÇSNS)', isCorrect: true },
          { optionText: 'Sık - Çek - Süpür - Nişan al', isCorrect: false },
          { optionText: 'Nişan al - Çek - Sık - Süpür', isCorrect: false },
          { optionText: 'Süpür - Nişan al - Çek - Sık', isCorrect: false },
        ],
      },
      {
        questionText: 'Hastanede yangın çıktığında ilk yapılması gereken nedir?',
        options: [
          { optionText: 'Yangın söndürücüyü almak', isCorrect: false },
          { optionText: 'Yangın ihbar butonuna basmak', isCorrect: true },
          { optionText: 'Pencereyi açmak', isCorrect: false },
          { optionText: 'Asansörü kullanarak kaçmak', isCorrect: false },
        ],
      },
      {
        questionText: 'Tahliye sırasında asansör kullanılmamasının sebebi nedir?',
        options: [
          { optionText: 'Asansör yavaş çalışır', isCorrect: false },
          { optionText: 'Elektrik kesilmesi durumunda asansörde mahsur kalınabilir', isCorrect: true },
          { optionText: 'Asansör kapasitesi yetersizdir', isCorrect: false },
          { optionText: 'Asansör yangına dayanıklı değildir', isCorrect: false },
        ],
      },
    ],
  },
  {
    title: 'Hasta Hakları',
    description: 'Hasta hakları mevzuatı, bilgilendirilmiş onam ve hasta mahremiyeti konularında farkındalık eğitimi.',
    category: 'Hasta Hakları',
    isCompulsory: true,
    passingScore: 70,
    maxAttempts: 3,
    examDurationMinutes: 15,
    questions: [
      {
        questionText: 'Hastanın bilgilendirilmiş onam hakkı kapsamında hangisi doğrudur?',
        options: [
          { optionText: 'Hasta sadece ameliyat öncesi bilgilendirilir', isCorrect: false },
          { optionText: 'Hasta her tıbbi işlem öncesinde bilgilendirilmeli ve onayı alınmalıdır', isCorrect: true },
          { optionText: 'Bilgilendirme sadece yazılı olmalıdır', isCorrect: false },
          { optionText: 'Acil durumlarda onam hiçbir zaman gerekmez', isCorrect: false },
        ],
      },
      {
        questionText: 'Hasta mahremiyeti ile ilgili hangisi yanlıştır?',
        options: [
          { optionText: 'Hasta bilgileri üçüncü kişilerle paylaşılamaz', isCorrect: false },
          { optionText: 'Hasta dosyaları kilitli dolaplarda saklanmalıdır', isCorrect: false },
          { optionText: 'Hasta bilgileri koridorda sesli olarak tartışılabilir', isCorrect: true },
          { optionText: 'Elektronik kayıtlara yetkisiz erişim engellenmelidir', isCorrect: false },
        ],
      },
    ],
  },
  {
    title: 'KVKK Farkındalık',
    description: 'Kişisel Verilerin Korunması Kanunu kapsamında sağlık verilerinin işlenmesi ve güvenliği eğitimi.',
    category: 'Hukuk ve Uyum',
    isCompulsory: true,
    passingScore: 70,
    maxAttempts: 3,
    examDurationMinutes: 15,
    questions: [
      {
        questionText: 'KVKK kapsamında sağlık verisi hangi kategoride değerlendirilir?',
        options: [
          { optionText: 'Genel kişisel veri', isCorrect: false },
          { optionText: 'Özel nitelikli kişisel veri', isCorrect: true },
          { optionText: 'Anonim veri', isCorrect: false },
          { optionText: 'Kamuya açık veri', isCorrect: false },
        ],
      },
      {
        questionText: 'Veri ihlali tespit edildiğinde ne yapılmalıdır?',
        options: [
          { optionText: 'Sessizce düzeltilmeli', isCorrect: false },
          { optionText: 'Sadece IT birimine bildirilmeli', isCorrect: false },
          { optionText: 'KVKK Kurulu\'na 72 saat içinde bildirilmelidir', isCorrect: true },
          { optionText: 'Yılsonunda raporlanmalı', isCorrect: false },
        ],
      },
    ],
  },
  {
    title: 'İlk Yardım Temel',
    description: 'Temel ilk yardım uygulamaları, CPR ve acil müdahale teknikleri eğitimi.',
    category: 'İlk Yardım',
    isCompulsory: false,
    passingScore: 70,
    maxAttempts: 3,
    examDurationMinutes: 20,
    questions: [
      {
        questionText: 'Yetişkinlerde CPR sırasında göğüs basısı hızı dakikada kaç olmalıdır?',
        options: [
          { optionText: '60-80', isCorrect: false },
          { optionText: '100-120', isCorrect: true },
          { optionText: '140-160', isCorrect: false },
          { optionText: '80-100', isCorrect: false },
        ],
      },
      {
        questionText: 'Bilinç kaybı olan bir kişi hangi pozisyona getirilmelidir?',
        options: [
          { optionText: 'Sırt üstü pozisyon', isCorrect: false },
          { optionText: 'Koma (yan yatış) pozisyonu', isCorrect: true },
          { optionText: 'Oturur pozisyon', isCorrect: false },
          { optionText: 'Ayaklar yukarıda pozisyon', isCorrect: false },
        ],
      },
      {
        questionText: 'Kanama durumunda ilk yapılması gereken nedir?',
        options: [
          { optionText: 'Turnike uygulamak', isCorrect: false },
          { optionText: 'Yaraya temiz bezle doğrudan baskı uygulamak', isCorrect: true },
          { optionText: 'Yarayı su ile yıkamak', isCorrect: false },
          { optionText: 'Ambulansı beklemek', isCorrect: false },
        ],
      },
    ],
  },
]

// ── MAIN SEED FUNCTION ─────────────────────────────────────
async function main() {
  console.log('\n========================================')
  console.log('  Hospital LMS — Demo Seed Script')
  console.log('========================================\n')

  // ── 1. ORGANIZATION ──
  console.log('[1/9] Organizasyon oluşturuluyor...')
  const org = await prisma.organization.upsert({
    where: { code: ORG_CODE },
    update: {
      name: 'Demo Özel Hastanesi',
      setupCompleted: true,
      setupStep: 5,
      isActive: true,
      address: 'Ataşehir, İstanbul',
      phone: '0212 555 00 00',
      email: 'info@demo-hastane.com',
    },
    create: {
      name: 'Demo Özel Hastanesi',
      code: ORG_CODE,
      address: 'Ataşehir, İstanbul',
      phone: '0212 555 00 00',
      email: 'info@demo-hastane.com',
      setupCompleted: true,
      setupStep: 5,
      isActive: true,
      defaultPassingScore: 70,
      defaultMaxAttempts: 3,
      defaultExamDuration: 30,
      sessionTimeout: 30,
    },
  })
  console.log(`  Organizasyon: ${org.name} (${org.id})`)

  // ── 2. SUBSCRIPTION PLAN ──
  console.log('\n[2/9] Abonelik planı oluşturuluyor...')
  const plan = await prisma.subscriptionPlan.upsert({
    where: { slug: 'demo-pro' },
    update: {},
    create: {
      name: 'Profesyonel',
      slug: 'demo-pro',
      description: 'Demo amaçlı profesyonel plan',
      maxStaff: 500,
      maxTrainings: 100,
      maxStorageGb: 50,
      priceMonthly: 499.0,
      priceAnnual: 4999.0,
      features: ['Video eğitim', 'Sınav modülü', 'Raporlama', 'E-posta bildirimleri'],
      isActive: true,
    },
  })

  await prisma.organizationSubscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      planId: plan.id,
      status: 'active',
      billingCycle: 'annual',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  })
  console.log(`  Plan: ${plan.name}`)

  // ── 3. DEPARTMENTS ──
  console.log('\n[3/9] Departmanlar oluşturuluyor...')
  const deptIds: string[] = []
  for (const dept of DEPARTMENTS) {
    const d = await prisma.department.upsert({
      where: { organizationId_name: { organizationId: org.id, name: dept.name } },
      update: { description: dept.description, color: dept.color, sortOrder: dept.sortOrder },
      create: {
        organizationId: org.id,
        name: dept.name,
        description: dept.description,
        color: dept.color,
        sortOrder: dept.sortOrder,
        isActive: true,
      },
    })
    deptIds.push(d.id)
    console.log(`  Departman: ${d.name}`)
  }

  // ── 4. ADMIN USER ──
  console.log('\n[4/9] Admin kullanıcısı oluşturuluyor...')
  const adminEmail = 'admin@demo.hastanelms.com'
  const adminAuthId = await ensureSupabaseUser(adminEmail, {
    role: 'admin',
    organizationId: org.id,
    firstName: 'Demo',
    lastName: 'Admin',
  })

  await prisma.user.upsert({
    where: { id: adminAuthId },
    update: {
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'admin',
      organizationId: org.id,
      isActive: true,
    },
    create: {
      id: adminAuthId,
      email: adminEmail,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'admin',
      title: 'Hastane Yöneticisi',
      organizationId: org.id,
      isActive: true,
      kvkkNoticeAcknowledgedAt: new Date(),
    },
  })
  console.log(`  Admin: ${adminEmail}`)

  // ── 5. STAFF USERS ──
  console.log('\n[5/9] Personel kullanıcıları oluşturuluyor...')
  const staffUserIds: string[] = []

  for (let i = 0; i < STAFF_USERS.length; i++) {
    const s = STAFF_USERS[i]
    const email = `staff${i + 1}@demo.hastanelms.com`
    const authId = await ensureSupabaseUser(email, {
      role: 'staff',
      organizationId: org.id,
      firstName: s.firstName,
      lastName: s.lastName,
    })

    await prisma.user.upsert({
      where: { id: authId },
      update: {
        firstName: s.firstName,
        lastName: s.lastName,
        role: 'staff',
        organizationId: org.id,
        departmentId: deptIds[s.deptIndex],
        title: s.title,
        isActive: true,
      },
      create: {
        id: authId,
        email,
        firstName: s.firstName,
        lastName: s.lastName,
        role: 'staff',
        title: s.title,
        organizationId: org.id,
        departmentId: deptIds[s.deptIndex],
        isActive: true,
        kvkkNoticeAcknowledgedAt: new Date(),
      },
    })

    staffUserIds.push(authId)
    console.log(`  Personel: ${s.firstName} ${s.lastName} (${email})`)
  }

  // ── 6. TRAININGS + QUESTIONS ──
  console.log('\n[6/9] Eğitimler ve sorular oluşturuluyor...')
  const now = new Date()
  const sixMonthsLater = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
  const trainingIds: string[] = []

  for (const t of TRAININGS) {
    // Upsert training — use title + orgId to find existing
    let training = await prisma.training.findFirst({
      where: { organizationId: org.id, title: t.title },
    })

    if (training) {
      training = await prisma.training.update({
        where: { id: training.id },
        data: {
          description: t.description,
          category: t.category,
          isCompulsory: t.isCompulsory,
          passingScore: t.passingScore,
          maxAttempts: t.maxAttempts,
          examDurationMinutes: t.examDurationMinutes,
          isActive: true,
          publishStatus: 'published',
          startDate: now,
          endDate: sixMonthsLater,
          createdById: adminAuthId,
        },
      })
    } else {
      training = await prisma.training.create({
        data: {
          organizationId: org.id,
          title: t.title,
          description: t.description,
          category: t.category,
          isCompulsory: t.isCompulsory,
          passingScore: t.passingScore,
          maxAttempts: t.maxAttempts,
          examDurationMinutes: t.examDurationMinutes,
          isActive: true,
          publishStatus: 'published',
          examOnly: true,
          startDate: now,
          endDate: sixMonthsLater,
          createdById: adminAuthId,
        },
      })
    }

    trainingIds.push(training.id)
    console.log(`  Eğitim: ${training.title}`)

    // Delete existing questions for idempotency, then recreate
    await prisma.question.deleteMany({ where: { trainingId: training.id } })

    for (let qi = 0; qi < t.questions.length; qi++) {
      const q = t.questions[qi]
      const question = await prisma.question.create({
        data: {
          trainingId: training.id,
          questionText: q.questionText,
          questionType: 'multiple_choice',
          points: 10,
          sortOrder: qi + 1,
        },
      })

      for (let oi = 0; oi < q.options.length; oi++) {
        await prisma.questionOption.create({
          data: {
            questionId: question.id,
            optionText: q.options[oi].optionText,
            isCorrect: q.options[oi].isCorrect,
            sortOrder: oi + 1,
          },
        })
      }
    }
  }

  // ── 7. TRAINING ASSIGNMENTS ──
  console.log('\n[7/9] Eğitim atamaları oluşturuluyor...')

  // Enfeksiyon Kontrol (index 0) and Yangin Guvenligi (index 1) — all staff
  for (const tIdx of [0, 1]) {
    for (let si = 0; si < staffUserIds.length; si++) {
      const userId = staffUserIds[si]
      const trainingId = trainingIds[tIdx]

      // Determine status: first 4 staff completed, rest assigned
      const isCompleted = si < 4
      const status = isCompleted ? 'completed' : 'assigned'

      await prisma.trainingAssignment.upsert({
        where: { trainingId_userId: { trainingId, userId } },
        update: { status, currentAttempt: isCompleted ? 1 : 0 },
        create: {
          trainingId,
          userId,
          status,
          currentAttempt: isCompleted ? 1 : 0,
          maxAttempts: 3,
          assignedById: adminAuthId,
          assignedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 gun once
          completedAt: isCompleted ? new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) : null,
        },
      })
    }
    console.log(`  Atama: ${TRAININGS[tIdx].title} — 10 personel`)
  }

  // Other trainings — assign to subset of staff
  for (let tIdx = 2; tIdx < trainingIds.length; tIdx++) {
    const subset = staffUserIds.slice(0, 5)
    for (const userId of subset) {
      await prisma.trainingAssignment.upsert({
        where: { trainingId_userId: { trainingId: trainingIds[tIdx], userId } },
        update: {},
        create: {
          trainingId: trainingIds[tIdx],
          userId,
          status: 'assigned',
          currentAttempt: 0,
          maxAttempts: 3,
          assignedById: adminAuthId,
          assignedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        },
      })
    }
    console.log(`  Atama: ${TRAININGS[tIdx].title} — 5 personel`)
  }

  // ── 8. EXAM ATTEMPTS (for completed assignments) ──
  console.log('\n[8/9] Sınav denemeleri ve sertifikalar oluşturuluyor...')

  const completedAssignments = await prisma.trainingAssignment.findMany({
    where: {
      status: 'completed',
      training: { organizationId: org.id },
    },
    include: {
      training: { include: { questions: { include: { options: true } } } },
    },
  })

  let certCount = 0
  for (const assignment of completedAssignments) {
    // Check if attempt already exists
    const existingAttempt = await prisma.examAttempt.findUnique({
      where: { assignmentId_attemptNumber: { assignmentId: assignment.id, attemptNumber: 1 } },
    })

    if (existingAttempt) continue

    const completedDate = assignment.completedAt ?? new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)

    const attempt = await prisma.examAttempt.create({
      data: {
        assignmentId: assignment.id,
        userId: assignment.userId,
        trainingId: assignment.trainingId,
        organizationId: org.id,
        attemptNumber: 1,
        preExamScore: 80.0,
        postExamScore: 90.0,
        preExamStartedAt: new Date(completedDate.getTime() - 60 * 60 * 1000),
        preExamCompletedAt: new Date(completedDate.getTime() - 50 * 60 * 1000),
        postExamStartedAt: new Date(completedDate.getTime() - 30 * 60 * 1000),
        postExamCompletedAt: completedDate,
        videosCompletedAt: new Date(completedDate.getTime() - 35 * 60 * 1000),
        isPassed: true,
        status: 'completed',
      },
    })

    // Create exam answers for this attempt (all correct for completed)
    for (const question of assignment.training.questions) {
      const correctOption = question.options.find((o) => o.isCorrect)
      if (!correctOption) continue

      // Pre-exam answer
      await prisma.examAnswer.upsert({
        where: {
          attemptId_questionId_examPhase: {
            attemptId: attempt.id,
            questionId: question.id,
            examPhase: 'pre',
          },
        },
        update: {},
        create: {
          attemptId: attempt.id,
          questionId: question.id,
          selectedOptionId: correctOption.id,
          isCorrect: true,
          examPhase: 'pre',
        },
      })

      // Post-exam answer
      await prisma.examAnswer.upsert({
        where: {
          attemptId_questionId_examPhase: {
            attemptId: attempt.id,
            questionId: question.id,
            examPhase: 'post',
          },
        },
        update: {},
        create: {
          attemptId: attempt.id,
          questionId: question.id,
          selectedOptionId: correctOption.id,
          isCorrect: true,
          examPhase: 'post',
        },
      })
    }

    // Create certificate for first 2 completed (limit to 2 total)
    if (certCount < 2) {
      const existingCert = await prisma.certificate.findUnique({
        where: { attemptId: attempt.id },
      })

      if (!existingCert) {
        const certCode = `DEMO-${now.getFullYear()}-${String(certCount + 1).padStart(4, '0')}`
        await prisma.certificate.upsert({
          where: { certificateCode: certCode },
          update: {},
          create: {
            userId: assignment.userId,
            trainingId: assignment.trainingId,
            attemptId: attempt.id,
            certificateCode: certCode,
            issuedAt: completedDate,
            expiresAt: new Date(completedDate.getTime() + 365 * 24 * 60 * 60 * 1000),
          },
        })
        certCount++
        console.log(`  Sertifika: ${certCode}`)
      }
    }
  }
  console.log(`  Toplam ${completedAssignments.length} sınav denemesi oluşturuldu`)

  // ── 9. DEPARTMENT TRAINING RULES ──
  console.log('\n[9/9] Departman eğitim kuralları oluşturuluyor...')

  // Dahiliye → Enfeksiyon Kontrol required
  const dahiliyeId = deptIds[0]
  const enfeksiyonId = trainingIds[0]
  const yanginId = trainingIds[1]

  await prisma.departmentTrainingRule.upsert({
    where: { departmentId_trainingId: { departmentId: dahiliyeId, trainingId: enfeksiyonId } },
    update: {},
    create: {
      departmentId: dahiliyeId,
      trainingId: enfeksiyonId,
      organizationId: org.id,
      isActive: true,
    },
  })
  console.log(`  Kural: Dahiliye → Enfeksiyon Kontrol`)

  // All departments → Yangin Guvenligi required
  for (let di = 0; di < deptIds.length; di++) {
    await prisma.departmentTrainingRule.upsert({
      where: { departmentId_trainingId: { departmentId: deptIds[di], trainingId: yanginId } },
      update: {},
      create: {
        departmentId: deptIds[di],
        trainingId: yanginId,
        organizationId: org.id,
        isActive: true,
      },
    })
  }
  console.log(`  Kural: Tüm departmanlar → Yangın Güvenliği`)

  // ── DONE ──
  console.log('\n========================================')
  console.log('  Seed tamamlandi!')
  console.log('========================================')
  console.log(`
  Organizasyon : Demo Özel Hastanesi
  Departmanlar : ${DEPARTMENTS.length}
  Admin        : ${adminEmail}
  Personel     : ${STAFF_USERS.length} kisi
  Egitimler    : ${TRAININGS.length}
  Sertifikalar : ${certCount}
  Sifre        : ${DEMO_PASSWORD}
  `)
}

main()
  .catch((e) => {
    console.error('Seed hatası:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
