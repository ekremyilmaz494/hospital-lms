import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('development modunda', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('logger.info console.log ile doğru prefix formatında çağrılır', async () => {
      const { logger } = await import('../logger')

      logger.info('TestTag', 'test mesajı', { key: 'value' })

      expect(logSpy).toHaveBeenCalledWith(
        '[INFO] [TestTag]',
        'test mesajı',
        { key: 'value' }
      )
    })

    it('logger.warn console.warn çağrılır', async () => {
      const { logger } = await import('../logger')

      logger.warn('WarnTag', 'uyarı mesajı')

      expect(warnSpy).toHaveBeenCalledWith(
        '[WARN] [WarnTag]',
        'uyarı mesajı',
        ''
      )
    })

    it('logger.error console.error çağrılır', async () => {
      const { logger } = await import('../logger')

      logger.error('ErrorTag', 'hata mesajı', 'detay')

      expect(errorSpy).toHaveBeenCalledWith(
        '[ERROR] [ErrorTag]',
        'hata mesajı',
        'detay'
      )
    })

    it('requestId sağlandığında prefix içinde yer alır', async () => {
      const { logger } = await import('../logger')

      logger.info('Tag', 'mesaj', undefined, { requestId: 'req-123' })

      expect(logSpy).toHaveBeenCalledWith(
        '[INFO] [Tag] [req:req-123]',
        'mesaj',
        ''
      )
    })
  })

  describe('production modunda', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('yapılandırılmış JSON çıktısı üretir', async () => {
      const { logger } = await import('../logger')

      logger.info('ProdTag', 'production mesajı')

      expect(logSpy).toHaveBeenCalledTimes(1)
      const output = logSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.level).toBe('info')
      expect(parsed.tag).toBe('ProdTag')
      expect(parsed.msg).toBe('production mesajı')
      expect(parsed.ts).toBeDefined()
    })

    it('JSON çıktısı level, tag, msg ve ts içerir', async () => {
      const { logger } = await import('../logger')

      logger.warn('WarnTag', 'uyarı')

      const output = warnSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed).toHaveProperty('level', 'warn')
      expect(parsed).toHaveProperty('tag', 'WarnTag')
      expect(parsed).toHaveProperty('msg', 'uyarı')
      expect(parsed).toHaveProperty('ts')
    })

    it('extra sağlandığında JSON içinde yer alır', async () => {
      const { logger } = await import('../logger')

      logger.error('ErrTag', 'hata', { detail: 'bilgi' })

      const output = errorSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.extra).toEqual({ detail: 'bilgi' })
    })
  })
})
