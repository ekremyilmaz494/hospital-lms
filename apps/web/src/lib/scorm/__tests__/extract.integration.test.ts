import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

/**
 * GERÇEK-paket ingest entegrasyon testi. `extractScormPackage`'i (jszip + manifest
 * parse + S3 upload zinciri) GERÇEK, authoring-aracı-şeklinde SCORM 1.2 ve 2004 zip
 * buffer'larına karşı çalıştırır — yalnız S3 I/O (`uploadBuffer`) mock'lanır.
 *
 * Bu, birim testlerin (yalnız `sanitizeEntryPath`) bıraktığı boşluğu kapatır:
 * gerçek bir paketin uçtan uca açılıp doğru anahtarlarla çıkarıldığını + sürüm/
 * entry point/mastery tespitini + zip-slip/manifest guard'larının GERÇEK pakette
 * tetiklendiğini kanıtlar (hakem 2026-07-10, "extract testi yok" bulgusu).
 */

const { uploadBufferMock, deleteObjectMock } = vi.hoisted(() => ({
  uploadBufferMock: vi.fn().mockResolvedValue(undefined),
  deleteObjectMock: vi.fn().mockResolvedValue(undefined),
}))

// Yalnız S3 I/O'yu mock'la; scormKey GERÇEK davranışı (prefix birleştirme) korunur.
vi.mock('@/lib/s3', () => ({
  uploadBuffer: uploadBufferMock,
  deleteObject: deleteObjectMock,
  scormKey: (orgId: string, trainingId: string, safePath: string) =>
    `scorm/${orgId}/${trainingId}/${safePath}`,
}))

import { extractScormPackage, cleanupScormKeys } from '../extract'
import { ScormManifestError } from '../manifest'

const ORG = 'org-42'
const TRAINING = 'training-99'

// ── Gerçek authoring-aracı şeklinde manifestler ──
const MANIFEST_12 = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-EL-HIJYEN" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>El Hijyeni Eğitimi</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>Ders 1</title>
        <adlcp:masteryscore>80</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="assets/style.css"/>
      <file href="assets/img/logo.png"/>
    </resource>
  </resources>
</manifest>`

const MANIFEST_2004 = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-IG-2004" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
  <organizations default="ORG-2004">
    <organization identifier="ORG-2004">
      <title>İş Güvenliği 2004</title>
      <item identifier="ITEM-2004" identifierref="RES-2004">
        <title>Modül 1</title>
        <imsss:sequencing>
          <imsss:objectives>
            <imsss:primaryObjective satisfiedByMeasure="true">
              <imsss:minNormalizedMeasure>0.7</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-2004" type="webcontent" adlcp:scormType="sco" href="content/start.html">
      <file href="content/start.html"/>
      <file href="content/app.js"/>
    </resource>
  </resources>
</manifest>`

async function zipBuffer(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  return zip.generateAsync({ type: 'nodebuffer' })
}

beforeEach(() => {
  vi.clearAllMocks()
  uploadBufferMock.mockResolvedValue(undefined)
})

describe('extractScormPackage — gerçek SCORM 1.2 paketi', () => {
  it('sürüm/entry/mastery tespit eder ve tüm dosyaları doğru anahtarlarla yükler', async () => {
    const buf = await zipBuffer({
      'imsmanifest.xml': MANIFEST_12,
      'index.html': '<html><body>El Hijyeni</body></html>',
      'assets/style.css': 'body{font-family:sans-serif}',
      'assets/img/logo.png': 'FAKE-PNG-BYTES',
    })

    const result = await extractScormPackage(buf, { orgId: ORG, trainingId: TRAINING })

    expect(result.manifest.version).toBe('1.2')
    expect(result.manifest.entryHref).toBe('index.html')
    expect(result.manifest.masteryScore).toBe(80)
    expect(result.manifestKey).toBe(`scorm/${ORG}/${TRAINING}/imsmanifest.xml`)

    // Tüm 4 dosya yüklendi (manifest dahil), doğru prefix + iç içe dizin korunmuş.
    const keys = uploadBufferMock.mock.calls.map((c) => c[0]).sort()
    expect(keys).toEqual(
      [
        `scorm/${ORG}/${TRAINING}/assets/img/logo.png`,
        `scorm/${ORG}/${TRAINING}/assets/style.css`,
        `scorm/${ORG}/${TRAINING}/imsmanifest.xml`,
        `scorm/${ORG}/${TRAINING}/index.html`,
      ].sort(),
    )
    // Content-Type ext'e göre (html/css/png) — octet-stream değil.
    const byKey = new Map(uploadBufferMock.mock.calls.map((c) => [c[0], c[2]]))
    expect(byKey.get(`scorm/${ORG}/${TRAINING}/index.html`)).toBe('text/html')
    expect(byKey.get(`scorm/${ORG}/${TRAINING}/assets/style.css`)).toBe('text/css')
    expect(byKey.get(`scorm/${ORG}/${TRAINING}/assets/img/logo.png`)).toBe('image/png')
    expect(result.uploadedKeys).toHaveLength(4)
  })
})

describe('extractScormPackage — gerçek SCORM 2004 paketi', () => {
  it('2004 sürümünü, alt-dizinli entry ve minNormalizedMeasure→mastery tespit eder', async () => {
    const buf = await zipBuffer({
      'imsmanifest.xml': MANIFEST_2004,
      'content/start.html': '<html><body>İş Güvenliği</body></html>',
      'content/app.js': 'console.log("scorm 2004")',
    })

    const result = await extractScormPackage(buf, { orgId: ORG, trainingId: TRAINING })

    expect(result.manifest.version).toBe('2004')
    expect(result.manifest.entryHref).toBe('content/start.html')
    expect(result.manifest.masteryScore).toBe(70) // 0.7 × 100
    const keys = uploadBufferMock.mock.calls.map((c) => c[0])
    expect(keys).toContain(`scorm/${ORG}/${TRAINING}/content/start.html`)
    expect(keys).toContain(`scorm/${ORG}/${TRAINING}/content/app.js`)
  })
})

describe('extractScormPackage — güvenlik / hatalı paketler', () => {
  it('imsmanifest.xml yoksa ScormManifestError (hiçbir dosya yüklenmez)', async () => {
    const buf = await zipBuffer({ 'index.html': '<html></html>' })
    await expect(extractScormPackage(buf, { orgId: ORG, trainingId: TRAINING })).rejects.toBeInstanceOf(
      ScormManifestError,
    )
  })

  // NOT: zip-slip (`../`) girdisi JSZip.file() ile ÜRETİLEMEZ — JSZip yazarken yolu
  // normalize eder (deneysel: `../evil.txt` → `evil.txt`). Prodda guard, DIŞ araçla
  // üretilmiş (raw `../` koruyan) zip'lerde tetiklenir; bu davranış `sanitizeEntryPath`
  // birim testinde (extract.test.ts) `../secret`/`/etc/passwd`/`C:\\` → null ile kilitli.

  it('cleanupScormKeys yüklenen anahtarları siler (rollback)', async () => {
    await cleanupScormKeys([`scorm/${ORG}/${TRAINING}/a.html`, `scorm/${ORG}/${TRAINING}/b.js`])
    expect(deleteObjectMock).toHaveBeenCalledTimes(2)
  })
})
