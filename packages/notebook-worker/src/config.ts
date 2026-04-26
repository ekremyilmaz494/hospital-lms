/**
 * Worker config — env'den okur, eksiklerde başlangıçta hata fırlatır.
 */
export const config = (() => {
  const required = (key: string, fallback?: string): string => {
    const v = process.env[key] ?? fallback
    if (!v) throw new Error(`[worker config] env ${key} eksik`)
    return v
  }

  return {
    port: Number(process.env.PORT ?? 8080),
    hmacSecret: required('WORKER_HMAC_SECRET'),
    dataDir: process.env.DATA_DIR ?? '/data',
    notebooklmHome: process.env.NOTEBOOKLM_HOME ?? '/data/.notebooklm-home',
    notebooklmBin: process.env.NOTEBOOKLM_BIN ?? 'notebooklm',
    // S3 — worker output'u doğrudan presigned PUT URL ile yükler;
    // bu yüzden AWS credential gerektirmez. Ama download için
    // S3 keys gerekirse env'e eklenir.
    mockMode: process.env.MOCK_NOTEBOOKLM === '1',
    requestSkewSeconds: 300, // HMAC timestamp 5 dk skew tolerance
  }
})()
