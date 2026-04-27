/**
 * notebooklm-py CLI wrapper. Spawn child_process, parse JSON output.
 *
 * Tüm CLI çağrıları --json flag'i ile yapılır. Spawn ortamına
 * NOTEBOOKLM_HOME env'i set edilir → per-org context dosyaları
 * /data/orgs/{orgId}/.notebooklm altında izole kalır.
 */
import { spawn } from 'child_process'
import { config } from './config.js'

interface RunOptions {
  args: string[]
  orgHome: string
  timeoutMs?: number
  cwd?: string
}

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export function runNotebooklm(opts: RunOptions): Promise<RunResult> {
  const timeout = opts.timeoutMs ?? 120_000

  if (config.mockMode) {
    // Test mode — sahte çıkış
    return Promise.resolve({
      ok: true,
      stdout: JSON.stringify({ id: 'mock-id', task_id: 'mock-task' }),
      stderr: '',
      exitCode: 0,
    })
  }

  return new Promise((resolve) => {
    const child = spawn(config.notebooklmBin, opts.args, {
      cwd: opts.cwd,
      env: {
        ...process.env,
        NOTEBOOKLM_HOME: opts.orgHome,
        // CI/CD pattern: storage_state'i inline geçmek de mümkün ama dosya yolu daha basit.
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
    }, timeout)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        ok: code === 0,
        stdout,
        stderr: killed ? `${stderr}\n[killed: timeout ${timeout}ms]` : stderr,
        exitCode: code,
      })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        ok: false,
        stdout,
        stderr: `${stderr}\n${err.message}`,
        exitCode: null,
      })
    })
  })
}

/** Parse JSON from CLI stdout — son satırı dene; başarısızsa tüm output. */
export function parseCliJson<T = unknown>(stdout: string): T | null {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  // CLI bazen birden çok satır basıyor; son JSON-looking satırı al
  const lines = trimmed.split('\n').reverse()
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        return JSON.parse(t) as T
      } catch {
        continue
      }
    }
  }
  // Tüm output JSON ise
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}
