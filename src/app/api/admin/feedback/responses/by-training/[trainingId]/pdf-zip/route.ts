import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
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
 * GET /api/admin/feedback/responses/by-training/[trainingId]/pdf-zip
 *
 * Bir eğitime ait TÜM feedback yanıtlarının PDF'lerini ZIP olarak indirir.
 * Tek tıkla toplu indirme — admin yüzlerce yanıtı elle tek tek inmiyor.
 *
 * Tasarım:
 *  - Tek bir Prisma sorgusunda tüm response + ilişkili veriler (N+1 yok)
 *  - Logolar (hostane + bakanlık) sayfa başına bir kez resolve edilir, döngüde reuse
 *  - PDF'ler in-memory üretilir, JSZip ile paketlenir (Node'da streaming gerekmez)
 *  - 200 yanıt üst limiti — RAM patlamasını engellemek için, gerçek üst-uç use case
 *    bunun çok altında (büyük org bile eğitim başına 50-100 yanıt civarı)
 */

const MAX_RESPONSES_PER_ZIP = 200

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

/** Dosya adı için güvenli karakter dönüşümü (Türkçe + boşluk + özel karakter) */
function safeFileSegment(s: string, maxLen = 60): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
  }
  const ascii = s.replace(/[çÇğĞıİöÖşŞüÜ]/g, c => map[c] ?? c)
  return ascii
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
    || 'yanit'
}

export const GET = withAdminRoute<{ trainingId: string }>(async ({ params, dbUser, organizationId }) => {
  const { trainingId } = params

  try {
    // Eğitim sahipliği + tüm yanıtlar — tek round-trip
    const [training, responses, ministryLogoDataUrl] = await Promise.all([
      prisma.training.findFirst({
        where: { id: trainingId, organizationId },
        select: {
          id: true,
          title: true,
          startDate: true,
          instructorName: true,
          organization: { select: { name: true, logoUrl: true } },
        },
      }),
      prisma.trainingFeedbackResponse.findMany({
        where: { trainingId, organizationId },
        orderBy: { submittedAt: 'asc' },
        select: {
          id: true,
          submittedAt: true,
          includeName: true,
          isPassed: true,
          formSnapshot: true,
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
                  id: true, name: true, order: true,
                  items: {
                    orderBy: { order: 'asc' },
                    select: { id: true, text: true, questionType: true, order: true },
                  },
                },
              },
            },
          },
          user: { select: { firstName: true, lastName: true } },
          answers: { select: { itemId: true, score: true, textAnswer: true } },
        },
        take: MAX_RESPONSES_PER_ZIP + 1, // limit + 1 → guard
      }),
      resolveMinistryLogo(),
    ])

    if (!training) return errorResponse('Eğitim bulunamadı', 404)
    if (responses.length === 0) return errorResponse('Bu eğitime ait yanıt yok', 404)
    if (responses.length > MAX_RESPONSES_PER_ZIP) {
      return errorResponse(
        `Bu eğitimde ${MAX_RESPONSES_PER_ZIP}'den fazla yanıt var. Toplu indirme şu an desteklenmiyor.`,
        413,
      )
    }

    // Hastane logosu — eğitim için bir kez
    const organizationLogoDataUrl = await resolveOrgLogoDataUrl(training.organization?.logoUrl)

    // ZIP build
    const zip = new JSZip()
    const usedFileNames = new Set<string>()
    let failed = 0

    for (const response of responses) {
      try {
        const snapshot = response.formSnapshot as FormSnapshot | null
        const sourceCategories = snapshot?.categories ?? response.form.categories
        const sourceDocumentCode = snapshot?.documentCode ?? response.form.documentCode ?? '—'
        const publishedAt = snapshot?.publishedAt ? new Date(snapshot.publishedAt) : response.form.publishedAt
        const revisionNumber = snapshot?.revisionNumber ?? response.form.revisionNumber ?? 0
        const revisionDate = snapshot?.revisionDate ? new Date(snapshot.revisionDate) : response.form.revisionDate

        const answerByItem = new Map(
          response.answers.filter(a => a.itemId !== null).map(a => [a.itemId as string, a]),
        )

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

        const numericScores = drawCategories
          .flatMap(c => c.items)
          .map(i => i.score)
          .filter((s): s is Exclude<LikertScore, null> => s !== null)
        const overallScore: number | null = numericScores.length > 0
          ? numericScores.reduce<number>((a, b) => a + b, 0) / numericScores.length
          : null

        const participantName = response.includeName && response.user
          ? `${response.user.firstName} ${response.user.lastName}`.trim()
          : ''

        const data: FeedbackDrawData = {
          formTitle: 'EĞİTİM DEĞERLENDİRME ANKET FORMU',
          documentCode: sourceDocumentCode,
          publishedDate: fmtDateTR(publishedAt),
          revisionDate: revisionDate ? fmtDateTR(revisionDate) : '00',
          revisionNumber: String(revisionNumber).padStart(2, '0'),
          pageNo: '1/1',
          trainingTitle: training.title,
          trainingDate: fmtDateTR(training.startDate),
          instructorName: training.instructorName,
          participantName,
          categories: drawCategories,
          isPassed: response.isPassed,
          overallScore,
          submittedDate: fmtDateTR(response.submittedAt),
          organizationLogoDataUrl,
          ministryLogoDataUrl,
        }

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        await applyTurkishFont(doc)
        drawFeedbackPage(doc, data)
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

        // Dosya adı: gönderim tarihi + katılımcı veya kısa id; çakışma olursa suffix
        const datePart = response.submittedAt.toISOString().slice(0, 10)
        const namePart = participantName
          ? safeFileSegment(participantName, 40)
          : `anonim-${response.id.slice(0, 6)}`
        let fileName = `${datePart}_${namePart}.pdf`
        let suffix = 2
        while (usedFileNames.has(fileName)) {
          fileName = `${datePart}_${namePart}_${suffix}.pdf`
          suffix += 1
        }
        usedFileNames.add(fileName)
        zip.file(fileName, pdfBuffer)
      } catch (err) {
        failed += 1
        logger.error('FeedbackZip', 'Tek yanıt PDF üretilemedi', { err, responseId: response.id })
      }
    }

    if (zip.files && Object.keys(zip.files).length === 0) {
      return errorResponse('Hiçbir PDF üretilemedi', 500)
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const zipName = `geri-bildirimler-${safeFileSegment(training.title, 40)}.zip`

    // Audit log — toplu indirme (KVKK denetim için kritik)
    void logActivity({
      userId: dbUser.id,
      organizationId,
      action: 'feedback_response_bulk_download',
      resourceType: 'training',
      resourceId: training.id,
      resourceTitle: training.title,
      metadata: { responseCount: responses.length, failedCount: failed },
    })

    // Node Buffer'ı Uint8Array view'a sar: Web BodyInit'le tip-uyumlu, kopya yok.
    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': String(zipBuffer.length),
        // Toplu ZIP cache'lenmez — yanıt sayısı değişebilir, her seferinde taze.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error('FeedbackZip GET', 'ZIP oluşturulamadı', { err, userId: dbUser.id, trainingId })
    return errorResponse('PDF arşivi oluşturulamadı', 500)
  }
}, { requireOrganization: true })
