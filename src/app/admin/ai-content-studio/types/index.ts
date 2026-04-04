// AI İçerik Stüdyosu — Tip tanımları

export type OutputFormat =
  | 'AUDIO_OVERVIEW'
  | 'VIDEO_OVERVIEW'
  | 'INFOGRAPHIC'
  | 'STUDY_GUIDE'
  | 'QUIZ'
  | 'AUDIO_QUIZ'
  | 'FLASHCARDS'
  | 'SLIDE_DECK'

export type GenerationStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

export type EvaluationResult = 'approved' | 'rejected'

export interface UploadedDocument {
  id: string
  name: string
  size: number
  type: string
  s3Key: string
  s3Url: string
  uploadedAt: string
  summary?: string
  keyTopics?: string[]
}

export interface GenerationJob {
  id: string
  title: string
  format: OutputFormat
  status: GenerationStatus
  progress: number
  resultType?: 'audio' | 'video' | 'text' | 'json' | 'image' | 'presentation' | 'document'
  resultUrl?: string
  error?: string
  prompt: string
  settings: Record<string, string>
  documentIds: string[]
  evaluation?: EvaluationResult | null
  evaluationNote?: string | null
  evaluatedAt?: string | null
  savedToLibrary?: boolean
  createdAt: string
}

export interface ContentHistoryItem {
  id: string
  title: string
  format: OutputFormat
  status: GenerationStatus
  prompt: string
  createdAt: string
  evaluatedAt?: string
  evaluation?: EvaluationResult
  savedToLibrary?: boolean
  contentLibraryId?: string
}

export interface PromptTemplate {
  id: string
  label: string
  description: string
  template: string
  suggestedFormats: OutputFormat[]
  category: string
}
