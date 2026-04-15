/**
 * Akreditasyon raporu PDF orkestratörü.
 *
 * buildAccreditationPDF(ctx) → tüm section'ları sırayla render eder,
 * jsPDF instance'ı döndürür. Route sadece output'u stream eder.
 */
import { jsPDF } from 'jspdf'
import type { ReportContext } from './types'
import { PAGE, SPACING } from './theme'
import { renderCover } from './sections/cover'
import { renderExecutiveSummary } from './sections/executive-summary'
import { renderStandardsTable } from './sections/standards-table'
import { renderDepartmentAnalysis } from './sections/department-analysis'
import { renderTrainingGaps } from './sections/training-gaps'
import { renderActionPlan } from './sections/action-plan'
import { renderPageChrome, startNewPage, ensureSpace } from './sections/chrome'

export function buildAccreditationPDF(ctx: ReportContext): jsPDF {
  const doc = new jsPDF({
    orientation: PAGE.orientation,
    unit: PAGE.unit,
    format: PAGE.format,
    compress: true,
  })

  // Sayfa 1 — Kapak
  renderCover(doc, ctx)

  // Sayfa 2+ — İçerik
  let y = startNewPage(doc)
  y += 4 // Header altı boşluk

  y = renderExecutiveSummary(doc, ctx, y)
  y = ensureSpace(doc, y, 40)
  y += 2

  y = renderStandardsTable(doc, ctx, y)
  y = ensureSpace(doc, y, 40)

  y = renderDepartmentAnalysis(doc, ctx, y)
  y = ensureSpace(doc, y, 40)

  y = renderTrainingGaps(doc, ctx, y)
  y = ensureSpace(doc, y, 40)

  renderActionPlan(doc, ctx, y)

  // Header + footer her iç sayfaya (kapak hariç)
  renderPageChrome(doc, ctx)

  return doc
}

// SPACING reference bırakılıyor (section'larda kullanılıyor)
void SPACING
