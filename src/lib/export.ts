/**
 * Client-side export helpers — instant download without API calls
 */

export interface ReportRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportData {
  headers?: string[];
  rows?: (string | number | boolean | null | undefined)[][];
}

export function exportExcel(reportData?: ReportData) {
  // reportData varsa kullan, yoksa mevcut mock veri
  const headers = reportData?.headers ?? ['Ad Soyad', 'E-posta', 'Departman', 'Unvan', 'Durum', 'Ort. Puan', 'Eğitim'];
  const rows = reportData?.rows ?? [
    ['Elif Kaya', 'elif@hastane.com', 'Hemşirelik', 'Hemşire', 'Aktif', '92%', '5/6'],
    ['Mehmet Demir', 'mehmet@hastane.com', 'Acil Servis', 'Dr.', 'Aktif', '85%', '4/5'],
    ['Ayşe Yıldız', 'ayse@hastane.com', 'Radyoloji', 'Teknisyen', 'Aktif', '78%', '3/4'],
    ['Ali Veli', 'ali@hastane.com', 'Temizlik', 'Personel', 'Aktif', '55%', '2/3'],
    ['Fatma Ak', 'fatma@hastane.com', 'Hemşirelik', 'Hemşire', 'Aktif', '88%', '5/5'],
    ['Hasan Kılıç', 'hasan@hastane.com', 'Laboratuvar', 'Teknisyen', 'Aktif', '91%', '4/4'],
    ['Zeynep Arslan', 'zeynep@hastane.com', 'Eczane', 'Eczacı', 'Aktif', '95%', '6/6'],
    ['Can Türk', 'can@hastane.com', 'Güvenlik', 'Güvenlik', 'İzinli', '72%', '2/3'],
    ['Derya Öz', 'derya@hastane.com', 'İdari', 'Sekreter', 'Aktif', '80%', '3/4'],
    ['Murat Demir', 'murat@hastane.com', 'Acil Servis', 'Hemşire', 'Aktif', '87%', '4/5'],
    ['Selin Yılmaz', 'selin@hastane.com', 'Laboratuvar', 'Laborant', 'Aktif', '83%', '3/4'],
  ];

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${c ?? ''}"`).join(',')),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `rapor-${formatDate()}.csv`);
}

export function exportPDF() {
  // Tarayıcının print dialog'unu PDF olarak kaydetme ile aç
  window.print();
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
