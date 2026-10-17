import { describe, expect, it } from 'vitest'
import { parseAttribution } from '../attribution'

describe('parseAttribution', () => {
  it('geçerli UTM ve açılış yolunu kabul eder, boş metni atar', () => {
    expect(
      parseAttribution({ utmSource: ' linkedin ', utmMedium: '', utmCampaign: 'ekim-lansman', landingPath: '/demo' }),
    ).toEqual({ utmSource: 'linkedin', utmMedium: undefined, utmCampaign: 'ekim-lansman', landingPath: '/demo' })
  })

  it('hiç alan yoksa veya değer değilse null', () => {
    expect(parseAttribution(undefined)).toBeNull()
    expect(parseAttribution('utm')).toBeNull()
    expect(parseAttribution({})).toBeNull()
  })

  it('geçersiz atfı bütünüyle yok sayar (istek bozulmaz)', () => {
    expect(parseAttribution({ utmSource: 'a\u0000b' })).toBeNull()
    expect(parseAttribution({ landingPath: 'https://evil.example/x' })).toBeNull()
    expect(parseAttribution({ referrerHost: 'evil.example/path?x=1' })).toBeNull()
    expect(parseAttribution({ utmCampaign: 'x'.repeat(151) })).toBeNull()
  })
})
