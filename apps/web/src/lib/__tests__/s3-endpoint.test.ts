/**
 * S3_ENDPOINT (MinIO) override davranışı — on-prem'de her iki client da custom
 * endpoint'i kullanmalı; Transfer Acceleration AWS'e özgü olduğundan accelerate
 * client'ı custom endpoint'te standart client'a EŞİTLENİR (aynı referans).
 * Endpoint yokken iki ayrı client (mevcut bulut davranışı) korunur.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('AWS_REGION', 'eu-central-1')
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-key')
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret')
  vi.stubEnv('AWS_S3_BUCKET', 'test-bucket')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('s3 endpoint override (on-prem MinIO)', () => {
  it('S3_ENDPOINT verilince accelerate client standart client ile AYNI olur', async () => {
    vi.stubEnv('S3_ENDPOINT', 'http://minio:9000')
    vi.stubEnv('S3_FORCE_PATH_STYLE', 'true')
    const mod = await import('@/lib/s3')
    expect(mod.s3Accelerate).toBe(mod.s3)
    const endpoint = await mod.s3.config.endpoint?.()
    expect(endpoint?.hostname).toBe('minio')
    expect(endpoint?.port).toBe(9000)
    expect(mod.s3.config.forcePathStyle).toBe(true)
  })

  it('S3_ENDPOINT yokken iki ayrı client (bulut davranışı) korunur', async () => {
    vi.stubEnv('S3_ENDPOINT', '')
    const mod = await import('@/lib/s3')
    expect(mod.s3Accelerate).not.toBe(mod.s3)
    // SDK sürümüne göre resolved config'de boolean ya da provider fn olabilir
    const resolveFlag = async (v: unknown): Promise<boolean> =>
      typeof v === 'function' ? await (v as () => Promise<boolean>)() : Boolean(v)
    expect(await resolveFlag(mod.s3Accelerate.config.useAccelerateEndpoint)).toBe(true)
    expect(await resolveFlag(mod.s3.config.useAccelerateEndpoint)).toBe(false)
  })
})
