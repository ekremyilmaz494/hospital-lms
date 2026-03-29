/**
 * Client-side export helpers — instant download without API calls
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ReportRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportData {
  headers?: string[];
  rows?: (string | number | boolean | null | undefined)[][];
}

/**
 * CSV injection koruması — hücre değeri tehlikeli karakterle başlıyorsa
 * tek tırnak ile önekler. =, +, -, @, \t, \r, \n karakterleri Excel'de
 * formül olarak yorumlanabilir.
 */
function sanitizeCellValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (/^[=+\-@\t\r\n]/.test(str)) {
    return `'${str}`
  }
  return str
}

export function exportExcel(reportData?: ReportData) {
  if (!reportData?.headers || !reportData?.rows || reportData.rows.length === 0) {
    throw new Error('Dışa aktarılacak veri bulunamadı.');
  }

  const headers = reportData.headers;
  const rows = reportData.rows;

  const csvContent = [
    headers.map(h => `"${sanitizeCellValue(h)}"`).join(','),
    ...rows.map(r => r.map(c => `"${sanitizeCellValue(c)}"`).join(',')),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `rapor-${formatDate()}.csv`);
}

export function exportPDF(reportData?: ReportData, title?: string) {
  if (!reportData?.headers || !reportData?.rows || reportData.rows.length === 0) {
    throw new Error('Dışa aktarılacak veri bulunamadı.');
  }

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text(title ?? 'Rapor', 14, 16);
  doc.setFontSize(9);
  doc.text(`Oluşturulma tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [reportData.headers],
    body: reportData.rows.map(row =>
      row.map(cell => sanitizeCellValue(cell))
    ),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [13, 150, 104] },
  });

  doc.save(`rapor-${formatDate()}.pdf`);
}

export function printPage() {
  window.print();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}
