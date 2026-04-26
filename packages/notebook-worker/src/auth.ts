/**
 * HMAC-SHA256 authentication middleware.
 * Hospital LMS API → worker arasında shared secret ile imza doğrulama.
 *
 * Header'lar:
 *  - X-Worker-Timestamp: unix ms (5 dk skew tolerance)
 *  - X-Worker-Signature: hex(hmac256(timestamp + "\n" + method + "\n" + path + "\n" + body))
 *
 * Constant-time karşılaştırma — timing attack önleme.
 */
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { config } from './config.js'

function sign(timestamp: string, method: string, path: string, body: string): string {
  const payload = `${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`
  return crypto.createHmac('sha256', config.hmacSecret).update(payload).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function hmacAuth(req: Request, res: Response, next: NextFunction): void {
  // /healthz public — Fly.io healthcheck için
  if (req.path === '/healthz') {
    next()
    return
  }

  const ts = req.header('X-Worker-Timestamp')
  const sig = req.header('X-Worker-Signature')
  if (!ts || !sig) {
    res.status(401).json({ error: 'imza eksik' })
    return
  }

  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) {
    res.status(401).json({ error: 'gecersiz timestamp' })
    return
  }
  const skewMs = Math.abs(Date.now() - tsNum)
  if (skewMs > config.requestSkewSeconds * 1000) {
    res.status(401).json({ error: 'timestamp skew cok buyuk' })
    return
  }

  // Body imzaya dahil — Express raw body'yi req.rawBody'de tutmuyor varsayılan,
  // server.ts'de express.json() öncesi raw capture yapıyoruz.
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? ''
  const expected = sign(ts, req.method, req.path, rawBody)

  if (!safeEqual(expected, sig)) {
    res.status(401).json({ error: 'imza dogrulanamadi' })
    return
  }

  next()
}
