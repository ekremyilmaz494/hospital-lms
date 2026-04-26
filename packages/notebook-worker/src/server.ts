/**
 * NotebookLM Worker — Express server.
 *
 * Endpoints (HMAC-protected, /healthz hariç):
 *  GET    /healthz                          → liveness
 *  POST   /api/login/storage-state          → per-org storage_state.json yaz + verify
 *  GET    /api/login/status?orgId=X         → bağlantı durumu (notebooklm status)
 *  DELETE /api/login/storage-state?orgId=X  → bağlantı kaldır
 *  POST   /api/generate                     → generation başlat (jobId döner)
 *  GET    /api/jobs/:jobId                  → job status
 */
import express, { type Request, type Response } from 'express'
import { config } from './config.js'
import { hmacAuth } from './auth.js'
import { logger } from './logger.js'
import {
  writeStorageState,
  deleteStorageState,
  getOrgHome,
  sharedHome,
} from './storage-state.js'
import fs from 'fs/promises'
import { runNotebooklm, parseCliJson } from './notebooklm.js'
import { startJob, getJob, type JobInput } from './jobs.js'

const app = express()

// Raw body capture (HMAC body imzalı) — express.json'dan ÖNCE
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    ;(req as Request & { rawBody?: string }).rawBody = buf.toString('utf8')
  },
}))

app.use(hmacAuth)

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, version: '0.1.0' })
})

// Shared (Klinova ortak hesap) status — LMS bunu poll eder
app.get('/api/shared/status', async (_req, res) => {
  const home = sharedHome()
  try {
    await fs.access(`${home}/storage_state.json`)
  } catch {
    res.json({ connected: false, reason: 'storage_state.json yok' })
    return
  }
  const result = await runNotebooklm({ args: ['list', '--json'], orgHome: home, timeoutMs: 30_000 })
  if (!result.ok) {
    res.json({ connected: false, reason: result.stderr.slice(0, 200) })
    return
  }
  const status = await runNotebooklm({ args: ['status'], orgHome: home, timeoutMs: 15_000 })
  const emailMatch = status.stdout.match(/Authenticated as:\s*([^\s\n]+)/)
  res.json({ connected: true, googleEmail: emailMatch?.[1] })
})

// ── /api/login/storage-state ──
app.post('/api/login/storage-state', async (req: Request, res: Response) => {
  const { orgId, storageStateJson } = req.body ?? {}
  if (typeof orgId !== 'string' || typeof storageStateJson !== 'string') {
    res.status(400).json({ error: 'orgId ve storageStateJson zorunlu' })
    return
  }
  // JSON validate
  try {
    const parsed = JSON.parse(storageStateJson)
    if (!Array.isArray(parsed?.cookies)) {
      res.status(400).json({ error: 'gecersiz storage_state — cookies array bekleniyor' })
      return
    }
  } catch {
    res.status(400).json({ error: 'storage_state JSON parse edilemedi' })
    return
  }

  try {
    const orgHome = await writeStorageState(orgId, storageStateJson)
    // Verify — `notebooklm status` veya `list` çalışsın
    const verify = await runNotebooklm({
      args: ['list', '--json'],
      orgHome,
      timeoutMs: 30_000,
    })
    if (!verify.ok) {
      logger.warn({ orgId, stderr: verify.stderr }, 'storage_state verify failed')
      // Yine de yazdık — kullanıcı yanlış yapıştırdıysa list fail eder ama dosya tutulur,
      // verify status endpoint'i çağrıldığında hata raporlar.
    }
    res.json({ ok: true, verified: verify.ok })
  } catch (err) {
    logger.error({ orgId, err: String(err) }, 'storage_state write failed')
    res.status(500).json({ error: 'storage_state yazilamadi' })
  }
})

app.get('/api/login/status', async (req: Request, res: Response) => {
  const orgId = req.query.orgId
  if (typeof orgId !== 'string') {
    res.status(400).json({ error: 'orgId zorunlu' })
    return
  }
  const orgHome = await getOrgHome(orgId)
  if (!orgHome) {
    res.json({ connected: false, verifiedAt: new Date().toISOString() })
    return
  }
  const result = await runNotebooklm({
    args: ['list', '--json'],
    orgHome,
    timeoutMs: 30_000,
  })
  if (!result.ok) {
    res.json({
      connected: false,
      error: result.stderr.slice(0, 200),
      verifiedAt: new Date().toISOString(),
    })
    return
  }
  // Email'i çekmek için `notebooklm status` da deneyelim
  const status = await runNotebooklm({
    args: ['status'],
    orgHome,
    timeoutMs: 15_000,
  })
  const emailMatch = status.stdout.match(/Authenticated as:\s*([^\s\n]+)/)
  res.json({
    connected: true,
    googleEmail: emailMatch?.[1],
    verifiedAt: new Date().toISOString(),
  })
})

app.delete('/api/login/storage-state', async (req: Request, res: Response) => {
  const orgId = req.query.orgId
  if (typeof orgId !== 'string') {
    res.status(400).json({ error: 'orgId zorunlu' })
    return
  }
  try {
    await deleteStorageState(orgId)
    res.json({ ok: true })
  } catch (err) {
    logger.error({ orgId, err: String(err) }, 'storage_state delete failed')
    res.status(500).json({ error: 'silinemedi' })
  }
})

// ── /api/generate ──
app.post('/api/generate', (req: Request, res: Response) => {
  const body = req.body as Partial<JobInput>
  if (!body || typeof body.orgId !== 'string' || typeof body.generationId !== 'string'
      || typeof body.artifactType !== 'string' || typeof body.uploadUrl !== 'string'
      || typeof body.outputExt !== 'string' || typeof body.outputMime !== 'string') {
    res.status(400).json({ error: 'eksik alan' })
    return
  }
  const input: JobInput = {
    orgId: body.orgId,
    generationId: body.generationId,
    artifactType: body.artifactType,
    prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
    language: typeof body.language === 'string' ? body.language : 'tr',
    sourceFileUrls: Array.isArray(body.sourceFileUrls) ? body.sourceFileUrls : [],
    sourceUrls: Array.isArray(body.sourceUrls) ? body.sourceUrls : [],
    options: body.options && typeof body.options === 'object' ? body.options : {},
    uploadUrl: body.uploadUrl,
    outputExt: body.outputExt,
    outputMime: body.outputMime,
  }
  const job = startJob(input)
  res.status(202).json({ workerJobId: job.jobId, status: job.status })
})

// ── /api/jobs/:jobId ──
app.get('/api/jobs/:jobId', (req: Request, res: Response) => {
  const jobId = req.params.jobId ?? ''
  const job = getJob(jobId)
  if (!job) {
    res.status(404).json({ error: 'job bulunamadi' })
    return
  }
  res.json(job)
})

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'not found' })
})

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, 'unhandled error')
  res.status(500).json({ error: 'internal error' })
})

app.listen(config.port, () => {
  logger.info(`NotebookLM worker listening on :${config.port} (mock=${config.mockMode})`)
})
