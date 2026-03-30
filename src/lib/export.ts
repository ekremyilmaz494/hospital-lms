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

export function exportExcel(reportData?: ReportData) {
  if (!reportData?.headers || !reportData?.rows || reportData.rows.length === 0) {
    throw new Error('Dışa aktarılacak veri bulunamadı.');
  }

  const headers = reportData.headers;
  const rows = reportData.rows;

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(c => csvCell(c)).join(',')),
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
      row.map(cell => (cell == null ? '' : String(cell)))
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

/**
 * B6.4/G6.3 — CSV formula injection koruması.
 * =, +, -, @ ile başlayan değerler Excel/Sheets'te formül olarak yorumlanır.
 * OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
 */
function csvCell(value: string | number | boolean | null | undefined): string {
  const str = value == null ? '' : String(value)
  // Formül injection tetikleyici karakterlerini ' ile escape et
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  // Çift tırnak içinde sar; içindeki tırnakları ikile
  return `"${sanitized.replace(/"/g, '""')}"`
}
