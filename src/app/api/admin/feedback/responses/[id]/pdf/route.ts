import { promises as fs } from 'node:fs'
import path from 'node:path'
import { jsPDF } from 'jspdf'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-logger'
import { drawFeedbackPage, type FeedbackDrawData, type LikertScore } from '@/lib/pdf/feedback-design'
import { applyTurkishFont } from '@/lib/pdf/helpers/font'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'

/**
 * GET /api/admin/feedback/responses/[id]/pdf
 *
 * Tek bir feedback yanıtının resmi formattaki PDF'ini üretir.
 * Layout: A4 portrait, tek sayfa — `src/lib/pdf/feedback-design.ts`.
 *
 * Veri kaynağı: response detay endpoint'i ile aynı snapshot-öncelikli pattern.
 * Admin sonradan formu değiştirmiş olsa bile yanıt anındaki soru metni korunur.
 *
 * Cache: private, 1 saat — admin aynı yanıtı tekrar indirmek isterse hızlı dönsün.
 * Logo asset'leri: hostpital → org.logoUrl (cert-logo helper),
 * bakanlık → public/logos/saglik-bakanligi.png (statik, opsiyonel).
 */

type SnapshotItem = {
  id: string
  text: string
  questionType: string
  order?: number
}
type SnapshotCategory = {
  id: string
  name: string
  order: number
  items: SnapshotItem[]
}
type FormSnapshot = {
  title: string
  documentCode?: string | null
  publishedAt?: string | null
  revisionNumber?: number | null
  revisionDate?: string | null
  categories: SnapshotCategory[]
}

let cachedMinistryLogo: string | null | undefined

/** Bakanlık logosu — public/logos/saglik-bakanligi.png. Process belleğinde cache. */
async function resolveMinistryLogo(): Promise<string | null> {
  if (cachedMinistryLogo !== undefined) return cachedMinistryLogo
  try {
    const p = path.join(process.cwd(), 'public', 'logos', 'saglik-bakanligi.png')
    const buf = await fs.readFile(p)
    cachedMinistryLogo = `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    cachedMinistryLogo = null
  }
  return cachedMinistryLogo
}

function fmtDateTR(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toLikertScore(score: number | null | undefined): LikertScore {
  if (score === null || score === undefined) return null
  if (score >= 1 && score <= 5 && Number.isInteger(score)) {
    return score as LikertScore
  }
  return null
}

export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params

  try {
    // Paralel: response detayı + bakanlık logosu (cache-hit ile genelde hızlı).
    const [response, ministryLogoDataUrl] = await Promise.all([
      prisma.trainingFeedbackResponse.findFirst({
        where: { id, organizationId },
        select: {
          id: true,
          submittedAt: true,
          includeName: true,
          isPassed: true,
          formSnapshot: true,
          training: {
            select: {
              title: true,
              startDate: true,
              instructorName: true,
              organization: { select: { name: true, logoUrl: true } },
            },
          },
          form: {
            select: {
              title: true,
              documentCode: true,
              publishedAt: true,
              revisionNumber: true,
              revisionDate: true,
              categories: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  name: true,
                  order: true,
                  items: {
                    orderBy: { order: 'asc' },
                    select: { id: true, text: true, questionType: true, order: true },
                  },
                },
              },
            },
          },
          user: {
            select: { firstName: true, lastName: true },
          },
          answers: {
            select: { itemId: true, score: true, textAnswer: true },
          },
        },
      }),
      resolveMinistryLogo(),
    ])

    if (!response) return errorResponse('Yanıt bulunamadı', 404)

    // Snapshot-öncelikli form yapısı çözümü (response/[id]/route.ts ile aynı pattern).
    const snapshot = response.formSnapshot as FormSnapshot | null
    const sourceCategories = snapshot?.categories ?? response.form.categories
    const sourceDocumentCode = snapshot?.documentCode ?? response.form.documentCode ?? '—'

    // Form metadata: snapshot'ta yoksa live form'dan, o da yoksa "—"
    const publishedAt = snapshot?.publishedAt
      ? new Date(snapshot.publishedAt)
      : response.form.publishedAt
    const revisionNumber = snapshot?.revisionNumber ?? response.form.revisionNumber ?? 0
    const revisionDate = snapshot?.revisionDate
      ? new Date(snapshot.revisionDate)
      : response.form.revisionDate

    // Answer lookup: itemId → score / textAnswer
    const answerByItem = new Map(
      response.answers
        .filter(a => a.itemId !== null)
        .map(a => [a.itemId as string, a]),
    )

    // PDF kategorilerini hazırla (likert/yes_partial_no/text)
    const drawCategories = sourceCategories.map(cat => ({
      name: cat.name,
      items: cat.items.map(item => {
        const ans = answerByItem.get(item.id)
        return {
          text: item.text,
          score: toLikertScore(ans?.score ?? null),
          textAnswer: ans?.textAnswer ?? null,
          questionType: (item.questionType as 'likert_5' | 'yes_partial_no' | 'text'),
        }
      }),
    }))

    // Genel ortalama: sadece sayısal cevapları say.
    // LikertScore = 1|2|3|4|5|null — type predicate'in parametre tipinin subtype'ı olması gerek.
    const numericScores = drawCategories
      .flatMap(c => c.items)
      .map(i => i.score)
      .filter((s): s is Exclude<LikertScore, null> => s !== null)
    const overallScore: number | null = numericScores.length > 0
      ? numericScores.reduce<number>((a, b) => a + b, 0) / numericScores.length
      : null

    // Hostane logosu (var olan helper, fallback davranışı zaten içinde)
    const hospitalLogoDataUrl = await resolveOrgLogoDataUrl(response.training.organization?.logoUrl)

    // Anonim yanıt: katılımcı satırı boş bırakılır (kullanıcının kararı —
    // "Anonim" etiketi değil, hücre boş kalsın).
    const participantName = response.includeName && response.user
      ? `${response.user.firstName} ${response.user.lastName}`.trim()
      : ''

    const data: FeedbackDrawData = {
      formTitle: 'EĞİTİM DEĞERLENDİRME ANKET FORMU',
      documentCode: sourceDocumentCode,
      publishedDate: fmtDateTR(publishedAt),
      // Revizyon Tarihi: ilk yayın anında revizyon yapılmadığı için "00"
      // gösterilir (revision no ile aynı semantik). Yeni revizyon yapıldığında
      // form metadata'sındaki revisionDate dolu olur ve TR formatlı tarih basılır.
      revisionDate: revisionDate ? fmtDateTR(revisionDate) : '00',
      revisionNumber: String(revisionNumber).padStart(2, '0'),
      pageNo: '1/1',

      trainingTitle: response.training.title,
      trainingDate: fmtDateTR(response.training.startDate),
      instructorName: response.training.instructorName,
      participantName,

      categories: drawCategories,

      isPassed: response.isPassed,
      overallScore,
      submittedDate: fmtDateTR(response.submittedAt),

      hospitalLogoDataUrl,
      ministryLogoDataUrl,
    }

    // Render
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    await applyTurkishFont(doc)
    drawFeedbackPage(doc, data)

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const fileName = `geri-bildirim-${response.id.slice(0, 8)}.pdf`

    // Audit log — feedback PDF indirme (KVKK/kurumsal denetim)
    void logActivity({
      userId: dbUser.id,
      organizationId,
      action: 'feedback_response_download',
      resourceType: 'training_feedback_response',
      resourceId: response.id,
      resourceTitle: response.training.title,
      metadata: { participantName, isPassed: response.isPassed },
    })

    // Node Buffer'ı Uint8Array view'a sar: Web BodyInit'le tip-uyumlu, kopya yok.
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    logger.error('FeedbackResponse PDF', 'PDF oluşturulamadı', { err, userId: dbUser.id, id })
    return errorResponse('PDF oluşturulamadı', 500)
  }
}, { requireOrganization: true })
