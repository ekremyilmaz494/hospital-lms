import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, locale: string = 'tr-TR'): string {
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return 'Geçersiz tarih';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsed);
  } catch {
    return 'Geçersiz tarih';
  }
}

export function formatDateTime(date: string | Date, locale: string = 'tr-TR'): string {
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return 'Geçersiz tarih';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return 'Geçersiz tarih';
  }
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'success',
    trial: 'info',
    suspended: 'warning',
    expired: 'error',
    cancelled: 'error',
    assigned: 'info',
    in_progress: 'warning',
    passed: 'success',
    failed: 'error',
    locked: 'error',
  };
  return colors[status] || 'info';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Aktif',
    trial: 'Deneme',
    suspended: 'Askıda',
    expired: 'Süresi Doldu',
    cancelled: 'İptal',
    assigned: 'Atandı',
    in_progress: 'Devam Ediyor',
    passed: 'Başarılı',
    failed: 'Başarısız',
    locked: 'Kilitli',
    pre_exam: 'Ön Sınav',
    watching_videos: 'Video İzleme',
    post_exam: 'Son Sınav',
    completed: 'Tamamlandı',
  };
  return labels[status] || status;
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/** TC Kimlik numarasini maskeler: "12345678901" → "123****8901" */
export function maskeTcNo(tcNo: string | null | undefined): string {
  if (!tcNo || tcNo.length !== 11) return '';
  return `${tcNo.slice(0, 3)}****${tcNo.slice(-4)}`;
}
