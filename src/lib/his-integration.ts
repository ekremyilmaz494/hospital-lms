/**
 * HIS (Hastane Bilgi Sistemi) Entegrasyon Servisi
 *
 * Desteklenen auth tipleri: API_KEY, BASIC_AUTH, OAUTH2
 * Senkronizasyon: Staff Import, Department Import, Full Sync
 */
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import type { SyncResult } from '@/types/database'
import type { HisIntegration } from '@/generated/prisma/client'

export type { HisIntegration }

// ── Tipler ──

export interface HisStaffRecord {
  externalId: string
  tcNo?: string
  name: string
  surname: string
  email?: string
  phone?: string
  department: string
  title: string
  startDate: string
  isActive: boolean
}

export interface HisDepartmentRecord {
  externalId: string
  name: string
  description?: string
}

interface HisCredentials {
  // API_KEY
  apiKey?: string
  headerName?: string
  // BASIC_AUTH
  username?: string
  password?: string
  // OAUTH2
  tokenUrl?: string
  clientId?: string
  clientSecret?: string
}

// OAuth2 token cache — yeniden token isteği yapmaktan kaçınmak için
const oauth2TokenCache = new Map<string, { token: string; expiresAt: number }>()

// ── Yardımcı Fonksiyonlar ──

function decryptCredentials(integration: HisIntegration): HisCredentials {
  const raw = integration.credentials as { v: string }
  return JSON.parse(decrypt(raw.v)) as HisCredentials
}

async function buildAuthHeaders(integration: HisIntegration): Promise<Record<string, string>> {
  const creds = decryptCredentials(integration)

  if (integration.authType === 'API_KEY') {
    const headerName = creds.headerName ?? 'X-API-Key'
    return { [headerName]: creds.apiKey ?? '' }
  }

  if (integration.authType === 'BASIC_AUTH') {
    const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
    return { Authorization: `Basic ${encoded}` }
  }

  // OAUTH2 — module-scope cache ile token yönetimi
  if (integration.authType === 'OAUTH2') {
    const cached = oauth2TokenCache.get(integration.id)
    if (cached && cached.expiresAt > Date.now()) {
      return { Authorization: `Bearer ${cached.token}` }
    }

    const tokenRes = await fetch(creds.tokenUrl ?? '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId ?? '',
        client_secret: creds.clientSecret ?? '',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`OAuth2 token alınamadı: ${tokenRes.status} ${tokenRes.statusText}`)
    }

    const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number }
    const expiresAt = Date.now() + ((tokenData.expires_in ?? 3600) - 60) * 1000
    oauth2TokenCache.set(integration.id, { token: tokenData.access_token, expiresAt })
    return { Authorization: `Bearer ${tokenData.access_token}` }
  }

  return {}
}

/**
 * HIS'den gelen ham kayıt nesnesini, fieldMapping kullanarak HisStaffRecord'a dönüştür.
 * fieldMapping = { hisAlanAdı: lmsAlanAdı }
 */
export function applyFieldMapping(
  record: Record<string, unknown>,
  fieldMapping: Record<string, string>,
): HisStaffRecord {
  const mapped: Record<string, unknown> = {}

  // fieldMapping varsa uygula
  if (Object.keys(fieldMapping).length > 0) {
    for (const [hisKey, lmsKey] of Object.entries(fieldMapping)) {
      if (record[hisKey] !== undefined) {
        mapped[lmsKey] = record[hisKey]
      }
    }
  } else {
    // Mapping yoksa doğrudan kullan
    Object.assign(mapped, record)
  }

  const externalId = String(mapped.externalId ?? mapped.id ?? '')
  const name = String(mapped.name ?? mapped.firstName ?? mapped.ad ?? '')
  const surname = String(mapped.surname ?? mapped.lastName ?? mapped.soyad ?? '')

  if (!externalId) throw new Error('externalId alanı zorunlu')
  if (!name) throw new Error('name alanı zorunlu')
  if (!surname) throw new Error('surname alanı zorunlu')

  return {
    externalId,
    name,
    surname,
    email: mapped.email ? String(mapped.email) : undefined,
    phone: mapped.phone ? String(mapped.phone) : undefined,
    tcNo: mapped.tcNo ? String(mapped.tcNo) : undefined,
    department: String(mapped.department ?? mapped.birim ?? ''),
    title: String(mapped.title ?? mapped.unvan ?? ''),
    startDate: String(mapped.startDate ?? mapped.baslangicTarihi ?? ''),
    isActive: Boolean(mapped.isActive ?? mapped.aktif ?? true),
  }
}

// ── Bağlantı Testi ──

export async function testHisConnection(integration: HisIntegration): Promise<{
  success: boolean
  message: string
  sampleData?: unknown
}> {
  try {
    const headers = await buildAuthHeaders(integration)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const url = new URL(integration.baseUrl)
    url.searchParams.set('limit', '1')
    url.searchParams.set('page', '1')

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      return { success: false, message: `HIS bağlantısı başarısız: HTTP ${res.status} ${res.statusText}` }
    }

    const data = await res.json() as unknown
    return { success: true, message: 'Bağlantı başarılı', sampleData: data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Bağlantı hatası: ${msg}` }
  }
}

// ── Personel Senkronizasyonu ──

export async function syncStaffFromHis(integration: HisIntegration): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    totalRecords: 0,
    processedRecords: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
    errors: [],
  }

  // SyncLog kaydı başlat
  const syncLog = await prisma.syncLog.create({
    data: {
      organizationId: integration.organizationId,
      integrationId: integration.id,
      syncType: 'STAFF_IMPORT',
      status: 'RUNNING',
    },
  })

  try {
    // Auth header'larını hazırla
    const headers = await buildAuthHeaders(integration)

    // HIS'ten personel listesi çek
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    const res = await fetch(integration.baseUrl, {
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      throw new Error(`HIS HTTP hatası: ${res.status} ${res.statusText}`)
    }

    const rawData = await res.json() as unknown
    const rawList: Record<string, unknown>[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as Record<string, unknown>).data)
        ? (rawData as Record<string, unknown>).data as Record<string, unknown>[]
        : []

    result.totalRecords = rawList.length

    const fieldMapping = integration.fieldMapping as Record<string, string>

    // Departmanları pre-load et (N+1 önleme)
    const departments = await prisma.department.findMany({
      where: { organizationId: integration.organizationId, isActive: true },
      select: { id: true, name: true },
    })
    const deptMap = new Map(departments.map(d => [d.name.toLowerCase(), d.id]))

    const supabase = await createServiceClient()

    // Her personel kaydını işle
    for (const raw of rawList.slice(0, 500)) { // max 500 kayıt / sync
      let staffRecord: HisStaffRecord
      try {
        staffRecord = applyFieldMapping(raw, fieldMapping)
      } catch (err) {
        result.errors.push({
          externalId: String(raw.id ?? raw.personelId ?? 'unknown'),
          error: `Alan dönüşümü başarısız: ${err instanceof Error ? err.message : String(err)}`,
        })
        continue
      }

      try {
        const existing = await prisma.user.findFirst({
          where: {
            hisExternalId: staffRecord.externalId,
            organizationId: integration.organizationId,
          },
        })

        if (existing) {
          // Mevcut kullanıcı — güncelle
          const departmentId = deptMap.get(staffRecord.department.toLowerCase())
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              firstName: staffRecord.name,
              lastName: staffRecord.surname,
              phone: staffRecord.phone ?? existing.phone,
              title: staffRecord.title || existing.title,
              departmentId: departmentId ?? existing.departmentId,
              isActive: staffRecord.isActive,
            },
          })

          if (!staffRecord.isActive) {
            result.deactivated++
          } else {
            result.updated++
          }
        } else {
          // Yeni kullanıcı — Supabase auth + DB oluştur
          const tempEmail = staffRecord.email ?? `his-${staffRecord.externalId}@${integration.organizationId}.his`
          const tempPassword = crypto.randomBytes(16).toString('hex')

          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: tempEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              first_name: staffRecord.name,
              last_name: staffRecord.surname,
              role: 'staff',
              organization_id: integration.organizationId,
            },
          })

          if (authError) {
            // Email çakışması — mevcut auth user'ı bul
            if (authError.message?.includes('already registered')) {
              const existingByEmail = await prisma.user.findFirst({
                where: { email: tempEmail, organizationId: integration.organizationId },
              })
              if (existingByEmail) {
                await prisma.user.update({
                  where: { id: existingByEmail.id },
                  data: { hisExternalId: staffRecord.externalId },
                })
                result.updated++
              } else {
                result.errors.push({
                  externalId: staffRecord.externalId,
                  error: 'E-posta adresi başka bir organizasyona ait, atlandı',
                })
              }
              continue
            }
            throw new Error(`Supabase auth hatası: ${authError.message}`)
          }

          const departmentId = deptMap.get(staffRecord.department.toLowerCase())

          try {
            await prisma.user.create({
              data: {
                id: authUser.user.id,
                email: tempEmail,
                firstName: staffRecord.name,
                lastName: staffRecord.surname,
                role: 'staff',
                organizationId: integration.organizationId,
                hisExternalId: staffRecord.externalId,
                tcNo: staffRecord.tcNo,
                phone: staffRecord.phone,
                departmentId: departmentId ?? null,
                title: staffRecord.title || null,
                isActive: staffRecord.isActive,
              },
            })
            result.created++
          } catch (dbErr) {
            // Rollback: DB insert başarısız olursa auth user'ı sil
            try {
              await supabase.auth.admin.deleteUser(authUser.user.id)
            } catch (rollbackErr) {
              logger.error('HIS Sync', 'Auth user rollback başarısız', {
                userId: authUser.user.id,
                rollbackErr,
              })
            }
            throw dbErr
          }
        }

        result.processedRecords++
      } catch (err) {
        result.errors.push({
          externalId: staffRecord.externalId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    result.success = result.processedRecords > 0 || result.totalRecords === 0

    // SyncLog güncelle
    const status = result.errors.length > 0 && result.processedRecords === 0
      ? 'FAILED'
      : 'SUCCESS'

    await Promise.all([
      prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status,
          totalRecords: result.totalRecords,
          processedRecords: result.processedRecords,
          errors: result.errors as object[],
          completedAt: new Date(),
        },
      }),
      prisma.hisIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() },
      }),
    ])

  } catch (err) {
    logger.error('HIS Sync', 'Personel sync başarısız', {
      integrationId: integration.id,
      err: err instanceof Error ? err.message : err,
    })

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        totalRecords: result.totalRecords,
        processedRecords: result.processedRecords,
        errors: [
          ...result.errors,
          { externalId: 'GLOBAL', error: err instanceof Error ? err.message : String(err) },
        ] as object[],
        completedAt: new Date(),
      },
    })
  }

  return result
}

// ── Departman Senkronizasyonu ──

export async function syncDepartmentsFromHis(integration: HisIntegration): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    totalRecords: 0,
    processedRecords: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
    errors: [],
  }

  const syncLog = await prisma.syncLog.create({
    data: {
      organizationId: integration.organizationId,
      integrationId: integration.id,
      syncType: 'DEPARTMENT_IMPORT',
      status: 'RUNNING',
    },
  })

  try {
    const headers = await buildAuthHeaders(integration)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    // Departman endpoint'i için /departments suffix ekle
    const url = integration.baseUrl.endsWith('/departments')
      ? integration.baseUrl
      : integration.baseUrl.replace(/\/staff$/, '/departments')

    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      throw new Error(`HIS HTTP hatası: ${res.status} ${res.statusText}`)
    }

    const rawData = await res.json() as unknown
    const rawList: Record<string, unknown>[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as Record<string, unknown>).data)
        ? (rawData as Record<string, unknown>).data as Record<string, unknown>[]
        : []

    result.totalRecords = rawList.length

    for (const raw of rawList) {
      try {
        const name = String(raw.name ?? raw.birimAdi ?? raw.ad ?? '')
        const description = raw.description ? String(raw.description) : undefined

        if (!name) {
          result.errors.push({ externalId: String(raw.id ?? 'unknown'), error: 'Departman adı zorunlu' })
          continue
        }

        await prisma.department.upsert({
          where: {
            organizationId_name: { organizationId: integration.organizationId, name },
          },
          create: {
            organizationId: integration.organizationId,
            name,
            description: description ?? null,
          },
          update: {
            description: description ?? undefined,
          },
        })

        result.processedRecords++
        result.created++ // upsert için kesin ayrımı DB'den okumak gerekir, created sayılır
      } catch (err) {
        result.errors.push({
          externalId: String(raw.id ?? 'unknown'),
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    result.success = true

    await Promise.all([
      prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          totalRecords: result.totalRecords,
          processedRecords: result.processedRecords,
          errors: result.errors as object[],
          completedAt: new Date(),
        },
      }),
      prisma.hisIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() },
      }),
    ])
  } catch (err) {
    logger.error('HIS Sync', 'Departman sync başarısız', {
      integrationId: integration.id,
      err: err instanceof Error ? err.message : err,
    })

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        errors: [{ externalId: 'GLOBAL', error: err instanceof Error ? err.message : String(err) }] as object[],
        completedAt: new Date(),
      },
    })
  }

  return result
}
