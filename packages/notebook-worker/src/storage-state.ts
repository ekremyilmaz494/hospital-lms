/**
 * Per-org storage_state.json yönetimi.
 *
 * Hospital LMS bize zaten plain-text storage_state JSON gönderir
 * (kendi DB'sinde encrypted tutar, request body'de plaintext).
 * Worker dosyayı kendi volume'una yazıp `notebooklm` CLI için
 * NOTEBOOKLM_AUTH_JSON env veya NOTEBOOKLM_HOME klasörü olarak set eder.
 *
 * Klasör yapısı:
 *   /data/orgs/{orgId}/.notebooklm/storage_state.json
 *   /data/orgs/{orgId}/.notebooklm/context.json (CLI yazar)
 */
import fs from 'fs/promises'
import path from 'path'
import { config } from './config.js'

function orgHome(orgId: string): string {
  // org ID validate — path traversal önleme
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(orgId)) {
    throw new Error(`gecersiz orgId: ${orgId}`)
  }
  return path.join(config.dataDir, 'orgs', orgId, '.notebooklm')
}

/** Shared (Klinova) NotebookLM home — tüm orgs için ortak. */
export function sharedHome(): string {
  return path.join(config.dataDir, 'shared', '.notebooklm')
}

/**
 * Generation için kullanılacak NotebookLM home.
 * Per-org storage_state varsa onu, yoksa shared'i döndürür.
 * MVP'de hep shared dönecek (per-org connect kapalı).
 */
export async function resolveHomeForOrg(orgId: string): Promise<string | null> {
  const perOrg = await getOrgHome(orgId)
  if (perOrg) return perOrg
  const shared = sharedHome()
  try {
    await fs.access(path.join(shared, 'storage_state.json'))
    return shared
  } catch {
    return null
  }
}

export async function writeStorageState(orgId: string, jsonContent: string): Promise<string> {
  const home = orgHome(orgId)
  await fs.mkdir(home, { recursive: true, mode: 0o700 })
  const file = path.join(home, 'storage_state.json')
  await fs.writeFile(file, jsonContent, { mode: 0o600 })
  return home
}

export async function getStorageStatePath(orgId: string): Promise<string | null> {
  const file = path.join(orgHome(orgId), 'storage_state.json')
  try {
    await fs.access(file)
    return file
  } catch {
    return null
  }
}

export async function getOrgHome(orgId: string): Promise<string | null> {
  const home = orgHome(orgId)
  try {
    await fs.access(home)
    return home
  } catch {
    return null
  }
}

export async function deleteStorageState(orgId: string): Promise<void> {
  const home = orgHome(orgId)
  await fs.rm(home, { recursive: true, force: true })
}
