import { logger } from '@/lib/logger'

/**
 * On-prem tarafın Klinovax lisans SUNUCUSUNA (bulut) giden istemcisi.
 * LICENSE_SERVER_URL env'i hedef (örn. https://app.klinovax.com). İnternet
 * yoksa/hata olursa best-effort — çağıran sessizce offline grace'e güvenir.
 */

const APP_VERSION = process.env.npm_package_version ?? '0.1.0'

function serverUrl(): string | null {
  const url = process.env.LICENSE_SERVER_URL?.replace(/\/$/, '')
  return url && url.length > 0 ? url : null
}

async function postJson(path: string, body: unknown): Promise<{ receipt: string } | null> {
  const base = serverUrl()
  if (!base) {
    logger.warn('license-client', 'LICENSE_SERVER_URL tanımlı değil — phone-home atlandı')
    return null
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      logger.warn('license-client', `Lisans sunucusu ${path} → HTTP ${res.status}`)
      return null
    }
    const data = (await res.json()) as { receipt?: string }
    return data.receipt ? { receipt: data.receipt } : null
  } catch (err) {
    logger.warn('license-client', `Lisans sunucusuna ulaşılamadı (${path}) — offline grace geçerli`, err)
    return null
  }
}

/** Aktivasyon çağrısı — makbuz döner veya null (offline). */
export async function callActivate(
  licenseJwt: string,
  instanceId: string,
  hostname?: string,
): Promise<string | null> {
  const r = await postJson('/api/public/license/activate', {
    licenseJwt,
    instanceId,
    appVersion: APP_VERSION,
    hostname,
  })
  return r?.receipt ?? null
}

/** Heartbeat çağrısı — kullanım snapshot'ıyla; makbuz döner veya null (offline). */
export async function callHeartbeat(
  licenseJwt: string,
  instanceId: string,
  usage: { orgCount: number; staffCount: number },
): Promise<string | null> {
  const r = await postJson('/api/public/license/heartbeat', {
    licenseJwt,
    instanceId,
    usage: { ...usage, appVersion: APP_VERSION },
  })
  return r?.receipt ?? null
}
