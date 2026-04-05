/**
 * AI Content Service — Python sidecar HTTP client.
 * Tüm NotebookLM operasyonları bu client üzerinden yapılır.
 * org_id: Multi-tenant cookie yönetimi için X-Org-Id header gönderilir.
 */

const BASE_URL = process.env.AI_CONTENT_SERVICE_URL || 'http://localhost:8100'
const INTERNAL_KEY = process.env.AI_CONTENT_INTERNAL_KEY || ''

const TIMEOUTS = {
  auth: 180_000,
  generate: 60_000,
  wait: 130_000,
  default: 30_000,
} as const

// ── Error ──

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string = 'ai_service_error',
  ) {
    super(message)
    this.name = 'AiServiceError'
  }
}

// ── Internal Fetch Helper ──

interface FetchOptions {
  method?: string
  body?: unknown
  formData?: FormData
  timeout?: number
  rawResponse?: boolean
  orgId?: string
}

async function sidecarFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, timeout = TIMEOUTS.default, orgId } = opts
  const url = `${BASE_URL}/api${path}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const headers: Record<string, string> = {
    'X-Internal-Key': INTERNAL_KEY,
  }
  if (orgId) {
    headers['X-Org-Id'] = orgId
  }

  let fetchBody: BodyInit | undefined
  if (formData) {
    fetchBody = formData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    fetchBody = JSON.stringify(body)
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: fetchBody,
      signal: controller.signal,
    })

    if (opts.rawResponse) {
      return res as unknown as T
    }

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const msg = data?.message || data?.detail || `Sidecar ${res.status} hatası`
      throw new AiServiceError(msg, res.status, data?.error || 'sidecar_error')
    }

    return data as T
  } catch (err) {
    if (err instanceof AiServiceError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AiServiceError('AI servisi zaman aşımına uğradı', 504, 'timeout')
    }
    throw new AiServiceError('AI servisi yanıt vermiyor', 503, 'connection_error')
  } finally {
    clearTimeout(timer)
  }
}

// ── Response Types ──

export interface HealthResponse {
  status: string
  service: string
  version: string
  notebooklm: string
}

export interface AuthResponse {
  success: boolean
  message: string
}

export interface AuthVerifyResponse {
  valid: boolean
  error?: string
}

export interface NotebookResponse {
  id: string
  title: string
}

export interface NotebookListResponse {
  notebooks: NotebookResponse[]
}

export interface SourceAddResponse {
  source_id: string
  status: string
}

export interface SourceStatusResponse {
  source_id: string
  status: 'processing' | 'ready' | 'error'
  title?: string
}

export interface GenerateResponse {
  task_id: string | null
  artifact_id: string | null
  artifact_type: string
  status: string
}

export interface StatusResponse {
  task_id: string
  status: 'processing' | 'completed' | 'failed'
  progress: number
  artifact_id?: string
  error?: string
}

// ── Exported Functions ──

/** Health check */
export async function checkHealth(): Promise<HealthResponse> {
  return sidecarFetch<HealthResponse>('/health')
}

/** Browser login başlat — Playwright açılır, ~30-120s sürebilir. */
export async function login(browser: 'chromium' | 'msedge' = 'chromium', orgId?: string): Promise<AuthResponse> {
  return sidecarFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { browser },
    timeout: TIMEOUTS.auth,
    orgId,
  })
}

/** Mevcut cookie'lerin geçerliliğini kontrol et. */
export async function verifyAuth(orgId?: string): Promise<AuthVerifyResponse> {
  return sidecarFetch<AuthVerifyResponse>('/auth/verify', { method: 'POST', orgId })
}

/** Cookie'leri sil, client'ı kapat. */
export async function disconnectAuth(orgId?: string): Promise<AuthResponse> {
  return sidecarFetch<AuthResponse>('/auth/disconnect', { method: 'POST', orgId })
}

/** Yeni NotebookLM notebook'u oluştur. */
export async function createNotebook(title: string, orgId?: string): Promise<NotebookResponse> {
  return sidecarFetch<NotebookResponse>('/notebooks/create', {
    method: 'POST',
    body: { title },
    orgId,
  })
}

/** Tüm notebook'ları listele. */
export async function listNotebooks(orgId?: string): Promise<NotebookListResponse> {
  return sidecarFetch<NotebookListResponse>('/notebooks/list', { orgId })
}

/** Dosya kaynağı ekle — multipart/form-data. */
export async function addFileSource(
  notebookId: string,
  fileBuffer: Buffer,
  fileName: string,
  orgId?: string,
): Promise<SourceAddResponse> {
  const fd = new FormData()
  fd.append('notebook_id', notebookId)
  fd.append('source_type', 'file')
  fd.append('file', new Blob([new Uint8Array(fileBuffer)]), fileName)

  return sidecarFetch<SourceAddResponse>('/sources/add', {
    method: 'POST',
    formData: fd,
    orgId,
  })
}

/** URL/YouTube/Text kaynağı ekle — multipart/form-data. */
export async function addSource(
  notebookId: string,
  sourceType: 'url' | 'youtube' | 'text',
  opts: { url?: string; title?: string; content?: string },
  orgId?: string,
): Promise<SourceAddResponse> {
  const fd = new FormData()
  fd.append('notebook_id', notebookId)
  fd.append('source_type', sourceType)
  if (opts.url) fd.append('url', opts.url)
  if (opts.title) fd.append('title', opts.title)
  if (opts.content) fd.append('content', opts.content)

  return sidecarFetch<SourceAddResponse>('/sources/add', {
    method: 'POST',
    formData: fd,
    orgId,
  })
}

/** Kaynak işlenme durumunu sorgula. */
export async function getSourceStatus(
  notebookId: string,
  sourceId: string,
  orgId?: string,
): Promise<SourceStatusResponse> {
  return sidecarFetch<SourceStatusResponse>(`/sources/status/${notebookId}/${sourceId}`, { orgId })
}

/** Kaynak hazır olana kadar bekle (blocking, ~120s). */
export async function waitForSource(
  notebookId: string,
  sourceId: string,
  orgId?: string,
): Promise<SourceStatusResponse> {
  return sidecarFetch<SourceStatusResponse>(`/sources/wait/${notebookId}/${sourceId}`, {
    method: 'POST',
    timeout: TIMEOUTS.wait,
    orgId,
  })
}

/** Artifact üretimi başlat. */
export async function startGeneration(params: {
  notebook_id: string
  artifact_type: string
  instructions?: string
  settings?: Record<string, unknown>
}, orgId?: string): Promise<GenerateResponse> {
  return sidecarFetch<GenerateResponse>('/generate', {
    method: 'POST',
    body: params,
    timeout: TIMEOUTS.generate,
    orgId,
  })
}

/** Üretim durumunu sorgula. */
export async function getTaskStatus(
  notebookId: string,
  taskId: string,
  orgId?: string,
): Promise<StatusResponse> {
  return sidecarFetch<StatusResponse>(`/status/${notebookId}/${taskId}`, { orgId })
}

/** Tamamlanmış artifact'ı indir — Buffer olarak döner. */
export async function downloadArtifact(
  notebookId: string,
  artifactId: string,
  artifactType: string,
  outputFormat?: string,
  orgId?: string,
): Promise<Buffer> {
  const qs = new URLSearchParams({ artifact_type: artifactType })
  if (outputFormat) qs.set('output_format', outputFormat)

  const res = await sidecarFetch<Response>(
    `/download/${notebookId}/${artifactId}?${qs.toString()}`,
    { rawResponse: true, orgId },
  )

  if (!res.ok) {
    throw new AiServiceError('Artifact indirilemedi', res.status, 'download_error')
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
