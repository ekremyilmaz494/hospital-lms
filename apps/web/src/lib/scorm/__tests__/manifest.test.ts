import { describe, it, expect } from 'vitest'
import { parseScormManifest, ScormManifestError } from '../manifest'

/**
 * parseScormManifest() sözleşmesini koruma altına alan testler.
 *
 * fast-xml-parser `removeNSPrefix: true` ile yapılandırılmıştır → authoring
 * aracının yazdığı namespace önekleri (adlcp:, imsss:, xml:) parse sırasında
 * kaldırılır (adlcp:masteryscore → masteryscore, xml:base → @_base). Fixture'lar
 * gerçek bir authoring aracı gibi önekli yazılır; beklentiler parser'ın gerçek
 * çıktısıyla eşleşir.
 */

describe('parseScormManifest — SCORM 1.2', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-1" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Örnek Eğitim</title>
      <item identifier="I1" identifierref="R1">
        <title>SCO 1</title>
        <adlcp:masteryscore>80</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R1" type="webcontent" href="index.html" adlcp:scormtype="sco"/>
  </resources>
</manifest>`

  it('sürüm + entryHref + masteryScore çözümler', () => {
    const parsed = parseScormManifest(xml)
    expect(parsed).toEqual({
      version: '1.2',
      entryHref: 'index.html',
      masteryScore: 80,
    })
  })
})

describe('parseScormManifest — SCORM 2004', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>2004 Eğitim</title>
      <item identifier="I1" identifierref="R1">
        <title>SCO 1</title>
        <imsss:sequencing>
          <imsss:objectives>
            <imsss:primaryObjective>
              <imsss:minNormalizedMeasure>0.7</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R1" type="webcontent" href="content/start.html" adlcp:scormType="sco"/>
  </resources>
</manifest>`

  it('minNormalizedMeasure × 100 → masteryScore', () => {
    const parsed = parseScormManifest(xml)
    expect(parsed).toEqual({
      version: '2004',
      entryHref: 'content/start.html',
      masteryScore: 70,
    })
  })
})

describe('parseScormManifest — masteryScore yok', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-3" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <item identifier="I1" identifierref="R1">
        <title>SCO 1</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R1" type="webcontent" href="index.html" adlcp:scormtype="sco"/>
  </resources>
</manifest>`

  it('eşik yoksa masteryScore null', () => {
    const parsed = parseScormManifest(xml)
    expect(parsed.masteryScore).toBeNull()
    expect(parsed.version).toBe('1.2')
    expect(parsed.entryHref).toBe('index.html')
  })
})

describe('parseScormManifest — default organization seçimi', () => {
  // default İKİNCİ organization'a işaret ediyor → entryHref o org'un item'ından gelir.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-4" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-2">
    <organization identifier="ORG-1">
      <item identifier="I1" identifierref="R1">
        <title>Birinci</title>
      </item>
    </organization>
    <organization identifier="ORG-2">
      <item identifier="I2" identifierref="R2">
        <title>İkinci</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R1" type="webcontent" href="first.html" adlcp:scormtype="sco"/>
    <resource identifier="R2" type="webcontent" href="second.html" adlcp:scormtype="sco"/>
  </resources>
</manifest>`

  it('default=ORG-2 → ikinci org item resource href', () => {
    const parsed = parseScormManifest(xml)
    expect(parsed.entryHref).toBe('second.html')
  })
})

describe('parseScormManifest — xml:base çözümü', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-5" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <item identifier="I1" identifierref="R1">
        <title>SCO 1</title>
      </item>
    </organization>
  </organizations>
  <resources xml:base="content/">
    <resource identifier="R1" type="webcontent" href="start.html" adlcp:scormtype="sco"/>
  </resources>
</manifest>`

  it('resources xml:base + href → content/start.html', () => {
    const parsed = parseScormManifest(xml)
    expect(parsed.entryHref).toBe('content/start.html')
  })
})

describe('parseScormManifest — hata durumları', () => {
  it('<manifest> kök öğesi yoksa ScormManifestError fırlatır', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<notmanifest>
  <organizations default="ORG-1"/>
</notmanifest>`
    expect(() => parseScormManifest(xml)).toThrow(ScormManifestError)
  })

  it('başlatılabilir item (identifierref) yoksa fırlatır', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-6" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <item identifier="I1">
        <title>Referanssız item</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R1" type="webcontent" href="index.html" adlcp:scormtype="sco"/>
  </resources>
</manifest>`
    expect(() => parseScormManifest(xml)).toThrow(ScormManifestError)
  })
})
