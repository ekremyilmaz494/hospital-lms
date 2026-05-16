import { promises as fs } from 'node:fs'
import path from 'node:path'
import { logger } from '@/lib/logger'

const FALLBACK_LOGO_PATH = path.join(process.cwd(), 'public', 'logos', 'devakent.png')

let cachedFallback: string | null = null

async function readFallbackLogo(): Promise<string | null> {
  if (cachedFallback !== null) return cachedFallback
  try {
    const buffer = await fs.readFile(FALLBACK_LOGO_PATH)
    cachedFallback = `data:image/png;base64,${buffer.toString('base64')}`
    return cachedFallback
  } catch (err) {
    logger.warn('Certificate PDF', 'Fallback logo okunamadi', err)
    return null
  }
}

export async function resolveOrgLogoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  if (logoUrl) {
    try {
      if (logoUrl.startsWith('/')) {
        const localPath = path.join(process.cwd(), 'public', logoUrl.replace(/^\//, ''))
        const buffer = await fs.readFile(localPath)
        const ext = path.extname(localPath).slice(1).toLowerCase() || 'png'
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png'
        return `data:${mime};base64,${buffer.toString('base64')}`
      }
      const res = await fetch(logoUrl)
      if (res.ok) {
        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const contentType = res.headers.get('content-type') ?? 'image/png'
        return `data:${contentType};base64,${base64}`
      }
    } catch (err) {
      logger.warn('Certificate PDF', 'Logo yuklenemedi, fallback kullanilacak', err)
    }
  }
  return readFallbackLogo()
}
