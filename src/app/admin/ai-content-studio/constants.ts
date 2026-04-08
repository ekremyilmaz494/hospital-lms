// ── Dosya Yükleme Limitleri ──

export const MAX_FILE_SIZE = 20 * 1024 * 1024
export const MAX_FILES = 5
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
] as const
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt', '.md'] as const

// ── Polling ──

export const POLL_INTERVAL_FAST = 2000
export const POLL_INTERVAL_NORMAL = 5000
export const POLL_INTERVAL_SLOW = 10000
export const POLL_FAST_THRESHOLD = 30_000
export const POLL_NORMAL_THRESHOLD = 5 * 60_000

// ── Genel ──

export const GENERATION_TIMEOUT_MS = 75 * 60 * 1000
export const ITEMS_PER_PAGE = 12
export const MAX_INSTRUCTIONS_LENGTH = 2000
export const MAX_TITLE_LENGTH = 500

// ── Content-Type Mapping ──

export const CONTENT_TYPE_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  json: 'application/json',
  csv: 'text/csv',
  md: 'text/markdown',
}

// ── ResultType Mapping ──

export const RESULT_TYPE_MAP: Record<string, string> = {
  mp3: 'audio',
  mp4: 'video',
  pdf: 'presentation',
  pptx: 'presentation',
  png: 'image',
  json: 'json',
  csv: 'data',
  md: 'document',
}

// ── ArtifactType → Default Output Extension ──

export const ARTIFACT_EXTENSION_MAP: Record<string, string> = {
  audio: 'mp3',
  video: 'mp4',
  slide_deck: 'pdf',
  quiz: 'json',
  flashcards: 'json',
  report: 'md',
  infographic: 'png',
  data_table: 'csv',
  mind_map: 'json',
}
