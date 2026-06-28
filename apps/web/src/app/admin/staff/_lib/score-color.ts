/**
 * Personel puan/ilerleme renk eşlemeleri — tablo kolonu ve mobil kart aynı eşikleri
 * paylaşsın (tekrar/drift önlenir). Eşikler personel sayfasının mevcut davranışıyla aynı.
 */

/** Ortalama puan (%) → CSS renk değişkeni. */
export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--k-success)';
  if (score >= 60) return 'var(--k-warning)';
  return 'var(--k-error)';
}

/** Tamamlanma yüzdesi → k-progress data-variant ('success' | 'warning' | undefined). */
export function progressVariant(pct: number): 'success' | 'warning' | undefined {
  if (pct > 80) return 'success';
  if (pct > 50) return undefined;
  return 'warning';
}
