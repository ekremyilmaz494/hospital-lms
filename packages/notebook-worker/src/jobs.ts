/**
 * Generation job orchestration.
 *
 * Tek bir HTTP isteğine cevap olarak şu adımları async yapar:
 *  1. Yeni notebook oluştur (notebooklm create --json)
 *  2. Source URL/dosyaları ekle (notebooklm source add ...)
 *  3. Source ready'lemesi için bekle (notebooklm source wait)
 *  4. Generation başlat (notebooklm generate <type> ...)
 *  5. Artifact tamamlanmasını bekle (notebooklm artifact wait)
 *  6. Lokal dosyaya indir (notebooklm download <type> /tmp/<jobId>/output.<ext>)
 *  7. Hospital LMS'in verdiği presigned PUT URL'e dosyayı upload et
 *  8. status='completed', uploadedSize ile bitir
 *
 * Hata olursa status='failed' + error message.
 *
 * Persistence: in-memory Map. Worker restart'ta job state kaybolur ama
 * Hospital LMS DB tarafında kayıt zaten var; status sorulamayan job
 * için LMS tarafı timeout sonrası 'failed' işaretler.
 */
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { runNotebooklm, parseCliJson, type RunResult } from './notebooklm.js'
import { resolveHomeForOrg } from './storage-state.js'
import { logger } from './logger.js'

export interface JobInput {
  orgId: string
  generationId: string  // LMS taraf ID'si — log için
  artifactType: string  // CLI form: 'audio' | 'video' | 'slide-deck' | ...
  prompt?: string
  language: string
  sourceFileUrls: Array<{ url: string; filename: string }>
  sourceUrls: string[]
  options: Record<string, string>
  uploadUrl: string  // S3 presigned PUT
  outputExt: string  // 'mp3' | 'png' | 'pdf' | ...
  outputMime: string
}

export interface JobState {
  jobId: string
  generationId: string
  orgId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
  uploadedSize?: number
  startedAt: string
  completedAt?: string
}

const jobs = new Map<string, JobState>()

export function getJob(jobId: string): JobState | null {
  return jobs.get(jobId) ?? null
}

export function listJobs(): JobState[] {
  return Array.from(jobs.values())
}

export function startJob(input: JobInput): JobState {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const state: JobState = {
    jobId,
    generationId: input.generationId,
    orgId: input.orgId,
    status: 'pending',
    startedAt: new Date().toISOString(),
  }
  jobs.set(jobId, state)
  // Fire and forget — runJob hatalarda state'i 'failed' olarak yazar.
  runJob(jobId, input).catch((err) => {
    logger.error({ jobId, err: String(err) }, 'runJob unexpected error')
    const s = jobs.get(jobId)
    if (s && s.status !== 'completed') {
      s.status = 'failed'
      s.error = String(err).slice(0, 500)
      s.completedAt = new Date().toISOString()
    }
  })
  return state
}

function update(jobId: string, patch: Partial<JobState>): void {
  const s = jobs.get(jobId)
  if (!s) return
  Object.assign(s, patch)
}

function fail(jobId: string, msg: string, run?: RunResult): void {
  const detail = run ? `${msg}: ${run.stderr.slice(0, 200) || run.stdout.slice(0, 200)}` : msg
  logger.error({ jobId, detail }, 'job failed')
  update(jobId, {
    status: 'failed',
    error: detail.slice(0, 500),
    completedAt: new Date().toISOString(),
  })
}

async function runJob(jobId: string, input: JobInput): Promise<void> {
  const orgHome = await resolveHomeForOrg(input.orgId)
  if (!orgHome) {
    fail(jobId, 'NotebookLM oturumu kurulu değil — yöneticiye bildirin')
    return
  }

  update(jobId, { status: 'processing', progress: 5 })

  // 1) Create notebook
  const created = await runNotebooklm({
    args: ['create', `LMS: ${input.generationId}`, '--json'],
    orgHome,
    timeoutMs: 60_000,
  })
  if (!created.ok) {
    fail(jobId, 'notebook olusturulamadi', created)
    return
  }
  const createdJson = parseCliJson<{ notebook?: { id: string }; id?: string }>(created.stdout)
  const notebookId = createdJson?.notebook?.id ?? createdJson?.id
  if (!notebookId) {
    fail(jobId, 'notebook ID alinamadi', created)
    return
  }
  update(jobId, { progress: 15 })

  // 2) Sources ekle — bizim worker yerelde dosya indirmek zorunda
  // çünkü `notebooklm source add` lokal dosya yolu bekler.
  const tmpDir = path.join(os.tmpdir(), `nb-${jobId}`)
  await fs.mkdir(tmpDir, { recursive: true })

  const sourceIds: string[] = []
  for (const sf of input.sourceFileUrls) {
    const localPath = path.join(tmpDir, sanitizeFilename(sf.filename))
    const ok = await downloadToFile(sf.url, localPath)
    if (!ok) {
      fail(jobId, `kaynak indirilemedi: ${sf.filename}`)
      return
    }
    const added = await runNotebooklm({
      args: ['source', 'add', localPath, '--notebook', notebookId, '--json'],
      orgHome,
      timeoutMs: 180_000,
    })
    if (!added.ok) {
      fail(jobId, `kaynak eklenemedi: ${sf.filename}`, added)
      return
    }
    const addedJson = parseCliJson<{ source?: { id: string } }>(added.stdout)
    if (addedJson?.source?.id) sourceIds.push(addedJson.source.id)
  }

  for (const url of input.sourceUrls) {
    const added = await runNotebooklm({
      args: ['source', 'add', url, '--notebook', notebookId, '--json'],
      orgHome,
      timeoutMs: 180_000,
    })
    if (!added.ok) {
      fail(jobId, `URL kaynak eklenemedi: ${url}`, added)
      return
    }
    const addedJson = parseCliJson<{ source?: { id: string } }>(added.stdout)
    if (addedJson?.source?.id) sourceIds.push(addedJson.source.id)
  }

  update(jobId, { progress: 30 })

  // 3) Source ready bekle
  for (const sid of sourceIds) {
    const waited = await runNotebooklm({
      args: ['source', 'wait', sid, '-n', notebookId, '--timeout', '300'],
      orgHome,
      timeoutMs: 320_000,
    })
    if (!waited.ok) {
      fail(jobId, `kaynak hazir olmadi: ${sid}`, waited)
      return
    }
  }
  update(jobId, { progress: 45 })

  // 4) Generate
  const genArgs: string[] = ['generate', input.artifactType]
  if (input.prompt && input.prompt.trim()) genArgs.push(input.prompt.trim())
  genArgs.push('--notebook', notebookId, '--language', input.language, '--json')
  for (const [k, v] of Object.entries(input.options)) {
    genArgs.push(`--${k}`, v)
  }

  const started = await runNotebooklm({
    args: genArgs,
    orgHome,
    timeoutMs: 120_000,
  })
  if (!started.ok) {
    fail(jobId, 'generate baslatilamadi', started)
    return
  }
  const startedJson = parseCliJson<{ task_id?: string; artifact_id?: string; id?: string }>(started.stdout)
  const artifactId = startedJson?.task_id ?? startedJson?.artifact_id ?? startedJson?.id
  if (!artifactId) {
    fail(jobId, 'artifact ID alinamadi', started)
    return
  }
  update(jobId, { progress: 55 })

  // 5) Wait artifact (en uzun süren adım — 5-45 dk)
  const waited = await runNotebooklm({
    args: ['artifact', 'wait', artifactId, '-n', notebookId, '--timeout', '2700'],
    orgHome,
    timeoutMs: 2_800_000,
  })
  if (!waited.ok) {
    fail(jobId, 'artifact tamamlanmadi', waited)
    return
  }
  update(jobId, { progress: 80 })

  // 6) Download
  const outputPath = path.join(tmpDir, `output.${input.outputExt}`)
  const downloaded = await runNotebooklm({
    args: ['download', input.artifactType, outputPath, '-a', artifactId, '-n', notebookId],
    orgHome,
    timeoutMs: 300_000,
  })
  if (!downloaded.ok) {
    fail(jobId, 'artifact indirilemedi', downloaded)
    return
  }
  update(jobId, { progress: 90 })

  // 7) Upload to S3 (presigned PUT)
  const stat = await fs.stat(outputPath)
  const buf = await fs.readFile(outputPath)
  const putRes = await fetch(input.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': input.outputMime, 'Content-Length': String(stat.size) },
    body: buf,
  })
  if (!putRes.ok) {
    fail(jobId, `S3 upload basarisiz: ${putRes.status}`)
    return
  }

  // 8) Cleanup local + done
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)

  update(jobId, {
    status: 'completed',
    progress: 100,
    uploadedSize: stat.size,
    completedAt: new Date().toISOString(),
  })
  logger.info({ jobId, generationId: input.generationId, size: stat.size }, 'job completed')
}

function sanitizeFilename(name: string): string {
  // path traversal önleme + 100 karakter limit
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'source.bin'
}

async function downloadToFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url)
    if (!res.ok || !res.body) return false
    const buf = Buffer.from(await res.arrayBuffer())
    await fs.writeFile(dest, buf)
    return true
  } catch (err) {
    logger.error({ url, err: String(err) }, 'download failed')
    return false
  }
}
