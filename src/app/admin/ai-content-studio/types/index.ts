// ── Artifact Tipleri ──

export type ArtifactType =
  | 'audio'
  | 'video'
  | 'slide_deck'
  | 'quiz'
  | 'flashcards'
  | 'report'
  | 'infographic'
  | 'data_table'
  | 'mind_map'

// ── Üretim Durumları ──

export type GenerationStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'downloading'
  | 'completed'
  | 'failed'

// ── Sonuç Dosya Tipleri ──

export type ResultType =
  | 'audio'
  | 'video'
  | 'presentation'
  | 'json'
  | 'image'
  | 'document'
  | 'data'

// ── Değerlendirme ──

export type EvaluationResult = 'approved' | 'rejected'

// ── Kaynak Tipleri ──

export type SourceType = 'file' | 'url' | 'text' | 'youtube'

export type SourceStatus = 'uploading' | 'processing' | 'ready' | 'error'

// ── Yüklenen Belge ──

export interface UploadedDocument {
  id: string
  notebookId: string
  sourceLmId: string | null
  fileName: string
  fileType: string
  fileSize: number
  sourceType: SourceType
  sourceUrl: string | null
  status: SourceStatus
  summary: string | null
  keyTopics: string[] | null
  createdAt: string
}

// ── Üretim İşi (Tam Model) ──

export interface GenerationJob {
  id: string
  title: string
  artifactType: ArtifactType
  status: GenerationStatus
  progress: number
  resultType: ResultType | null
  error: string | null
  instructions: string | null
  settings: Record<string, string>
  evaluation: EvaluationResult | null
  evaluationNote: string | null
  evaluatedAt: string | null
  savedToLibrary: boolean
  contentLibraryId: string | null
  savedAt: string | null
  contentData: QuizData | FlashcardData | MindMapData | DataTableData | null
  createdAt: string
  updatedAt: string
}

// ── Liste Item (Hafif Model — grid kartları için) ──

export interface ContentHistoryItem {
  id: string
  title: string
  artifactType: ArtifactType
  status: GenerationStatus
  progress: number
  resultType: ResultType | null
  evaluation: EvaluationResult | null
  savedToLibrary: boolean
  error: string | null
  createdAt: string
  evaluatedAt: string | null
}

// ── Paginated Response ──

export interface ContentListResponse {
  items: ContentHistoryItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ── Quiz Veri Yapısı ──

export interface QuizQuestion {
  id: string | number
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export interface QuizData {
  title?: string
  questions: QuizQuestion[]
}

// ── Flashcard Veri Yapısı ──

export interface FlashCard {
  id: string | number
  front: string
  back: string
  category?: string
}

export interface FlashcardData {
  title?: string
  cards: FlashCard[]
}

// ── Zihin Haritası Veri Yapısı ──

export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
}

export interface MindMapData {
  title?: string
  rootNode: MindMapNode
}

// ── Veri Tablosu Veri Yapısı ──

export interface DataTableData {
  headers: string[]
  rows: string[][]
}

// ── Prompt Şablonu ──

export interface PromptTemplate {
  id: string
  label: string
  description: string
  template: string
  suggestedFormats: ArtifactType[]
  category: string
}

// ── Format Config ──

export interface FormatOption {
  key: string
  label: string
  values: { value: string; label: string }[]
  default: string
}

export interface FormatConfig {
  id: ArtifactType
  icon: string
  label: string
  description: string
  estimatedMinutes: number
  resultType: ResultType
  outputExtension: string
  options: FormatOption[]
}

// ── Ortak Ayar ──

export interface CommonSetting {
  key: string
  label: string
  icon: string
  values: { value: string; label: string }[]
  default: string
}

// ── Google Bağlantı Durumu ──

export interface GoogleConnectionStatus {
  connected: boolean
  email: string | null
  status: string | null
  lastVerifiedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  errorMessage: string | null
}
