import { randomBytes } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { createAuthUser } from '@/lib/auth-user-factory'
import { generateTempPassword } from '@/lib/passwords'
import { slugify } from '@/lib/organization'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'
import { defaultPeriodBounds } from '@/lib/training-periods'
import { generateUniqueTcs } from '@/lib/tc'

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

const TRAININGS = [
  {
    title: 'El Hijyeni ve Enfeksiyon Kontrolü',
    description: 'Hastane enfeksiyonlarının önlenmesi, el hijyeni ve izolasyon tedbirleri eğitimi.',
    category: 'Enfeksiyon Kontrolü',
    video: 'egitim-el-hijyeni.webm',
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
        questionText: 'Temas izolasyonunda hangi ekipman kullanılır?',
        options: [
          { optionText: 'Önlük ve eldiven', isCorrect: true },
          { optionText: 'Sadece maske', isCorrect: false },
          { optionText: 'Yalnızca bone', isCorrect: false },
          { optionText: 'Hiçbiri', isCorrect: false },
        ],
      },
      {
        questionText: 'Hastane enfeksiyonlarının en sık bulaşma yolu hangisidir?',
        options: [
          { optionText: 'Hava yolu', isCorrect: false },
          { optionText: 'Temas yolu (kontamine eller)', isCorrect: true },
          { optionText: 'Kan yolu', isCorrect: false },
          { optionText: 'Yiyecekler', isCorrect: false },
        ],
      },
      {
        questionText: 'Damlacık izolasyonu gerektiren bir hastanın odasına girerken ne takılmalıdır?',
        options: [
          { optionText: 'N95 Maske', isCorrect: false },
          { optionText: 'Cerrahi Maske', isCorrect: true },
          { optionText: 'Sadece eldiven', isCorrect: false },
          { optionText: 'Özel bir ekipmana gerek yoktur', isCorrect: false },
        ],
      },
      {
        questionText: 'Solunum izolasyonunda (havayolu) hangi maske tipi zorunludur?',
        options: [
          { optionText: 'Cerrahi maske', isCorrect: false },
          { optionText: 'Bez maske', isCorrect: false },
          { optionText: 'N95 / FFP2 veya FFP3 maske', isCorrect: true },
          { optionText: 'Oksijen maskesi', isCorrect: false },
        ],
      },
      {
        questionText: 'Eller ne zaman su ve sabunla yıkanmalıdır?',
        options: [
          { optionText: 'Gözle görülür bir kirlenme olduğunda', isCorrect: true },
          { optionText: 'Sadece hasta temasından sonra', isCorrect: false },
          { optionText: 'Sadece tuvaletten sonra', isCorrect: false },
          { optionText: 'Günde sadece bir kez', isCorrect: false },
        ],
      },
      {
        questionText: 'Tıbbi atıklar hangi renk torbaya atılır?',
        options: [
          { optionText: 'Siyah torba', isCorrect: false },
          { optionText: 'Kırmızı torba', isCorrect: true },
          { optionText: 'Mavi torba', isCorrect: false },
          { optionText: 'Sarı torba', isCorrect: false },
        ],
      },
      {
        questionText: 'Kesici ve delici alet atıkları nerede biriktirilmelidir?',
        options: [
          { optionText: 'Kırmızı çöp poşetinde', isCorrect: false },
          { optionText: 'Siyah çöp poşetinde', isCorrect: false },
          { optionText: 'Delinmeye dirençli sarı kutularda', isCorrect: true },
          { optionText: 'Karton kutularda', isCorrect: false },
        ],
      },
      {
        questionText: 'Evsel atıklar hangi renk torbaya atılmalıdır?',
        options: [
          { optionText: 'Kırmızı', isCorrect: false },
          { optionText: 'Sarı', isCorrect: false },
          { optionText: 'Siyah', isCorrect: true },
          { optionText: 'Mavi', isCorrect: false },
        ],
      },
      {
        questionText: 'Cerrahi el yıkama işlemi en az ne kadar sürmelidir?',
        options: [
          { optionText: '10 saniye', isCorrect: false },
          { optionText: '30 saniye', isCorrect: false },
          { optionText: '2-3 dakika', isCorrect: true },
          { optionText: '5-6 dakika', isCorrect: false },
        ],
      },
    ],
  },
  {
    title: 'Yangın Güvenliği ve Tahliye',
    description: 'Hastanede yangın önleme, söndürücü kullanımı ve tahliye prosedürleri eğitimi.',
    category: 'İş Güvenliği',
    video: 'egitim-yangin-guvenligi.webm',
    questions: [
      {
        questionText: 'Yangın söndürücü kullanırken doğru sıralama hangisidir?',
        options: [
          { optionText: 'Çek - Sık - Nişan al - Süpür', isCorrect: true },
          { optionText: 'Sık - Çek - Süpür - Nişan al', isCorrect: false },
          { optionText: 'Nişan al - Çek - Sık - Süpür', isCorrect: false },
          { optionText: 'Süpür - Nişan al - Çek - Sık', isCorrect: false },
        ],
      },
      {
        questionText: 'Yangın çıktığında ilk yapılması gereken nedir?',
        options: [
          { optionText: 'Yangın söndürücüyü almak', isCorrect: false },
          { optionText: 'Yangın ihbar butonuna basmak', isCorrect: true },
          { optionText: 'Pencereyi açmak', isCorrect: false },
          { optionText: 'Asansörü kullanmak', isCorrect: false },
        ],
      },
      {
        questionText: 'Tahliye sırasında asansör neden kullanılmaz?',
        options: [
          { optionText: 'Yavaş olduğu için', isCorrect: false },
          { optionText: 'Elektrik kesilirse mahsur kalınabilir', isCorrect: true },
          { optionText: 'Kapasitesi az olduğu için', isCorrect: false },
          { optionText: 'Gürültülü olduğu için', isCorrect: false },
        ],
      },
      {
        questionText: 'Hastanelerde hangi yangın sınıfı (söndürücü tipi) daha yaygın kullanılmalıdır?',
        options: [
          { optionText: 'Su bazlı', isCorrect: false },
          { optionText: 'KKT (Kuru Kimyevi Toz) ve CO2', isCorrect: true },
          { optionText: 'Köpüklü', isCorrect: false },
          { optionText: 'Kum', isCorrect: false },
        ],
      },
      {
        questionText: 'Hastane tahliyesinde öncelikli kurtarılacak hasta grubu hangisidir?',
        options: [
          { optionText: 'Yürüyebilen hastalar', isCorrect: true },
          { optionText: 'Yoğun bakım hastaları', isCorrect: false },
          { optionText: 'Ameliyattaki hastalar', isCorrect: false },
          { optionText: 'Yatağa bağımlı hastalar', isCorrect: false },
        ],
      },
      {
        questionText: 'Kırmızı Kod (1111) hastanelerde hangi acil durumu ifade eder?',
        options: [
          { optionText: 'Bebek kaçırma', isCorrect: false },
          { optionText: 'Yangın', isCorrect: true },
          { optionText: 'Kardiyak arrest (Kalp durması)', isCorrect: false },
          { optionText: 'Saldırı / Güvenlik ihlali', isCorrect: false },
        ],
      },
      {
        questionText: 'Yangın anında dumanlı bir ortamda nasıl hareket edilmelidir?',
        options: [
          { optionText: 'Koşarak uzaklaşılmalı', isCorrect: false },
          { optionText: 'Ayakta ve hızlıca yürünmeli', isCorrect: false },
          { optionText: 'Yere olabildiğince yakın, eğilerek veya emekleyerek', isCorrect: true },
          { optionText: 'Derin nefes alarak', isCorrect: false },
        ],
      },
      {
        questionText: 'Yangın kapılarının temel işlevi nedir?',
        options: [
          { optionText: 'Güvenliği sağlamak', isCorrect: false },
          { optionText: 'Yangın ve dumanın diğer bölümlere geçişini engellemek', isCorrect: true },
          { optionText: 'Hırsızları engellemek', isCorrect: false },
          { optionText: 'Estetik görünüm sağlamak', isCorrect: false },
        ],
      },
      {
        questionText: 'Tahliye işlemi sırasında kapılar ne yapılmalıdır?',
        options: [
          { optionText: 'Tamamen açık bırakılmalıdır', isCorrect: false },
          { optionText: 'Kilitlenmelidir', isCorrect: false },
          { optionText: 'Kilitlenmeden sıkıca kapatılmalıdır', isCorrect: true },
          { optionText: 'Sökülmelidir', isCorrect: false },
        ],
      },
      {
        questionText: 'R.A.C.E. (Kurtar, Alarma Bas, Sınırlandır, Söndür/Tahliye Et) akronimindeki "C - Contain" ne anlama gelir?',
        options: [
          { optionText: 'Yangını sınırlandırmak için kapıları ve pencereleri kapatmak', isCorrect: true },
          { optionText: 'Hastaları çağırarak bilgilendirmek', isCorrect: false },
          { optionText: 'Cihazları kontrol etmek', isCorrect: false },
          { optionText: 'Merkezle iletişime geçmek', isCorrect: false },
        ],
      },
    ],
  },
]

export interface SeedDemoOrganizationResult {
  orgId: string
  orgName: string
  adminEmail: string
  adminTc: string
  tempPassword: string
  staffEmail?: string
  staffTc?: string
}

async function nextDemoIdentity() {
  const count = await prisma.organization.count({ where: { isDemo: true } })
  const name = `Demo Hastane #${count + 1}`
  const baseSlug = slugify(name)

  let code = ''
  do {
    code = `DEMO-${randomBytes(3).toString('hex').toUpperCase()}`
  } while (await prisma.organization.findUnique({ where: { code } }))

  let slug = baseSlug
  let suffix = 1
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  return { name, code, slug, emailDomain: `${code.toLowerCase()}.demo.klinovax.internal` }
}

async function ensureDemoSubscriptionPlan(tx: Prisma.TransactionClient) {
  const existing = await tx.subscriptionPlan.findFirst({
    where: { isActive: true },
    orderBy: { priceMonthly: 'desc' },
    select: { id: true },
  })
  if (existing) return existing.id

  const plan = await tx.subscriptionPlan.upsert({
    where: { slug: 'demo-pro' },
    update: { isActive: true },
    create: {
      name: 'Demo Profesyonel',
      slug: 'demo-pro',
      description: 'Otomatik demo planı',
      maxStaff: 500,
      maxTrainings: 100,
      maxStorageGb: 50,
      priceMonthly: 0,
      priceAnnual: 0,
      features: ['Video eğitim', 'Sınav modülü', 'Raporlama', 'Sertifika'],
      isActive: true,
    },
    select: { id: true },
  })
  return plan.id
}

async function deleteAuthUsers(userIds: string[]) {
  if (userIds.length === 0) return
  const supabase = await createServiceClient()
  await Promise.all(userIds.map((id) => supabase.auth.admin.deleteUser(id)))
}

export async function seedDemoOrganization({
  filled = true,
  createdByUserId,
}: {
  filled?: boolean
  createdByUserId?: string | null
} = {}): Promise<SeedDemoOrganizationResult> {
  const identity = await nextDemoIdentity()
  const tempPassword = generateTempPassword()
  const tcs = generateUniqueTcs(1 + (filled ? STAFF.length : 0))
  const adminTc = tcs[0]
  const createdAuthUserIds: string[] = []

  const organization = await prisma.$transaction(async (tx) => {
    const planId = await ensureDemoSubscriptionPlan(tx)
    const org = await tx.organization.create({
      data: {
        name: identity.name,
        code: identity.code,
        slug: identity.slug,
        address: 'Demo Mah., Ankara',
        phone: '0312 000 00 00',
        email: `info@${identity.emailDomain}`,
        isDemo: true,
        isActive: true,
        setupCompleted: true,
        setupStep: 5,
        defaultPassingScore: 70,
        defaultMaxAttempts: 3,
        defaultExamDuration: 30,
        sessionTimeout: 30,
        createdBy: createdByUserId ?? undefined,
      },
    })

    await tx.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId,
        status: 'active',
        billingCycle: 'annual',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })

    await tx.trainingCategory.createMany({
      data: TRAINING_CATEGORIES.map((cat, i) => ({
        organizationId: org.id,
        value: cat.value,
        label: cat.label,
        icon: cat.icon,
        order: i,
        isDefault: true,
      })),
    })

    const currentYear = new Date().getFullYear()
    const { startDate, endDate } = defaultPeriodBounds(currentYear)
    await tx.trainingPeriod.create({
      data: {
        organizationId: org.id,
        year: currentYear,
        label: `${currentYear} Eğitim Dönemi`,
        startDate,
        endDate,
        isDefault: true,
        status: 'active',
      },
    })

    return org
  })

  try {
    const adminEmail = `admin@${identity.emailDomain}`
    const admin = await createAuthUser({
      email: adminEmail,
      password: tempPassword,
      firstName: 'Demo',
      lastName: 'Yönetici',
      role: 'admin',
      organizationId: organization.id,
      title: 'Kalite Yöneticisi',
      mustChangePassword: true,
      tcKimlik: adminTc,
      tcAddedByUserId: createdByUserId ?? undefined,
      extraUserMetadata: { kvkk_notice_acknowledged_at: new Date().toISOString() },
    })
    createdAuthUserIds.push(admin.dbUser.id)

    await prisma.user.update({
      where: { id: admin.dbUser.id },
      data: {
        kvkkNoticeAcknowledgedAt: new Date(),
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      },
    })

    await prisma.organization.update({
      where: { id: organization.id },
      data: { ownerUserId: admin.dbUser.id },
    })

    let staffEmail: string | undefined
    let staffTc: string | undefined

    if (filled) {
      staffEmail = `personel1@${identity.emailDomain}`
      staffTc = tcs[1]
      await seedFilledDemoData({
        organizationId: organization.id,
        adminId: admin.dbUser.id,
        emailDomain: identity.emailDomain,
        tempPassword,
        staffTcs: tcs.slice(1),
        createdByUserId,
        createdAuthUserIds,
      })
    }

    return {
      orgId: organization.id,
      orgName: organization.name,
      adminEmail,
      adminTc,
      tempPassword,
      staffEmail,
      staffTc,
    }
  } catch (err) {
    await deleteAuthUsers(createdAuthUserIds)
    await prisma.organization.delete({ where: { id: organization.id } }).catch(() => undefined)
    throw err
  }
}

async function seedFilledDemoData({
  organizationId,
  adminId,
  emailDomain,
  tempPassword,
  staffTcs,
  createdByUserId,
  createdAuthUserIds,
}: {
  organizationId: string
  adminId: string
  emailDomain: string
  tempPassword: string
  staffTcs: string[]
  createdByUserId?: string | null
  createdAuthUserIds: string[]
}) {
  const departments = await prisma.$transaction(async (tx) => Promise.all(DEPARTMENTS.map((d) => tx.department.create({
    data: { organizationId, ...d, isActive: true },
  }))))

  const staffIds: string[] = []
  for (let i = 0; i < STAFF.length; i++) {
    const staff = STAFF[i]
    const user = await createAuthUser({
      email: `personel${i + 1}@${emailDomain}`,
      password: tempPassword,
      firstName: staff.firstName,
      lastName: staff.lastName,
      role: 'staff',
      organizationId,
      departmentId: departments[staff.deptIndex].id,
      title: staff.title,
      mustChangePassword: true,
      tcKimlik: staffTcs[i],
      tcAddedByUserId: createdByUserId ?? undefined,
      extraUserMetadata: { kvkk_notice_acknowledged_at: new Date().toISOString() },
    })
    createdAuthUserIds.push(user.dbUser.id)
    staffIds.push(user.dbUser.id)
  }

  await prisma.user.updateMany({
    where: { id: { in: staffIds } },
    data: {
      kvkkNoticeAcknowledgedAt: new Date(),
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
  })

  const activePeriod = await prisma.trainingPeriod.findFirst({
    where: { organizationId, status: 'active' },
    select: { id: true },
    orderBy: { year: 'desc' },
  })

  const now = new Date()
  const endDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
  const assignedAt = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000)
  const scores = [100, 90, 85, 80]
  let certificateCount = 0

  for (let tIdx = 0; tIdx < TRAININGS.length; tIdx++) {
    const item = TRAININGS[tIdx]
    
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        organizationId,
        title: `${item.title} - Tanıtım`,
        mediaType: 'video',
        s3Key: `videos/${organizationId}/demo/${item.video}`,
        fileSizeBytes: 15000000,
        uploadedById: adminId,
      }
    })

    const training = await prisma.training.create({
      data: {
        organizationId,
        title: item.title,
        description: item.description,
        category: item.category,
        isCompulsory: true,
        passingScore: 70,
        maxAttempts: 3,
        examDurationMinutes: 20,
        isActive: true,
        publishStatus: 'published',
        examOnly: false,
        startDate: now,
        endDate,
        createdById: adminId,
        videos: {
          create: {
            title: `${item.title} - Tanıtım`,
            videoUrl: `/uploads/${item.video}`, // perf-check-disable-line raw-video-url — demo public upload path'i bilinçli.
            videoKey: mediaAsset.s3Key,
            durationSeconds: 18,
            contentType: 'video',
            sortOrder: 1,
            sourceMediaAssetId: mediaAsset.id,
          },
        },
        questions: {
          create: item.questions.map((question, qi) => ({
            questionText: question.questionText,
            questionType: 'multiple_choice',
            points: 10,
            sortOrder: qi + 1,
            options: {
              create: question.options.map((option, oi) => ({
                optionText: option.optionText,
                isCorrect: option.isCorrect,
                sortOrder: oi + 1,
              })),
            },
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    })

    for (let si = 0; si < staffIds.length; si++) {
      const userId = staffIds[si]
      const status = si < 4 ? 'passed' : si < 6 ? 'in_progress' : 'assigned'
      const completedAt = status === 'passed' ? new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) : null
      const assignment = await prisma.trainingAssignment.create({
        data: {
          trainingId: training.id,
          userId,
          organizationId,
          periodId: activePeriod?.id,
          status,
          currentAttempt: status === 'assigned' ? 0 : 1,
          maxAttempts: 3,
          assignedById: adminId,
          assignedAt,
          completedAt,
        },
      })

      await prisma.notification.create({
        data: {
          userId,
          organizationId,
          senderId: adminId,
          title: 'Yeni Eğitim Atandı',
          message: `"${training.title}" adlı eğitim size atandı. Örnek demo verisi olarak takip durumları hazırlandı.`,
          type: 'assignment',
          relatedTrainingId: training.id,
        },
      })

      if (status === 'passed' && completedAt) {
        const attempt = await prisma.examAttempt.create({
          data: {
            assignmentId: assignment.id,
            userId,
            trainingId: training.id,
            organizationId,
            attemptNumber: 1,
            preExamScore: 60,
            postExamScore: scores[(certificateCount + si + tIdx) % scores.length],
            preExamStartedAt: new Date(completedAt.getTime() - 60 * 60 * 1000),
            preExamCompletedAt: new Date(completedAt.getTime() - 50 * 60 * 1000),
            postExamStartedAt: new Date(completedAt.getTime() - 20 * 60 * 1000),
            postExamCompletedAt: completedAt,
            videosCompletedAt: new Date(completedAt.getTime() - 30 * 60 * 1000),
            isPassed: true,
            status: 'completed',
          },
        })

        const answers = training.questions.flatMap((question) => {
          const correct = question.options.find((option) => option.isCorrect)
          if (!correct) return []
          return (['pre', 'post'] as const).map((phase) => ({
            attemptId: attempt.id,
            questionId: question.id,
            selectedOptionId: correct.id,
            isCorrect: true,
            examPhase: phase,
          }))
        })
        if (answers.length > 0) await prisma.examAnswer.createMany({ data: answers })

        if (certificateCount < 3) {
          certificateCount++
          await prisma.certificate.create({
            data: {
              userId,
              trainingId: training.id,
              attemptId: attempt.id,
              organizationId,
              periodId: activePeriod?.id,
              certificateCode: `${emailDomain.split('.')[0].toUpperCase()}-${String(certificateCount).padStart(4, '0')}`,
              issuedAt: completedAt,
              expiresAt: new Date(completedAt.getTime() + 365 * 24 * 60 * 60 * 1000),
            },
          })
        }
      }
    }
  }
}
