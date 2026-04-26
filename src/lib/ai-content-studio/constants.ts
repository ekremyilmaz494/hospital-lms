/**
 * AI İçerik Stüdyosu — sabitler.
 * Magic number kullanma — buradan import et (CLAUDE.md zorunluluk).
 */

// Desteklenen artifact tipleri (notebooklm-py CLI ile birebir eşleşir)
export const AI_ARTIFACT_TYPES = [
  'audio',
  'video',
  'slide_deck',
  'infographic',
  'report',
  'mind_map',
  'data_table',
  'quiz',
  'flashcards',
] as const
export type AiArtifactType = (typeof AI_ARTIFACT_TYPES)[number]

// CLI komut adı → artifact tipi (worker bunu kullanır)
export const ARTIFACT_TYPE_TO_CLI: Record<AiArtifactType, string> = {
  audio: 'audio',
  video: 'video',
  slide_deck: 'slide-deck',
  infographic: 'infographic',
  report: 'report',
  mind_map: 'mind-map',
  data_table: 'data-table',
  quiz: 'quiz',
  flashcards: 'flashcards',
}

// İndirme uzantısı — `notebooklm download <type> output.<ext>` için
export const ARTIFACT_TYPE_TO_EXT: Record<AiArtifactType, string> = {
  audio: 'mp3',
  video: 'mp4',
  slide_deck: 'pdf',
  infographic: 'png',
  report: 'md',
  mind_map: 'json',
  data_table: 'csv',
  quiz: 'json',
  flashcards: 'json',
}

export const ARTIFACT_TYPE_TO_MIME: Record<AiArtifactType, string> = {
  audio: 'audio/mpeg',
  video: 'video/mp4',
  slide_deck: 'application/pdf',
  infographic: 'image/png',
  report: 'text/markdown',
  mind_map: 'application/json',
  data_table: 'text/csv',
  quiz: 'application/json',
  flashcards: 'application/json',
}

export const AI_GEN_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const
export type AiGenStatus = (typeof AI_GEN_STATUSES)[number]

// Limitler
export const AI_MAX_PROMPT_LEN = 2000
export const AI_MAX_SOURCE_FILES = 5
export const AI_MAX_SOURCE_SIZE_MB = 50
export const AI_MAX_SOURCE_URLS = 5
// org başına: saatte 30 generation
export const AI_GEN_RATE_LIMIT_PER_HOUR = 30
// status polling — UI bu interval'le poll yapar
export const AI_STATUS_POLL_INTERVAL_MS = 5_000
// session expiry warning — son verify üzerinden geçen süre
export const AI_ACCOUNT_STALE_DAYS = 7

// Tipe özel options şemaları (worker'a gönderilir)
// notebooklm CLI flag'leriyle birebir eşleşir
export const ARTIFACT_OPTIONS_DEFAULTS: Record<AiArtifactType, Record<string, string>> = {
  audio: { format: 'deep-dive', length: 'default' },
  video: { format: 'explainer', style: 'auto' },
  slide_deck: { format: 'detailed', length: 'default' },
  infographic: { orientation: 'portrait', detail: 'standard', style: 'professional' },
  report: { format: 'briefing-doc' },
  mind_map: {},
  data_table: {},
  quiz: { difficulty: 'medium', quantity: 'standard' },
  flashcards: { difficulty: 'medium', quantity: 'standard' },
}

// UI'da gösterilen Türkçe metinler
export const ARTIFACT_TYPE_LABEL_TR: Record<AiArtifactType, string> = {
  audio: 'Podcast',
  video: 'Video',
  slide_deck: 'Sunum',
  infographic: 'İnfografik',
  report: 'Rapor',
  mind_map: 'Zihin Haritası',
  data_table: 'Veri Tablosu',
  quiz: 'Quiz',
  flashcards: 'Bilgi Kartları',
}

export const ARTIFACT_TYPE_DESC_TR: Record<AiArtifactType, string> = {
  audio: 'Sesli sohbet formatında özet — tipik 10-15 dk üretim süresi',
  video: 'Anlatımlı video — tipik 15-45 dk üretim süresi',
  slide_deck: 'PDF/PPTX sunum — tipik 5-15 dk üretim süresi',
  infographic: 'PNG infografik — tipik 5-15 dk üretim süresi',
  report: 'Markdown rapor (briefing/study-guide) — tipik 5-15 dk üretim süresi',
  mind_map: 'JSON zihin haritası — anında üretilir',
  data_table: 'CSV veri tablosu — tipik 5-15 dk üretim süresi',
  quiz: 'Çoktan seçmeli sınav — tipik 5-15 dk üretim süresi',
  flashcards: 'Tekrar bilgi kartları — tipik 5-15 dk üretim süresi',
}
