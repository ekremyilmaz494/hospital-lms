const AI_SERVICE_URL = process.env.AI_CONTENT_SERVICE_URL ?? 'http://localhost:8100'
const INTERNAL_API_KEY = process.env.AI_CONTENT_INTERNAL_KEY ?? ''

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Key': INTERNAL_API_KEY,
  }
}

export interface StartGenerationParams {
  jobId: string
  format: string
  audioFormat?: string
  videoStyle?: string
  documentText: string
  documentTitle: string
  customInstructions?: string
}

export interface GenerationStatus {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  resultType?: string
  resultPath?: string
  error?: string
}

export interface AnalyzeResult {
  summary: string
  suggestedFormats: string[]
  keyTopics: string[]
  estimatedDurationMinutes: number
}

/** Servis çalışıyor mu kontrol eder */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Üretim işini başlatır */
export async function startGeneration(params: StartGenerationParams): Promise<{ jobId: string; status: string }> {
  const res = await fetch(`${AI_SERVICE_URL}/api/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      job_id: params.jobId,
      format: params.format,
      audio_format: params.audioFormat ?? 'DEEP_DIVE',
      video_style: params.videoStyle ?? 'EXPLAINER',
      document_text: params.documentText,
      document_title: params.documentTitle,
      custom_instructions: params.customInstructions,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `AI Service error: ${res.status}`)
  }
  return res.json()
}

/** İş durumunu sorgular */
export async function getStatus(jobId: string): Promise<GenerationStatus> {
  const res = await fetch(`${AI_SERVICE_URL}/api/status/${jobId}`, {
    headers: { 'X-Internal-Key': INTERNAL_API_KEY },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Status error: ${res.status}`)
  const data = await res.json()
  return {
    jobId: data.job_id,
    status: data.status,
    progress: data.progress,
    resultType: data.result_type,
    resultPath: data.result_path,
    error: data.error,
  }
}

/** Sonuç dosyasını Buffer olarak alır */
export async function getResult(jobId: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(`${AI_SERVICE_URL}/api/result/${jobId}`, {
    headers: { 'X-Internal-Key': INTERNAL_API_KEY },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Result error: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  return { buffer, contentType }
}

/** Belge metnini analiz eder */
export async function analyzeDocument(documentText: string, documentTitle: string): Promise<AnalyzeResult> {
  const res = await fetch(`${AI_SERVICE_URL}/api/analyze`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ document_text: documentText, document_title: documentTitle }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Analyze error: ${res.status}`)
  const data = await res.json()
  return {
    summary: data.summary,
    suggestedFormats: data.suggested_formats,
    keyTopics: data.key_topics,
    estimatedDurationMinutes: data.estimated_duration_minutes,
  }
}
