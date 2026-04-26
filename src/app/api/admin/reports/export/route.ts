import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  errorResponse,
  createAuditLog,
} from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from '@/lib/pdf/helpers/font'
import type { UserRole } from '@/types/database'

// ── Sabitler ──
// Vercel serverless RAM guard — 5000 eğitim + 5000 personel güvenli üst sınır.
const REPORT_TRAINING_CAP = 5000
const REPORT_STAFF_CAP = 5000

type ReportSection =
  | 'overview'
  | 'training'
  | 'staff'
  | 'department'
  | 'failure'
  | 'score-comparison'
  | 'duration'

const SECTION_TITLES: Record<ReportSection, string> = {
  'overview': 'Genel Özet Raporu',
  'training': 'Eğitim Bazlı Performans Raporu',
  'staff': 'Personel Performans Raporu',
  'department': 'Departman Analiz Raporu',
  'failure': 'Başarısızlık Analiz Raporu',
  'score-comparison': 'Ön / Son Sınav Karşılaştırma Raporu',
  'duration': 'Süre Analiz Raporu',
}

// Brand renkleri (PDF/Excel ortak)
const BRAND_PRIMARY: [number, number, number] = [13, 150, 104] // #0d9668
const BRAND_ACCENT: [number, number, number] = [245, 158, 11]
const COLOR_SUCCESS: [number, number, number] = [22, 163, 74]
const COLOR_WARNING: [number, number, number] = [202, 138, 4]
const COLOR_DANGER: [number, number, number] = [220, 38, 38]
const COLOR_MUTED: [number, number, number] = [100, 116, 139]
const COLOR_BORDER: [number, number, number] = [226, 232, 240]
const COLOR_SURFACE_ALT: [number, number, number] = [248, 250, 252]

// Excel renkleri (ARGB — alpha önde)
const XL = {
  primary: 'FF0D9668',
  primaryLight: 'FFECFDF5',
  accent: 'FFF59E0B',
  success: 'FF16A34A',
  successBg: 'FFECFDF5',
  warning: 'FFCA8A04',
  warningBg: 'FFFEF9C3',
  danger: 'FFDC2626',
  dangerBg: 'FFFEE2E2',
  muted: 'FF64748B',
  text: 'FF0F172A',
  border: 'FFE2E8F0',
  zebra: 'FFF8FAFC',
}

// ── Excel helpers ──

function sanitizeCell(value: unknown): string | number {
  if (typeof value === 'number') return value
  const str = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`
  return str
}

/**
 * Bir worksheet'e kurumsal rapor başlığı ekler: hastane adı, rapor başlığı,
 * tarih + filtre bilgisi + (varsa) kırpma uyarısı. Her zaman 1-4. satırları
 * kullanır, 5. satır boş bırakılır — data header'ı 6. satıra düşer.
 */
function addWorkbookMetadata(
  ws: ExcelJS.Worksheet,
  orgName: string,
  sectionTitle: string,
  meta: { dateLabel: string; filterLabel?: string; truncationLabel?: string },
  colSpan: number,
) {
  // Başlık satırı (kurum)
  const r1 = ws.addRow([orgName])
  r1.height = 26
  r1.font = { bold: true, size: 16, color: { argb: XL.primary }, name: 'Arial' }
  ws.mergeCells(r1.number, 1, r1.number, colSpan)
  r1.alignment = { vertical: 'middle' }

  // Alt başlık (section title)
  const r2 = ws.addRow([sectionTitle])
  r2.height = 20
  r2.font = { bold: true, size: 12, color: { argb: XL.text }, name: 'Arial' }
  ws.mergeCells(r2.number, 1, r2.number, colSpan)

  // Tarih + filtre
  const metaParts = [meta.dateLabel]
  if (meta.filterLabel) metaParts.push(meta.filterLabel)
  const r3 = ws.addRow([metaParts.join('   ·   ')])
  r3.font = { size: 10, color: { argb: XL.muted }, italic: true, name: 'Arial' }
  ws.mergeCells(r3.number, 1, r3.number, colSpan)

  // Kırpma uyarısı
  if (meta.truncationLabel) {
    const r4 = ws.addRow([`⚠ ${meta.truncationLabel}`])
    r4.font = { size: 10, bold: true, color: { argb: XL.danger }, name: 'Arial' }
    ws.mergeCells(r4.number, 1, r4.number, colSpan)
  }

  ws.addRow([]) // Boşluk
}

/**
 * Veri header satırına brand stili uygular. Row numarasını verirsen o satır
 * stilize edilir; aksi halde bir sonraki eklenen satır kullanılır.
 */
function styleHeaderRow(row: ExcelJS.Row, bgColor: string = XL.primary) {
  row.height = 28
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
  row.alignment = { horizontal: 'center', vertical: 'middle' }
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: XL.border } },
      bottom: { style: 'medium', color: { argb: XL.text } },
      left: { style: 'thin', color: { argb: XL.border } },
      right: { style: 'thin', color: { argb: XL.border } },
    }
  })
}

function applyZebraStripes(ws: ExcelJS.Worksheet, startRow: number, endRow: number, colCount: number) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    row.height = 20
    if ((r - startRow) % 2 === 1) {
      for (let c = 1; c <= colCount; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.zebra } }
      }
    }
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: XL.border } },
      }
      if (!cell.font) cell.font = { name: 'Arial', size: 10 }
    })
  }
}

function colorRateCell(cell: ExcelJS.Cell, rate: number) {
  if (rate >= 80) cell.font = { bold: true, color: { argb: XL.success }, name: 'Arial' }
  else if (rate >= 60) cell.font = { bold: true, color: { argb: XL.warning }, name: 'Arial' }
  else cell.font = { bold: true, color: { argb: XL.danger }, name: 'Arial' }
}

// ── PDF helpers ──

/**
 * Kapak sayfası: ortalanmış brand banner, hastane adı, section başlığı,
 * tarih + filtre + (varsa) kırpma uyarısı.
 *
 * A4 landscape (297 x 210mm) üzerinde çalışır.
 */
function renderCoverPage(
  doc: jsPDF,
  orgName: string,
  sectionTitle: string,
  dateLabel: string,
  filterLabel: string | null,
  truncationLabel: string | null,
) {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  // Üst brand şerit
  doc.setFillColor(...BRAND_PRIMARY)
  doc.rect(0, 0, pw, 32, 'F')
  // Accent çizgi
  doc.setFillColor(...BRAND_ACCENT)
  doc.rect(0, 32, pw, 1.5, 'F')

  // "Rapor" etiketi
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('KURUMSAL RAPOR', pw / 2, 14, { align: 'center' })

  // Hastane adı (üst)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text(orgName, pw / 2, 24, { align: 'center' })

  // Orta blok — section başlığı
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(26)
  doc.setTextColor(15, 23, 42)
  doc.text(sectionTitle, pw / 2, ph / 2 - 8, { align: 'center' })

  // İnce divider
  const divY = ph / 2 - 2
  doc.setDrawColor(...BRAND_PRIMARY)
  doc.setLineWidth(0.6)
  doc.line(pw / 2 - 30, divY, pw / 2 + 30, divY)

  // Tarih
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(`Rapor Tarihi: ${dateLabel}`, pw / 2, ph / 2 + 8, { align: 'center' })

  // Filtre
  if (filterLabel) {
    doc.setFontSize(10)
    doc.text(filterLabel, pw / 2, ph / 2 + 16, { align: 'center' })
  }

  // Kırpma uyarısı
  if (truncationLabel) {
    doc.setFontSize(10)
    doc.setTextColor(...COLOR_DANGER)
    doc.text(`⚠ ${truncationLabel}`, pw / 2, ph / 2 + (filterLabel ? 26 : 18), { align: 'center' })
  }

  // Alt notu — gizlilik + kurumsal
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR_MUTED)
  doc.text('Gizli · Kurumsal İç Kullanım', pw / 2, ph - 14, { align: 'center' })
}

/**
 * 2. sayfadan itibaren her sayfaya header şerit + footer ekler.
 * Cover (sayfa 1) atlanır.
 */
function renderChrome(doc: jsPDF, orgName: string, sectionTitle: string, dateLabel: string) {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const total = doc.getNumberOfPages()

  for (let p = 2; p <= total; p++) {
    doc.setPage(p)

    // Header şerit
    doc.setFillColor(...BRAND_PRIMARY)
    doc.rect(0, 0, pw, 2, 'F')

    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(orgName, 10, 9)
    doc.text(sectionTitle, pw - 10, 9, { align: 'right' })

    doc.setDrawColor(...COLOR_BORDER)
    doc.setLineWidth(0.1)
    doc.line(10, 11, pw - 10, 11)

    // Footer
    const footerY = ph - 8
    doc.line(10, footerY - 4, pw - 10, footerY - 4)
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(`${dateLabel} · Gizli`, 10, footerY)
    doc.text(`Sayfa ${p} / ${total}`, pw - 10, footerY, { align: 'right' })
  }
}

/**
 * KPI kartı çizer: renkli başlık + büyük değer. 4-6 kart yan yana dizilir.
 *
 * Kartlar cover page ile karışmasın diye yeni sayfada çağrılmalı.
 */
function renderKpiCards(
  doc: jsPDF,
  cards: Array<{ label: string; value: string; color: [number, number, number] }>,
  startY: number,
): number {
  const pw = doc.internal.pageSize.getWidth()
  const margin = 10
  const gap = 4
  const cardH = 28
  const cardW = (pw - margin * 2 - gap * (cards.length - 1)) / cards.length

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + gap)

    // Kart arka planı
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...COLOR_BORDER)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD')

    // Üst renk şeridi
    doc.setFillColor(...card.color)
    doc.roundedRect(x, startY, cardW, 3, 2, 2, 'F')
    // Köşe overlap'i maskele
    doc.setFillColor(...card.color)
    doc.rect(x, startY + 1, cardW, 2, 'F')

    // Label
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(card.label.toUpperCase(), x + 4, startY + 11)

    // Değer
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text(card.value, x + 4, startY + 22)
  })

  return startY + cardH + 8
}

/**
 * Bir section başlığı (içerik sayfasında üst) çizer, startY döndürür.
 */
function renderSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BRAND_PRIMARY)
  doc.text(text, 10, y)

  // Alt çizgi
  doc.setDrawColor(...BRAND_PRIMARY)
  doc.setLineWidth(0.4)
  doc.line(10, y + 1.5, 45, y + 1.5)

  return y + 6
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ── Data fetcher ──

async function fetchReportData(orgId: string, dateFrom?: Date, dateTo?: Date) {
  const assignmentDateFilter = dateFrom || dateTo ? {
    assignedAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  const attemptDateFilter = dateFrom || dateTo ? {
    createdAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  const [org, staffCount, totalTrainings, totalStaff, trainings, staff, departments, avgScoreResult] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true } }),
    prisma.training.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole } }),
    prisma.training.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        title: true,
        examDurationMinutes: true,
        assignments: {
          where: { ...assignmentDateFilter },
          select: {
            status: true,
            user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
            examAttempts: {
              orderBy: { attemptNumber: 'desc' },
              take: 1,
              select: {
                postExamScore: true,
                preExamScore: true,
                isPassed: true,
                status: true,
                attemptNumber: true,
              },
            },
          },
        },
        videos: { select: { durationSeconds: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: REPORT_TRAINING_CAP,
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' satisfies UserRole },
      select: {
        firstName: true,
        lastName: true,
        assignments: {
          where: { ...assignmentDateFilter },
          select: {
            status: true,
            training: { select: { title: true } },
            examAttempts: {
              orderBy: { attemptNumber: 'desc' },
              take: 1,
              select: { postExamScore: true, isPassed: true, status: true, attemptNumber: true },
            },
          },
        },
        departmentRel: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: REPORT_STAFF_CAP,
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      select: {
        name: true,
        users: {
          where: { role: 'staff' satisfies UserRole, isActive: true },
          select: {
            assignments: {
              where: { ...assignmentDateFilter },
              select: {
                status: true,
                examAttempts: {
                  orderBy: { attemptNumber: 'desc' },
                  take: 1,
                  select: { postExamScore: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.examAttempt.aggregate({
      where: { training: { organizationId: orgId }, postExamScore: { not: null }, ...attemptDateFilter },
      _avg: { postExamScore: true },
    }),
  ])

  const truncated = {
    trainings: totalTrainings > REPORT_TRAINING_CAP ? { shown: trainings.length, total: totalTrainings } : null,
    staff: totalStaff > REPORT_STAFF_CAP ? { shown: staff.length, total: totalStaff } : null,
  }

  return { org, staffCount, trainings, staff, departments, avgScoreResult, truncated }
}

// ── Rapor handler ──

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`report-export:${dbUser!.organizationId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla dışa aktarma isteği. Lütfen bekleyin.', 429)

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)
  const format = (searchParams.get('format') ?? 'xlsx') as 'pdf' | 'xlsx'
  const section = (searchParams.get('section') ?? 'overview') as ReportSection
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  if (!SECTION_TITLES[section]) {
    return errorResponse('Geçersiz rapor bölümü', 400)
  }

  try {
    const { org, staffCount, trainings, staff, departments, avgScoreResult, truncated } =
      await fetchReportData(orgId, dateFrom, dateTo)

    const orgName = org?.name ?? 'Hastane'
    const sectionTitle = SECTION_TITLES[section]
    const dateStr = new Date().toISOString().slice(0, 10)
    const dateLabel = new Date().toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    // ── Filtre & uyarı etiketleri ──
    let filterLabel: string | null = null
    if (dateFrom || dateTo) {
      const f = dateFrom ? dateFrom.toLocaleDateString('tr-TR') : '…'
      const t = dateTo ? dateTo.toLocaleDateString('tr-TR') : '…'
      filterLabel = `Filtre: ${f} – ${t}`
    }
    let truncationLabel: string | null = null
    if (truncated.trainings || truncated.staff) {
      const parts: string[] = []
      if (truncated.trainings) parts.push(`${truncated.trainings.total} eğitimden ${truncated.trainings.shown} tanesi`)
      if (truncated.staff) parts.push(`${truncated.staff.total} personelden ${truncated.staff.shown} tanesi`)
      truncationLabel = `${parts.join(', ')} raporda yer alıyor. Filtre uygulayın.`
    }

    // ── Özet hesaplamalar ──
    const allAssignments = trainings.flatMap(t => t.assignments)
    const totalAssigned = allAssignments.length
    const passedCount = allAssignments.filter(a => a.status === 'passed').length
    const failedCount = allAssignments.filter(a => a.status === 'failed').length
    const avgScore = avgScoreResult._avg.postExamScore ? Math.round(Number(avgScoreResult._avg.postExamScore)) : 0
    const completionRate = totalAssigned > 0 ? Math.round((passedCount / totalAssigned) * 100) : 0

    // Training rows
    const trainingRows = trainings.map(t => {
      const scores = t.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
      const assigned = t.assignments.length
      const completed = t.assignments.filter(a => a.status === 'passed').length
      const failed = t.assignments.filter(a => a.status === 'failed').length
      const avgTrainingScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0
      return { title: t.title, assigned, completed, failed, avgScore: avgTrainingScore, rate }
    })

    // Staff rows
    const staffRows = staff.map(s => {
      const completed = s.assignments.filter(a => a.status === 'passed').length
      const failed = s.assignments.filter(a => a.status === 'failed').length
      const scores = s.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(sc => sc != null).map(Number)
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const status = avg >= 80 ? 'Yıldız' : avg >= 50 ? 'Normal' : s.assignments.length > 0 ? 'Risk' : 'Yeni'
      return {
        name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        dept: s.departmentRel?.name ?? '-',
        totalAssigned: s.assignments.length,
        completed,
        failed,
        avgScore: avg,
        status,
      }
    }).sort((a, b) => b.avgScore - a.avgScore)

    // Department rows
    const deptRows = departments.map(d => {
      const allDeptAssignments = d.users.flatMap(u => u.assignments)
      const passed = allDeptAssignments.filter(a => a.status === 'passed').length
      const failed = allDeptAssignments.filter(a => a.status === 'failed').length
      const rate = allDeptAssignments.length > 0 ? Math.round((passed / allDeptAssignments.length) * 100) : 0
      const scores = allDeptAssignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
      const avgDept = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      return { name: d.name, personel: d.users.length, totalAssigned: allDeptAssignments.length, passed, failed, rate, avgScore: avgDept }
    }).sort((a, b) => b.rate - a.rate)

    // Failure rows
    const failureRows = staff.flatMap(s =>
      s.assignments
        .filter(a => a.status === 'failed')
        .map(a => ({
          name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
          dept: s.departmentRel?.name ?? '-',
          training: a.training?.title ?? '-',
          attempts: a.examAttempts[0]?.attemptNumber ?? 0,
          lastScore: a.examAttempts[0]?.postExamScore ? Number(a.examAttempts[0].postExamScore) : 0,
        })),
    ).sort((a, b) => b.attempts - a.attempts)

    // Score comparison rows
    const scoreComparison = trainings.map(t => {
      const preScores = t.assignments.map(a => a.examAttempts[0]?.preExamScore).filter(s => s != null).map(Number)
      const postScores = t.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
      const pre = preScores.length > 0 ? Math.round(preScores.reduce((a, b) => a + b, 0) / preScores.length) : 0
      const post = postScores.length > 0 ? Math.round(postScores.reduce((a, b) => a + b, 0) / postScores.length) : 0
      return { title: t.title, preScore: pre, postScore: post, improvement: post - pre, sampleSize: postScores.length }
    }).filter(d => d.sampleSize > 0)
      .sort((a, b) => b.improvement - a.improvement)

    // Duration rows
    const durationRows = trainings.map(t => {
      const videoSec = t.videos.reduce((sum, v) => sum + v.durationSeconds, 0)
      const videoMin = Math.round(videoSec / 60)
      const examMin = t.examDurationMinutes ?? 30
      return { title: t.title, videoMin, examMin, totalMin: videoMin + examMin }
    }).sort((a, b) => b.totalMin - a.totalMin)

    // ── PDF ──
    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      await applyTurkishFont(doc)

      renderCoverPage(doc, orgName, sectionTitle, dateLabel, filterLabel, truncationLabel)

      // İçerik sayfaları
      doc.addPage()
      let y = 18

      const tableBase = {
        theme: 'grid' as const,
        styles: { font: TURKISH_FONT_FAMILY, fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42] as [number, number, number], lineColor: COLOR_BORDER, lineWidth: 0.1 },
        headStyles: { font: TURKISH_FONT_FAMILY, fontStyle: 'bold' as const, fillColor: BRAND_PRIMARY, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, halign: 'left' as const, cellPadding: 3 },
        alternateRowStyles: { fillColor: COLOR_SURFACE_ALT },
        margin: { top: 14, bottom: 14, left: 10, right: 10 },
      }

      if (section === 'overview') {
        y = renderSectionTitle(doc, 'Performans Göstergeleri', y)
        y = renderKpiCards(doc, [
          { label: 'Aktif Personel', value: String(staffCount), color: BRAND_PRIMARY },
          { label: 'Toplam Atama', value: String(totalAssigned), color: [59, 130, 246] },
          { label: 'Başarılı', value: String(passedCount), color: COLOR_SUCCESS },
          { label: 'Başarısız', value: String(failedCount), color: COLOR_DANGER },
          { label: 'Başarı Oranı', value: `%${completionRate}`, color: BRAND_ACCENT },
          { label: 'Ort. Puan', value: String(avgScore), color: [139, 92, 246] },
        ], y)

        // En iyi 5 personel
        const top5 = staffRows.slice(0, 5)
        if (top5.length > 0) {
          y = renderSectionTitle(doc, 'En İyi 5 Personel', y + 2)
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['#', 'Ad Soyad', 'Departman', 'Tamamlanan', 'Ort. Puan']],
            body: top5.map((s, i) => [String(i + 1), s.name, s.dept, String(s.completed), `${s.avgScore}`]),
            columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } },
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          y = (doc as any).lastAutoTable.finalY + 6
        }

        // Risk altındakiler
        const risky = staffRows.filter(s => s.status === 'Risk').slice(0, 5)
        if (risky.length > 0) {
          y = renderSectionTitle(doc, 'Risk Altındaki Personel', y)
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['#', 'Ad Soyad', 'Departman', 'Başarısız', 'Ort. Puan']],
            body: risky.map((s, i) => [String(i + 1), s.name, s.dept, String(s.failed), `${s.avgScore}`]),
            headStyles: { ...tableBase.headStyles, fillColor: COLOR_DANGER },
            columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } },
          })
        }
      }

      if (section === 'training') {
        y = renderKpiCards(doc, [
          { label: 'Toplam Eğitim', value: String(trainings.length), color: BRAND_PRIMARY },
          { label: 'Toplam Atama', value: String(totalAssigned), color: [59, 130, 246] },
          { label: 'Başarı Oranı', value: `%${completionRate}`, color: COLOR_SUCCESS },
          { label: 'Ort. Puan', value: String(avgScore), color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Eğitim Bazlı Performans', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Eğitim', 'Atanan', 'Tamamlayan', 'Başarısız', 'Ort. Puan', 'Başarı %']],
          body: trainingRows.map(t => [
            truncate(t.title, 60), String(t.assigned), String(t.completed),
            String(t.failed), String(t.avgScore), `%${t.rate}`,
          ]),
          columnStyles: {
            0: { cellWidth: 110 },
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              const val = parseInt(String(data.cell.raw).replace('%', '') || '0')
              if (val >= 80) data.cell.styles.textColor = COLOR_SUCCESS
              else if (val >= 60) data.cell.styles.textColor = COLOR_WARNING
              else data.cell.styles.textColor = COLOR_DANGER
            }
          },
        })
      }

      if (section === 'staff') {
        const stars = staffRows.filter(s => s.status === 'Yıldız').length
        const risks = staffRows.filter(s => s.status === 'Risk').length
        y = renderKpiCards(doc, [
          { label: 'Toplam Personel', value: String(staffRows.length), color: BRAND_PRIMARY },
          { label: 'Yıldız', value: String(stars), color: COLOR_SUCCESS },
          { label: 'Risk Altında', value: String(risks), color: COLOR_DANGER },
          { label: 'Ort. Puan', value: String(avgScore), color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Personel Performans Detayı', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Ad Soyad', 'Departman', 'Atanan', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Durum']],
          body: staffRows.map(s => [
            s.name, s.dept, String(s.totalAssigned),
            String(s.completed), String(s.failed),
            String(s.avgScore), s.status,
          ]),
          columnStyles: {
            0: { cellWidth: 55 }, 1: { cellWidth: 40 },
            2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
              const text = String(data.cell.raw)
              if (text === 'Yıldız') { data.cell.styles.textColor = COLOR_SUCCESS; data.cell.styles.fontStyle = 'bold' }
              else if (text === 'Risk') { data.cell.styles.textColor = COLOR_DANGER; data.cell.styles.fontStyle = 'bold' }
              else if (text === 'Normal') { data.cell.styles.textColor = COLOR_MUTED }
            }
          },
        })
      }

      if (section === 'department') {
        y = renderKpiCards(doc, [
          { label: 'Departman', value: String(deptRows.length), color: BRAND_PRIMARY },
          { label: 'Toplam Personel', value: String(deptRows.reduce((s, d) => s + d.personel, 0)), color: [59, 130, 246] },
          { label: 'Başarı Oranı', value: `%${completionRate}`, color: COLOR_SUCCESS },
          { label: 'Ort. Puan', value: String(avgScore), color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Departman Bazlı Analiz', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Departman', 'Personel', 'Atama', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Başarı %']],
          body: deptRows.map(d => [
            d.name, String(d.personel), String(d.totalAssigned),
            String(d.passed), String(d.failed),
            String(d.avgScore), `%${d.rate}`,
          ]),
          columnStyles: {
            0: { cellWidth: 70 },
            1: { halign: 'right' }, 2: { halign: 'right' },
            3: { halign: 'right' }, 4: { halign: 'right' },
            5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
              const val = parseInt(String(data.cell.raw).replace('%', '') || '0')
              if (val >= 80) data.cell.styles.textColor = COLOR_SUCCESS
              else if (val >= 60) data.cell.styles.textColor = COLOR_WARNING
              else data.cell.styles.textColor = COLOR_DANGER
            }
          },
        })
      }

      if (section === 'failure') {
        const uniqueFailedStaff = new Set(failureRows.map(f => f.name)).size
        const uniqueFailedTrainings = new Set(failureRows.map(f => f.training)).size
        y = renderKpiCards(doc, [
          { label: 'Toplam Başarısızlık', value: String(failureRows.length), color: COLOR_DANGER },
          { label: 'Etkilenen Personel', value: String(uniqueFailedStaff), color: COLOR_DANGER },
          { label: 'Etkilenen Eğitim', value: String(uniqueFailedTrainings), color: COLOR_WARNING },
          { label: 'Ort. Son Puan', value: failureRows.length > 0 ? String(Math.round(failureRows.reduce((s, f) => s + f.lastScore, 0) / failureRows.length)) : '0', color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Başarısızlık Detayları', y)
        if (failureRows.length === 0) {
          doc.setFont(TURKISH_FONT_FAMILY, 'normal')
          doc.setFontSize(11)
          doc.setTextColor(...COLOR_MUTED)
          doc.text('Bu dönem için başarısızlık kaydı yok.', 10, y + 8)
        } else {
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['Ad Soyad', 'Departman', 'Eğitim', 'Deneme', 'Son Puan']],
            body: failureRows.map(f => [
              f.name, f.dept, truncate(f.training, 50),
              String(f.attempts), String(f.lastScore),
            ]),
            headStyles: { ...tableBase.headStyles, fillColor: COLOR_DANGER },
            columnStyles: {
              0: { cellWidth: 50 }, 1: { cellWidth: 40 }, 2: { cellWidth: 90 },
              3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' },
            },
          })
        }
      }

      if (section === 'score-comparison') {
        const avgPre = scoreComparison.length > 0 ? Math.round(scoreComparison.reduce((s, x) => s + x.preScore, 0) / scoreComparison.length) : 0
        const avgPost = scoreComparison.length > 0 ? Math.round(scoreComparison.reduce((s, x) => s + x.postScore, 0) / scoreComparison.length) : 0
        y = renderKpiCards(doc, [
          { label: 'Ort. Ön Sınav', value: `%${avgPre}`, color: COLOR_WARNING },
          { label: 'Ort. Son Sınav', value: `%${avgPost}`, color: COLOR_SUCCESS },
          { label: 'Gelişim', value: `${avgPost - avgPre >= 0 ? '+' : ''}${avgPost - avgPre} pts`, color: BRAND_PRIMARY },
          { label: 'Ölçülen Eğitim', value: String(scoreComparison.length), color: [59, 130, 246] },
        ], y)

        y = renderSectionTitle(doc, 'Ön / Son Sınav Karşılaştırma', y)
        if (scoreComparison.length === 0) {
          doc.setFont(TURKISH_FONT_FAMILY, 'normal')
          doc.setFontSize(11)
          doc.setTextColor(...COLOR_MUTED)
          doc.text('Yeterli veri yok — ön/son sınav tamamlanmış eğitim bulunamadı.', 10, y + 8)
        } else {
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['Eğitim', 'Ön Sınav', 'Son Sınav', 'Gelişim', 'Örneklem']],
            body: scoreComparison.map(s => [
              truncate(s.title, 70),
              `%${s.preScore}`, `%${s.postScore}`,
              `${s.improvement >= 0 ? '+' : ''}${s.improvement}`,
              String(s.sampleSize),
            ]),
            columnStyles: {
              0: { cellWidth: 130 },
              1: { halign: 'right' }, 2: { halign: 'right' },
              3: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'right' },
            },
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 3) {
                const raw = String(data.cell.raw)
                const val = parseInt(raw.replace('+', '') || '0')
                if (val > 0) data.cell.styles.textColor = COLOR_SUCCESS
                else if (val < 0) data.cell.styles.textColor = COLOR_DANGER
              }
            },
          })
        }
      }

      if (section === 'duration') {
        const totalVideoMin = durationRows.reduce((s, d) => s + d.videoMin, 0)
        const totalExamMin = durationRows.reduce((s, d) => s + d.examMin, 0)
        y = renderKpiCards(doc, [
          { label: 'Toplam Eğitim', value: String(durationRows.length), color: BRAND_PRIMARY },
          { label: 'Toplam Video', value: `${totalVideoMin} dk`, color: [59, 130, 246] },
          { label: 'Toplam Sınav', value: `${totalExamMin} dk`, color: BRAND_ACCENT },
          { label: 'Genel Toplam', value: `${totalVideoMin + totalExamMin} dk`, color: COLOR_SUCCESS },
        ], y)

        y = renderSectionTitle(doc, 'Süre Analiz Detayı', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Eğitim', 'Video (dk)', 'Sınav (dk)', 'Toplam (dk)']],
          body: durationRows.map(d => [
            truncate(d.title, 80), String(d.videoMin), String(d.examMin), String(d.totalMin),
          ]),
          columnStyles: {
            0: { cellWidth: 160 },
            1: { halign: 'right' }, 2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' },
          },
        })
      }

      renderChrome(doc, orgName, sectionTitle, dateLabel)

      const pdfBuffer = doc.output('arraybuffer')

      await createAuditLog({
        userId: dbUser!.id,
        organizationId: orgId,
        action: 'report.export',
        entityType: 'export',
        entityId: orgId,
        newData: { format: 'pdf', section },
        request,
      })

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="rapor-${section}-${dateStr}.pdf"`,
        },
      })
    }

    // ── Excel ──
    const wb = new ExcelJS.Workbook()
    wb.creator = orgName
    wb.company = orgName
    wb.title = sectionTitle
    wb.created = new Date()

    const metaArgs = { dateLabel: `Rapor Tarihi: ${dateLabel}`, filterLabel: filterLabel ?? undefined, truncationLabel: truncationLabel ?? undefined }

    if (section === 'overview') {
      const ws = wb.addWorksheet('Genel Özet', {
        views: [{ state: 'frozen', ySplit: 6 }],
        properties: { defaultRowHeight: 20 },
      })
      ws.columns = [
        { key: 'metric', width: 34 },
        { key: 'value', width: 20 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 2)

      const headerRow = ws.addRow(['Metrik', 'Değer'])
      styleHeaderRow(headerRow)

      const metrics: Array<{ label: string; value: string | number; color?: string }> = [
        { label: 'Aktif Personel', value: staffCount },
        { label: 'Toplam Eğitim', value: trainings.length },
        { label: 'Toplam Atama', value: totalAssigned },
        { label: 'Başarılı', value: passedCount, color: XL.success },
        { label: 'Başarısız', value: failedCount, color: XL.danger },
        { label: 'Başarı Oranı', value: completionRate / 100, color: completionRate >= 80 ? XL.success : completionRate >= 60 ? XL.warning : XL.danger },
        { label: 'Ortalama Puan', value: avgScore },
      ]
      for (const m of metrics) {
        const r = ws.addRow([m.label, m.value])
        r.getCell(1).font = { bold: true, name: 'Arial', size: 10 }
        if (m.label === 'Başarı Oranı') {
          r.getCell(2).numFmt = '0%'
        }
        if (m.color) {
          r.getCell(2).font = { bold: true, color: { argb: m.color }, name: 'Arial', size: 11 }
        } else {
          r.getCell(2).font = { bold: true, name: 'Arial', size: 11 }
        }
        r.getCell(2).alignment = { horizontal: 'right' }
      }
      applyZebraStripes(ws, headerRow.number + 1, ws.rowCount, 2)

      // Top 5 performers sheet
      if (staffRows.length > 0) {
        const wsTop = wb.addWorksheet('En İyi 5', { views: [{ state: 'frozen', ySplit: 6 }] })
        wsTop.columns = [
          { header: 'Sıra', key: 'rank', width: 8 },
          { header: 'Ad Soyad', key: 'name', width: 28 },
          { header: 'Departman', key: 'dept', width: 22 },
          { header: 'Tamamlanan', key: 'completed', width: 14 },
          { header: 'Ort. Puan', key: 'avgScore', width: 14 },
        ]
        addWorkbookMetadata(wsTop, orgName, 'En İyi 5 Personel', metaArgs, 5)
        const headerTop = wsTop.addRow(['Sıra', 'Ad Soyad', 'Departman', 'Tamamlanan', 'Ort. Puan'])
        styleHeaderRow(headerTop)
        staffRows.slice(0, 5).forEach((s, i) => {
          const r = wsTop.addRow([i + 1, sanitizeCell(s.name), sanitizeCell(s.dept), s.completed, s.avgScore])
          colorRateCell(r.getCell(5), s.avgScore)
        })
        applyZebraStripes(wsTop, headerTop.number + 1, wsTop.rowCount, 5)
        wsTop.autoFilter = { from: { row: headerTop.number, column: 1 }, to: { row: wsTop.rowCount, column: 5 } }
      }
    }

    if (section === 'training') {
      const ws = wb.addWorksheet('Eğitim Bazlı', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Eğitim', key: 'title', width: 50 },
        { header: 'Atanan', key: 'assigned', width: 12 },
        { header: 'Tamamlayan', key: 'completed', width: 14 },
        { header: 'Başarısız', key: 'failed', width: 12 },
        { header: 'Ort. Puan', key: 'avgScore', width: 12 },
        { header: 'Başarı %', key: 'rate', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 6)
      const hdr = ws.addRow(['Eğitim', 'Atanan', 'Tamamlayan', 'Başarısız', 'Ort. Puan', 'Başarı %'])
      styleHeaderRow(hdr)

      for (const t of trainingRows) {
        const row = ws.addRow([sanitizeCell(t.title), t.assigned, t.completed, t.failed, t.avgScore, t.rate / 100])
        row.getCell(6).numFmt = '0%'
        colorRateCell(row.getCell(6), t.rate)
        if (t.failed > 0) row.getCell(4).font = { color: { argb: XL.danger }, bold: true, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 6)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 6 } }
    }

    if (section === 'staff') {
      const ws = wb.addWorksheet('Personel', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Ad Soyad', key: 'name', width: 28 },
        { header: 'Departman', key: 'dept', width: 22 },
        { header: 'Atanan', key: 'totalAssigned', width: 12 },
        { header: 'Başarılı', key: 'completed', width: 12 },
        { header: 'Başarısız', key: 'failed', width: 12 },
        { header: 'Ort. Puan', key: 'avgScore', width: 12 },
        { header: 'Durum', key: 'status', width: 14 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 7)
      const hdr = ws.addRow(['Ad Soyad', 'Departman', 'Atanan', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Durum'])
      styleHeaderRow(hdr)

      const statusBg: Record<string, string> = {
        'Yıldız': XL.successBg, 'Normal': XL.primaryLight, 'Risk': XL.dangerBg, 'Yeni': 'FFE2E8F0',
      }
      const statusColor: Record<string, string> = {
        'Yıldız': XL.success, 'Normal': XL.muted, 'Risk': XL.danger, 'Yeni': XL.muted,
      }
      for (const s of staffRows) {
        const row = ws.addRow([
          sanitizeCell(s.name), sanitizeCell(s.dept),
          s.totalAssigned, s.completed, s.failed, s.avgScore, s.status,
        ])
        colorRateCell(row.getCell(6), s.avgScore)
        const statusCell = row.getCell(7)
        statusCell.font = { bold: true, color: { argb: statusColor[s.status] ?? XL.muted }, name: 'Arial', size: 10 }
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg[s.status] ?? 'FFF8FAFC' } }
        statusCell.alignment = { horizontal: 'center' }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 7)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 7 } }
    }

    if (section === 'department') {
      const ws = wb.addWorksheet('Departman', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Departman', key: 'name', width: 28 },
        { header: 'Personel', key: 'personel', width: 12 },
        { header: 'Atama', key: 'totalAssigned', width: 12 },
        { header: 'Başarılı', key: 'passed', width: 12 },
        { header: 'Başarısız', key: 'failed', width: 12 },
        { header: 'Ort. Puan', key: 'avgScore', width: 12 },
        { header: 'Başarı %', key: 'rate', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 7)
      const hdr = ws.addRow(['Departman', 'Personel', 'Atama', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Başarı %'])
      styleHeaderRow(hdr)

      for (const d of deptRows) {
        const row = ws.addRow([
          sanitizeCell(d.name), d.personel, d.totalAssigned, d.passed, d.failed,
          d.avgScore, d.rate / 100,
        ])
        row.getCell(7).numFmt = '0%'
        colorRateCell(row.getCell(7), d.rate)
        if (d.failed > 0) row.getCell(5).font = { color: { argb: XL.danger }, bold: true, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 7)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 7 } }
    }

    if (section === 'failure') {
      const ws = wb.addWorksheet('Başarısızlık', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Ad Soyad', key: 'name', width: 26 },
        { header: 'Departman', key: 'dept', width: 22 },
        { header: 'Eğitim', key: 'training', width: 45 },
        { header: 'Deneme', key: 'attempts', width: 10 },
        { header: 'Son Puan', key: 'lastScore', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 5)
      const hdr = ws.addRow(['Ad Soyad', 'Departman', 'Eğitim', 'Deneme', 'Son Puan'])
      styleHeaderRow(hdr, XL.danger)

      for (const f of failureRows) {
        const row = ws.addRow([
          sanitizeCell(f.name), sanitizeCell(f.dept), sanitizeCell(f.training),
          f.attempts, f.lastScore,
        ])
        row.getCell(5).font = { bold: true, color: { argb: XL.danger }, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 5)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 5 } }
    }

    if (section === 'score-comparison') {
      const ws = wb.addWorksheet('Skor Analizi', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Eğitim', key: 'title', width: 50 },
        { header: 'Ön Sınav', key: 'preScore', width: 12 },
        { header: 'Son Sınav', key: 'postScore', width: 12 },
        { header: 'Gelişim', key: 'improvement', width: 12 },
        { header: 'Örneklem', key: 'sampleSize', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 5)
      const hdr = ws.addRow(['Eğitim', 'Ön Sınav', 'Son Sınav', 'Gelişim', 'Örneklem'])
      styleHeaderRow(hdr)

      for (const s of scoreComparison) {
        const row = ws.addRow([
          sanitizeCell(s.title),
          s.preScore / 100, s.postScore / 100,
          s.improvement,
          s.sampleSize,
        ])
        row.getCell(2).numFmt = '0%'
        row.getCell(3).numFmt = '0%'
        const impCell = row.getCell(4)
        impCell.numFmt = '+0;-0;0'
        if (s.improvement > 0) impCell.font = { bold: true, color: { argb: XL.success }, name: 'Arial', size: 10 }
        else if (s.improvement < 0) impCell.font = { bold: true, color: { argb: XL.danger }, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 5)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 5 } }
    }

    if (section === 'duration') {
      const ws = wb.addWorksheet('Süre Analizi', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Eğitim', key: 'title', width: 55 },
        { header: 'Video (dk)', key: 'videoMin', width: 14 },
        { header: 'Sınav (dk)', key: 'examMin', width: 14 },
        { header: 'Toplam (dk)', key: 'totalMin', width: 14 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 4)
      const hdr = ws.addRow(['Eğitim', 'Video (dk)', 'Sınav (dk)', 'Toplam (dk)'])
      styleHeaderRow(hdr)

      for (const d of durationRows) {
        const row = ws.addRow([sanitizeCell(d.title), d.videoMin, d.examMin, d.totalMin])
        row.getCell(4).font = { bold: true, name: 'Arial', size: 10 }
      }

      // Toplam satırı
      if (durationRows.length > 0) {
        const totalVideo = durationRows.reduce((s, d) => s + d.videoMin, 0)
        const totalExam = durationRows.reduce((s, d) => s + d.examMin, 0)
        const totalRow = ws.addRow(['TOPLAM', totalVideo, totalExam, totalVideo + totalExam])
        totalRow.font = { bold: true, name: 'Arial', size: 11, color: { argb: 'FFFFFFFF' } }
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.primary } }
      }
      applyZebraStripes(ws, hdr.number + 1, durationRows.length > 0 ? ws.rowCount - 1 : ws.rowCount, 4)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number + durationRows.length, column: 4 } }
    }

    const buffer = await wb.xlsx.writeBuffer()

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'report.export',
      entityType: 'export',
      entityId: orgId,
      newData: { format: 'xlsx', section },
      request,
    })

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rapor-${section}-${dateStr}.xlsx"`,
      },
    })
  } catch (err) {
    logger.error('report-export', 'Export failed', { error: err, section })
    return errorResponse('Rapor dışa aktarma sırasında hata oluştu', 500)
  }
}
