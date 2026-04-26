/**
 * NotebookLM worker servisi (Fly.io) için HMAC-imzalı HTTP client.
 *
 * Worker = ayrı bir Docker container'da çalışan Express servisi
 * (`packages/notebook-worker/`). Vercel serverless `notebooklm-py`'i
 * Python+Playwright bağımlılığı yüzünden çalıştıramaz; o yüzden tüm
 * NotebookLM çağrıları bu worker'a forward edilir.
 *
 * Auth: shared secret `WORKER_HMAC_SECRET` (env). Her istekte
 * `X-Worker-Signature` header'ı = HMAC-SHA256(timestamp + method + path + body, secret).
 * Replay attack önleme: timestamp 5 dakikadan eski reddedilir.
 */
import crypto from 'crypto'
import { logger } from '@/lib/logger'

const WORKER_TIMEOUT_MS = 30_000

function getConfig() {
  const baseUrl = process.env.NOTEBOOK_WORKER_URL
  const secret = process.env.WORKER_HMAC_SECRET
  if (!baseUrl || !secret) {
    throw new Error('[notebook-worker] NOTEBOOK_WORKER_URL ve WORKER_HMAC_SECRET ortam değişkenleri zorunlu.')
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), secret }
}

function sign(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const payload = `${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export interface WorkerCallOptions {
  method: 'GET' | 'POST' | 'DELETE'
  path: string // örn. "/api/generate"
  body?: unknown
  timeoutMs?: number
}

export interface WorkerError {
  status: number
  message: string
  workerError?: string
}

/**
 * Worker'a HMAC-imzalı istek gönder.
 * Hata durumunda WorkerError fırlatır — caller try/catch ile yakalamalı.
 */
export async function callWorker<T = unknown>(opts: WorkerCallOptions): Promise<T> {
  const { baseUrl, secret } = getConfig()
  const { method, path, body, timeoutMs = WORKER_TIMEOUT_MS } = opts
  const timestamp = Date.now().toString()
  const bodyStr = body == null ? '' : JSON.stringify(body)
  const signature = sign(timestamp, method, path, bodyStr, secret)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Timestamp': timestamp,
        'X-Worker-Signature': signature,
      },
      body: bodyStr || undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let workerError: string | undefined
      try {
        workerError = JSON.parse(text)?.error
      } catch {
        workerError = text.slice(0, 200) || undefined
      }
      const err: WorkerError = {
        status: res.status,
        message: `Worker ${method} ${path} → ${res.status}`,
        workerError,
      }
      logger.error('NotebookWorker', err.message, { status: res.status, workerError })
      throw err
    }

    return (await res.json()) as T
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw {
        status: 504,
        message: `Worker timeout after ${timeoutMs}ms`,
      } as WorkerError
    }
    if ((err as WorkerError).status) throw err
    logger.error('NotebookWorker', `Network error: ${(err as Error).message}`)
    throw {
      status: 502,
      message: 'Worker servisine ulaşılamıyor.',
    } as WorkerError
  } finally {
    clearTimeout(timer)
  }
}

// ─── Domain çağrıları (typed wrappers) ───

export interface UploadStorageStateRequest {
  orgId: string
  // notebooklm-py storage_state.json içeriği — JSON string olarak
  // Worker bunu kendi /data/{orgId}/storage_state.json olarak yazar.
  storageStateJson: string
}

export interface UploadStorageStateResponse {
  ok: true
  googleEmail?: string
}

export async function uploadStorageState(req: UploadStorageStateRequest) {
  return callWorker<UploadStorageStateResponse>({
    method: 'POST',
    path: '/api/login/storage-state',
    body: req,
  })
}

export interface VerifyAccountResponse {
  connected: boolean
  googleEmail?: string
  verifiedAt: string
}

export async function verifyAccount(orgId: string) {
  return callWorker<VerifyAccountResponse>({
    method: 'GET',
    path: `/api/login/status?orgId=${encodeURIComponent(orgId)}`,
  })
}

export async function deleteAccount(orgId: string) {
  return callWorker<{ ok: true }>({
    method: 'DELETE',
    path: `/api/login/storage-state?orgId=${encodeURIComponent(orgId)}`,
  })
}

export interface GenerateRequest {
  orgId: string
  generationId: string
  artifactType: string // CLI command form (slide-deck, mind-map, ...)
  prompt?: string
  language?: string
  // Worker bu URL'lere ulaşıp dosyayı indirmeli (S3 presigned read URL'leri)
  sourceFileUrls: Array<{ url: string; filename: string }>
  sourceUrls: string[]
  options: Record<string, string>
  // Worker output'u buraya upload edecek (S3 presigned PUT URL)
  uploadUrl: string
  outputExt: string
  outputMime: string
}

export interface GenerateResponse {
  workerJobId: string
  status: 'pending' | 'processing'
}

export async function startGeneration(req: GenerateRequest) {
  return callWorker<GenerateResponse>({
    method: 'POST',
    path: '/api/generate',
    body: req,
    timeoutMs: 60_000,
  })
}

export interface JobStatusResponse {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
  uploadedSize?: number
  completedAt?: string
}

export async function getJobStatus(workerJobId: string) {
  return callWorker<JobStatusResponse>({
    method: 'GET',
    path: `/api/jobs/${encodeURIComponent(workerJobId)}`,
  })
}
