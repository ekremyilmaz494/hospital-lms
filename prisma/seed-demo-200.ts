/**
 * 200 Demo Personel Seed Script
 *
 * - 200 personel (5 departmana dağılmış, gerçekçi Türkçe isimler)
 * - Her personel en az 1-2 eğitime atanmış
 * - ~120 personel eğitimleri tamamlamış (sınava girmiş, geçmiş)
 * - ~40 personel devam ediyor (in_progress)
 * - ~40 personel henüz başlamamış (assigned)
 * - Geçenler için sertifika oluşturulmuş
 *
 * Kullanım:
 *   npx tsx prisma/seed-demo-200.ts
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
  console.error('Eksik: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = process.env.SEED_PASSWORD
if (!DEMO_PASSWORD) { console.error('SEED_PASSWORD env değişkeni eksik'); process.exit(1) }
const ORG_CODE = 'demo-hastane'

// ── TURKISH NAME DATA ──────────────────────────────────────
const FIRST_NAMES_MALE = [
  'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'İsmail',
  'Yusuf', 'Osman', 'Murat', 'Ömer', 'Ramazan', 'Süleyman', 'Halil', 'Recep',
  'Kadir', 'Emre', 'Burak', 'Serkan', 'Fatih', 'Onur', 'Cem', 'Tolga',
  'Barış', 'Tuncay', 'Volkan', 'Selim', 'Kemal', 'Erkan', 'Deniz', 'Cenk',
  'Uğur', 'Gökhan', 'Bülent', 'Ferhat', 'Adem', 'Cengiz', 'Yasin', 'Sinan',
  'Özgür', 'Koray', 'Caner', 'Erdem', 'Furkan', 'Enes', 'Yiğit', 'Baran',
  'Alper', 'Oğuz', 'Tarık', 'Mert', 'Kaan', 'Arda', 'Batuhan', 'Berkay',
  'Doruk', 'Emir', 'Aras', 'Çağrı', 'Taner', 'Umut', 'Serhat', 'Levent',
]

const FIRST_NAMES_FEMALE = [
  'Fatma', 'Ayşe', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Şerife',
  'Zehra', 'Sultan', 'Hanife', 'Merve', 'Büşra', 'Esra', 'Gamze', 'Gülşen',
  'Havva', 'Hacer', 'Hülya', 'Serpil', 'Sevgi', 'Sibel', 'Derya', 'Dilek',
  'Gizem', 'Özlem', 'Pınar', 'Selin', 'Tuğba', 'Yasemin', 'Aslı', 'Burcu',
  'Canan', 'Duygu', 'Ebru', 'Filiz', 'Gonca', 'İrem', 'Kübra', 'Lale',
  'Melek', 'Nalan', 'Nur', 'Oya', 'Rana', 'Songül', 'Şeyma', 'Tuba',
  'Beyza', 'Cemre', 'Damla', 'Defne', 'Ece', 'Ezgi', 'Gül', 'İpek',
  'Nehir', 'Nisa', 'Sude', 'Yağmur', 'Cansu', 'Buse', 'Simge', 'Hazal',
]

const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk',
  'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara',
  'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Kaplan', 'Acar',
  'Güneş', 'Aktaş', 'Yalçın', 'Erdoğan', 'Güler', 'Tekin', 'Bozkurt', 'Taş',
  'Uçar', 'Aksoy', 'Bayrak', 'Duman', 'Eroğlu', 'Genç', 'Işık', 'Karaca',
  'Toprak', 'Uysal', 'Bulut', 'Çakır', 'Denizli', 'Ekinci', 'Fırat', 'Gündüz',
  'Sarı', 'Tuncer', 'Ünal', 'Varol', 'Zengin', 'Bilgin', 'Ceylan', 'Duran',
  'Erdem', 'Güzel', 'Kahraman', 'Oral', 'Peker', 'Sezer', 'Tan', 'Vural',
]

const TITLES_BY_DEPT: Record<number, string[]> = {
  0: ['Dahiliye Uzmanı', 'İç Hastalıkları Asistanı', 'Dahiliye Hemşiresi', 'Klinik Asistan', 'Dahiliye Stajyeri'],
  1: ['Genel Cerrah', 'Cerrah Asistanı', 'Ameliyathane Hemşiresi', 'Anestezi Teknisyeni', 'Cerrahi Hemşire'],
  2: ['Acil Tıp Uzmanı', 'Acil Tıp Hemşiresi', 'Paramedik', 'Acil Tıp Asistanı', 'Triaj Hemşiresi'],
  3: ['Biyokimya Uzmanı', 'Laboratuvar Teknisyeni', 'Mikrobiyolog', 'Patoloji Uzmanı', 'Biyolog'],
  4: ['Sorumlu Hemşire', 'Hemşire', 'Yoğun Bakım Hemşiresi', 'Klinik Hemşire', 'Ebe'],
}

// ── HELPERS ────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}


async function createSupabaseUser(
  email: string,
  metadata: Record<string, string>
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (error) {
    // If user already exists, find and return their ID
    if (error.message.includes('already') || error.message.includes('duplicate')) {
      const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const existing = listData?.users?.find((u) => u.email === email)
      if (existing) return existing.id
    }
    throw new Error(`Auth hata (${email}): ${error.message}`)
  }

  return data.user.id
}

// Rate-limited batch creator
async function createSupabaseUsersBatch(
  users: { email: string; metadata: Record<string, string> }[]
): Promise<Map<string, string>> {
  const emailToId = new Map<string, string>()

  // First, get all existing users
  console.log('  Mevcut Supabase kullanıcıları kontrol ediliyor...')
  const allExisting = new Map<string, string>()
  let page = 1
   
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (!data?.users?.length) break
    for (const u of data.users) {
      if (u.email) allExisting.set(u.email, u.id)
    }
    if (data.users.length < 1000) break
    page++
  }

  const toCreate = users.filter((u) => !allExisting.has(u.email))
  const existing = users.filter((u) => allExisting.has(u.email))

  for (const u of existing) {
    emailToId.set(u.email, allExisting.get(u.email)!)
  }
  console.log(`  ${existing.length} kullanıcı zaten mevcut, ${toCreate.length} yeni oluşturulacak`)

  // Create in batches of 10 with small delay to avoid rate limits
  const BATCH_SIZE = 10
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((u) => createSupabaseUser(u.email, u.metadata))
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'fulfilled') {
        emailToId.set(batch[j].email, result.value)
      } else {
        console.error(`  HATA: ${batch[j].email} — ${result.reason}`)
      }
    }

    if (i + BATCH_SIZE < toCreate.length) {
      // Small delay between batches
      await new Promise((r) => setTimeout(r, 200))
    }

    const done = Math.min(i + BATCH_SIZE, toCreate.length)
    if (done % 50 === 0 || done === toCreate.length) {
      console.log(`  Auth ilerleme: ${done}/${toCreate.length}`)
    }
  }

  return emailToId
}

// ── GENERATE 200 PERSONNEL ────────────────────────────────
interface PersonnelData {
  firstName: string
  lastName: string
  email: string
  title: string
  deptIndex: number
}

function generatePersonnel(count: number): PersonnelData[] {
  const personnel: PersonnelData[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < count; i++) {
    const isFemale = i % 2 === 0 // ~50/50 split
    let firstName: string
    let lastName: string
    let fullName: string

    // Ensure unique names
    do {
      firstName = isFemale ? pick(FIRST_NAMES_FEMALE) : pick(FIRST_NAMES_MALE)
      lastName = pick(LAST_NAMES)
      fullName = `${firstName} ${lastName}`
    } while (usedNames.has(fullName))
    usedNames.add(fullName)

    const deptIndex = i % 5 // Distribute evenly across 5 departments
    const title = pick(TITLES_BY_DEPT[deptIndex])
    const email = `demo${i + 1}@demo.hastanelms.com`
    personnel.push({ firstName, lastName, email, title, deptIndex })
  }

  return personnel
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  console.log('\n================================================')
  console.log('  200 Demo Personel Seed Script')
  console.log('================================================\n')

  // ── 1. Get organization & departments ──
  console.log('[1/6] Organizasyon ve departmanlar alınıyor...')
  const org = await prisma.organization.findUnique({ where: { code: ORG_CODE } })
  if (!org) {
    console.error('HATA: "demo-hastane" organizasyonu bulunamadı. Önce ana seed çalıştırın: npx tsx prisma/seed.ts')
    process.exit(1)
  }
  console.log(`  Org: ${org.name} (${org.id})`)

  const departments = await prisma.department.findMany({
    where: { organizationId: org.id, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  if (departments.length < 5) {
    console.error('HATA: En az 5 departman gerekli. Önce ana seed çalıştırın.')
    process.exit(1)
  }
  console.log(`  ${departments.length} departman bulundu`)

  // Get trainings with questions
  const trainings = await prisma.training.findMany({
    where: { organizationId: org.id, isActive: true, publishStatus: 'published' },
    include: { questions: { include: { options: true } } },
  })
  if (trainings.length === 0) {
    console.error('HATA: Eğitim bulunamadı. Önce ana seed çalıştırın.')
    process.exit(1)
  }
  console.log(`  ${trainings.length} eğitim bulundu`)

  // Get admin user for assignedById
  const admin = await prisma.user.findFirst({
    where: { organizationId: org.id, role: 'admin' },
  })
  if (!admin) {
    console.error('HATA: Admin kullanıcı bulunamadı.')
    process.exit(1)
  }

  // ── 2. Generate personnel data ──
  console.log('\n[2/6] 200 personel verisi oluşturuluyor...')
  const personnelData = generatePersonnel(200)
  console.log(`  ${personnelData.length} personel verisi hazır`)

  // ── 3. Create Supabase Auth users ──
  console.log('\n[3/6] Supabase Auth kullanıcıları oluşturuluyor...')
  const authUsers = personnelData.map((p) => ({
    email: p.email,
    metadata: {
      role: 'staff',
      organizationId: org.id,
      firstName: p.firstName,
      lastName: p.lastName,
    },
  }))
  const emailToAuthId = await createSupabaseUsersBatch(authUsers)
  console.log(`  ${emailToAuthId.size} auth kullanıcı hazır`)

  // ── 4. Create DB users ──
  console.log('\n[4/6] Veritabanı kullanıcı kayıtları oluşturuluyor...')
  const userIds: string[] = []
  let createdCount = 0

  for (const p of personnelData) {
    const authId = emailToAuthId.get(p.email)
    if (!authId) {
      console.error(`  ATLANDI: ${p.email} — auth ID bulunamadı`)
      continue
    }

    await prisma.user.upsert({
      where: { id: authId },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        role: 'staff',
        organizationId: org.id,
        departmentId: departments[p.deptIndex].id,
        title: p.title,
        isActive: true,
      },
      create: {
        id: authId,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        role: 'staff',
        title: p.title,
        organizationId: org.id,
        departmentId: departments[p.deptIndex].id,
        isActive: true,
        kvkkNoticeAcknowledgedAt: daysAgo(randomInt(30, 90)),
      },
    })

    userIds.push(authId)
    createdCount++
    if (createdCount % 50 === 0) {
      console.log(`  DB ilerleme: ${createdCount}/${personnelData.length}`)
    }
  }
  console.log(`  ${createdCount} kullanıcı veritabanına eklendi`)

  // ── 5. Training assignments + exam attempts ──
  console.log('\n[5/6] Eğitim atamaları ve sınav denemeleri oluşturuluyor...')

  /*
   * Distribution plan (200 users):
   * - Users 0-59 (60): Completed 2+ trainings (passed exams, certificates)
   * - Users 60-119 (60): Completed 1 training, 1 in-progress
   * - Users 120-159 (40): In-progress (assigned, partially done)
   * - Users 160-199 (40): Just assigned (not started)
   */

  let assignmentCount = 0
  let attemptCount = 0
  let certCount = 0

  // Get existing certificate count for unique codes
  const existingCertCount = await prisma.certificate.count({
    where: { certificateCode: { startsWith: 'DEMO-' } },
  })
  let certIndex = existingCertCount

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i]

    // Determine which trainings to assign (2-4 trainings per user)
    const numTrainings = i < 120 ? randomInt(2, 4) : randomInt(1, 3)
    const shuffled = [...trainings].sort(() => Math.random() - 0.5)
    const assignedTrainings = shuffled.slice(0, Math.min(numTrainings, shuffled.length))

    for (let t = 0; t < assignedTrainings.length; t++) {
      const training = assignedTrainings[t]
      let status: string
      let currentAttempt: number
      let completedAt: Date | null = null
      const assignedAt = daysAgo(randomInt(15, 90))

      if (i < 60) {
        // Group 1: All completed
        status = 'completed'
        currentAttempt = 1
        completedAt = daysAgo(randomInt(1, 14))
      } else if (i < 120) {
        // Group 2: First training completed, rest in-progress or assigned
        if (t === 0) {
          status = 'completed'
          currentAttempt = 1
          completedAt = daysAgo(randomInt(1, 20))
        } else {
          status = Math.random() > 0.5 ? 'in_progress' : 'assigned'
          currentAttempt = status === 'in_progress' ? 1 : 0
        }
      } else if (i < 160) {
        // Group 3: In-progress
        status = t === 0 ? 'in_progress' : 'assigned'
        currentAttempt = status === 'in_progress' ? 1 : 0
      } else {
        // Group 4: Just assigned
        status = 'assigned'
        currentAttempt = 0
      }

      // Upsert assignment
      const assignment = await prisma.trainingAssignment.upsert({
        where: { trainingId_userId: { trainingId: training.id, userId } },
        update: { status, currentAttempt, completedAt },
        create: {
          trainingId: training.id,
          userId,
          status,
          currentAttempt,
          maxAttempts: training.maxAttempts,
          assignedById: admin.id,
          assignedAt,
          completedAt,
        },
      })
      assignmentCount++

      // Create exam attempt for completed and in-progress
      if (status === 'completed' || status === 'in_progress') {
        const existingAttempt = await prisma.examAttempt.findUnique({
          where: { assignmentId_attemptNumber: { assignmentId: assignment.id, attemptNumber: 1 } },
        })

        if (!existingAttempt) {
          const isPassed = status === 'completed'
          const preScore = randomInt(40, 85)
          const postScore = isPassed ? randomInt(training.passingScore, 100) : randomInt(30, training.passingScore - 1)
          const examDate = completedAt ?? daysAgo(randomInt(1, 10))

          const attempt = await prisma.examAttempt.create({
            data: {
              assignmentId: assignment.id,
              userId,
              trainingId: training.id,
              attemptNumber: 1,
              preExamScore: preScore,
              postExamScore: isPassed ? postScore : (status === 'in_progress' ? null : postScore),
              preExamStartedAt: new Date(examDate.getTime() - 90 * 60 * 1000),
              preExamCompletedAt: new Date(examDate.getTime() - 70 * 60 * 1000),
              postExamStartedAt: isPassed ? new Date(examDate.getTime() - 40 * 60 * 1000) : null,
              postExamCompletedAt: isPassed ? examDate : null,
              videosCompletedAt: new Date(examDate.getTime() - 45 * 60 * 1000),
              isPassed,
              status: isPassed ? 'completed' : (status === 'in_progress' ? 'video_watching' : 'post_exam'),
            },
          })
          attemptCount++

          // Create exam answers
          for (const question of training.questions) {
            const correctOption = question.options.find((o) => o.isCorrect)
            if (!correctOption) continue

            // Pre-exam: random correctness
            const preCorrect = Math.random() > 0.4 // ~60% correct on pre
            const preOption = preCorrect
              ? correctOption
              : question.options.find((o) => !o.isCorrect) ?? correctOption

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
                selectedOptionId: preOption.id,
                isCorrect: preCorrect,
                examPhase: 'pre',
              },
            })

            // Post-exam: higher correctness for passed
            if (isPassed) {
              const postCorrect = Math.random() > 0.15 // ~85% correct on post for passed
              const postOption = postCorrect
                ? correctOption
                : question.options.find((o) => !o.isCorrect) ?? correctOption

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
                  selectedOptionId: postOption.id,
                  isCorrect: postCorrect,
                  examPhase: 'post',
                },
              })
            }
          }

          // Create certificate for completed
          if (isPassed) {
            certIndex++
            const certCode = `DEMO-2026-${String(certIndex).padStart(4, '0')}`

            const existingCert = await prisma.certificate.findUnique({
              where: { attemptId: attempt.id },
            })

            if (!existingCert) {
              try {
                await prisma.certificate.create({
                  data: {
                    userId,
                    trainingId: training.id,
                    attemptId: attempt.id,
                    certificateCode: certCode,
                    issuedAt: examDate,
                    expiresAt: new Date(examDate.getTime() + 365 * 24 * 60 * 60 * 1000),
                  },
                })
                certCount++
              } catch {
                // Certificate code collision — skip
              }
            }
          }
        }
      }
    }

    // Progress log
    if ((i + 1) % 20 === 0) {
      console.log(`  Personel ilerleme: ${i + 1}/200 — ${assignmentCount} atama, ${attemptCount} sınav, ${certCount} sertifika`)
    }
  }

  // ── 6. Create some failed attempts for realism ──
  console.log('\n[6/6] Başarısız sınav denemeleri ekleniyor...')
  // Pick 30 random completed users and add a failed first attempt
  const completedAssignments = await prisma.trainingAssignment.findMany({
    where: {
      status: 'completed',
      userId: { in: userIds.slice(0, 60) },
      training: { organizationId: org.id },
    },
    take: 30,
  })

  let failedCount = 0
  for (const assignment of completedAssignments.slice(0, 30)) {
    // Check if attempt 2 exists (meaning attempt 1 was a retry)
    const existingAttempt2 = await prisma.examAttempt.findUnique({
      where: { assignmentId_attemptNumber: { assignmentId: assignment.id, attemptNumber: 2 } },
    })
    if (existingAttempt2) continue

    // Move existing attempt 1 to attempt 2
    const attempt1 = await prisma.examAttempt.findUnique({
      where: { assignmentId_attemptNumber: { assignmentId: assignment.id, attemptNumber: 1 } },
    })
    if (!attempt1) continue

    // Update existing to attempt 2
    await prisma.examAttempt.update({
      where: { id: attempt1.id },
      data: { attemptNumber: 2 },
    })

    // Update assignment current attempt
    await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: { currentAttempt: 2 },
    })

    // Create a failed attempt 1
    const failedDate = new Date(attempt1.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000)
    await prisma.examAttempt.create({
      data: {
        assignmentId: assignment.id,
        userId: assignment.userId,
        trainingId: assignment.trainingId,
        attemptNumber: 1,
        preExamScore: randomInt(30, 55),
        postExamScore: randomInt(35, 65),
        preExamStartedAt: new Date(failedDate.getTime() - 60 * 60 * 1000),
        preExamCompletedAt: new Date(failedDate.getTime() - 45 * 60 * 1000),
        postExamStartedAt: new Date(failedDate.getTime() - 30 * 60 * 1000),
        postExamCompletedAt: failedDate,
        videosCompletedAt: new Date(failedDate.getTime() - 35 * 60 * 1000),
        isPassed: false,
        status: 'completed',
      },
    })
    failedCount++
  }
  console.log(`  ${failedCount} başarısız deneme eklendi`)

  // ── SUMMARY ──
  console.log('\n================================================')
  console.log('  Seed Tamamlandı!')
  console.log('================================================')
  console.log(`
  Yeni Personel    : ${createdCount}
  Eğitim Atamaları : ${assignmentCount}
  Sınav Denemeleri : ${attemptCount}
  Sertifikalar     : ${certCount}
  Başarısız Sınav  : ${failedCount}
  Şifre (tümü)     : ${DEMO_PASSWORD}

  Email formatı: demo1@demo.hastanelms.com ... demo200@demo.hastanelms.com

  Dağılım:
  - 60 personel: Tüm eğitimleri tamamlamış (sertifikalı)
  - 60 personel: 1 eğitim tamamlamış, diğerleri devam ediyor
  - 40 personel: Eğitimlere başlamış (in-progress)
  - 40 personel: Sadece atanmış (henüz başlamamış)
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
