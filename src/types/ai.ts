/**
 * AI feature ortak tipleri — hook'lar, UI component'ler, API çağrıları
 * arasında shared.
 */

/** AI soru üretimine kaynak olarak verilecek dosya.
 *  s3Key zorunlu; mimeType sunucuda extension'dan tahmin edilebiliyor ama
 *  client'tan göndermek daha güvenli. filename UI gösterimi için. */
export interface SourceFile {
  s3Key: string;
  mimeType?: string;
  filename?: string;
}
