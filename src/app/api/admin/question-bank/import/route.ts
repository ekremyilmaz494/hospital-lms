import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  createAuditLog,
} from '@/lib/api-helpers'

const CORRECT_MAP: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard']

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return errorResponse('Dosya bulunamadı', 400)
  }

  if (file.size > 5 * 1024 * 1024) {
    return errorResponse('Dosya boyutu 5MB sınırını aşıyor', 400)
  }

  const orgId = dbUser!.organizationId!

  try {
    const arrayBuffer = await file.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(arrayBuffer)

    const ws = wb.worksheets[0]
    if (!ws) return errorResponse('Excel dosyasında sayfa bulunamadı', 400)

    const rows: {
      text: string
      options: string[]
      correctIdx: number
      difficulty: string
      category: string
      points: number
    }[] = []
    let errorCount = 0

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Header satırı atla

      const text = String(row.getCell(1).value ?? '').trim()
      const optA = String(row.getCell(2).value ?? '').trim()
      const optB = String(row.getCell(3).value ?? '').trim()
      const optC = String(row.getCell(4).value ?? '').trim()
      const optD = String(row.getCell(5).value ?? '').trim()
      const correctLetter = String(row.getCell(6).value ?? '').trim().toUpperCase()
      const difficulty = String(row.getCell(7).value ?? 'medium').trim().toLowerCase()
      const category = String(row.getCell(8).value ?? 'Genel').trim()
      const points = Number(row.getCell(9).value) || 1

      // Validasyon
      if (text.length < 5) { errorCount++; return }
      if (!optA || !optB || !optC || !optD) { errorCount++; return }
      const correctIdx = CORRECT_MAP[correctLetter]
      if (correctIdx === undefined) { errorCount++; return }
      const diff = VALID_DIFFICULTIES.includes(difficulty) ? difficulty : 'medium'

      rows.push({
        text,
        options: [optA, optB, optC, optD],
        correctIdx,
        difficulty: diff,
        category,
        points: Math.min(Math.max(points, 1), 10),
      })
    })

    if (rows.length === 0) {
      return errorResponse(
        `İçe aktarılacak geçerli soru bulunamadı. ${errorCount} satır hatalı.`,
        400,
      )
    }

    // Transaction ile toplu kayıt
    await prisma.$transaction(
      async (tx) => {
        for (const row of rows) {
          await tx.questionBank.create({
            data: {
              organizationId: orgId,
              text: row.text,
              category: row.category,
              difficulty: row.difficulty,
              points: row.points,
              tags: [],
              options: {
                create: row.options.map((text, idx) => ({
                  text,
                  isCorrect: idx === row.correctIdx,
                  order: idx,
                })),
              },
            },
          })
        }
      },
      { timeout: 60000 },
    )

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'question_bank.import',
      entityType: 'question_bank',
      newData: { imported: rows.length, errors: errorCount },
      request,
    })

    return jsonResponse({
      imported: rows.length,
      errors: errorCount,
      total: rows.length + errorCount,
    })
  } catch (err) {
    return errorResponse(
      'Dosya işlenirken hata oluştu. Lütfen formatı kontrol edin.',
      500,
    )
  }
}
