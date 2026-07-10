// Test SCORM paketleri üretici — CANLI uçtan-uca smoke için.
//
// Gerçek, ÇALIŞAN SCORM 1.2 ve 2004 paketleri (.zip) üretir. Her paket LMS API'sini
// window zincirinde bulur, başlatır ve "Tamamla" butonuyla completion + skor gönderir.
// Kullanım:
//   node scripts/make-scorm-test-packages.mjs [çıktı-dizini]
// Varsayılan çıktı: ./scorm-test-packages/
// Sonra /admin/scorm'dan yükle → personele ata → oynat → "Tamamla" → sertifika doğrula.

import JSZip from 'jszip'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const outDir = resolve(process.argv[2] ?? './scorm-test-packages')

// ── SCORM API keşfi (standart: window.parent zincirini yürü) ──
const FIND_API_12 = `function findAPI(w){var n=0;while(w.API==null&&w.parent!=null&&w.parent!=w&&n<12){n++;w=w.parent;}return w.API;}
var API=findAPI(window)||(window.opener?findAPI(window.opener):null);`

const FIND_API_2004 = `function findAPI(w){var n=0;while(w.API_1484_11==null&&w.parent!=null&&w.parent!=w&&n<12){n++;w=w.parent;}return w.API_1484_11;}
var API=findAPI(window)||(window.opener?findAPI(window.opener):null);`

const HTML_12 = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>El Hijyeni (SCORM 1.2)</title>
<link rel="stylesheet" href="assets/style.css"></head>
<body>
<h1>El Hijyeni Eğitimi</h1>
<p class="tag">SCORM 1.2 test paketi</p>
<p>Bu bir doğrulama içeriğidir. Butona basınca eğitim <b>tamamlandı</b> olarak işaretlenir (skor 90).</p>
<button id="done">Eğitimi Tamamla</button>
<p id="status">Durum: başlatılıyor…</p>
<script>
${FIND_API_12}
var el=document.getElementById('status');
if(API){API.LMSInitialize('');el.textContent='Durum: başlatıldı';}else{el.textContent='HATA: SCORM API bulunamadı';}
document.getElementById('done').onclick=function(){
  if(!API){return;}
  API.LMSSetValue('cmi.core.lesson_status','completed');
  API.LMSSetValue('cmi.core.score.raw','90');
  API.LMSSetValue('cmi.core.session_time','00:02:30');
  API.LMSSetValue('cmi.suspend_data','done=1');
  API.LMSCommit('');
  API.LMSFinish('');
  el.textContent='Durum: TAMAMLANDI ✓';
};
</script>
</body></html>`

const HTML_2004 = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>İş Güvenliği (SCORM 2004)</title>
<link rel="stylesheet" href="app.css"></head>
<body>
<h1>İş Güvenliği Eğitimi</h1>
<p class="tag">SCORM 2004 3rd Edition test paketi</p>
<p>Butona basınca completion=completed, success=passed, score.scaled=0.9 gönderilir.</p>
<button id="done">Eğitimi Tamamla</button>
<p id="status">Durum: başlatılıyor…</p>
<script>
${FIND_API_2004}
var el=document.getElementById('status');
if(API){API.Initialize('');el.textContent='Durum: başlatıldı';}else{el.textContent='HATA: SCORM 2004 API bulunamadı';}
document.getElementById('done').onclick=function(){
  if(!API){return;}
  API.SetValue('cmi.completion_status','completed');
  API.SetValue('cmi.success_status','passed');
  API.SetValue('cmi.score.scaled','0.9');
  API.SetValue('cmi.score.raw','90');
  API.SetValue('cmi.session_time','PT2M30S');
  API.SetValue('cmi.suspend_data','done=1');
  API.Commit('');
  API.Terminate('');
  el.textContent='Durum: TAMAMLANDI ✓';
};
</script>
</body></html>`

const CSS = 'body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#0a1628}h1{font-size:22px}.tag{display:inline-block;background:#eaf6ef;color:#0a7a47;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}button{margin-top:12px;padding:11px 20px;font-size:15px;border:0;border-radius:10px;background:#0d9668;color:#fff;cursor:pointer}#status{margin-top:16px;color:#5b6478;font-size:14px}'

const MANIFEST_12 = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="KLX-SCORM12-ELHIJYEN" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
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
    </resource>
  </resources>
</manifest>`

const MANIFEST_2004 = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="KLX-SCORM2004-ISGUV" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 3rd Edition</schemaversion></metadata>
  <organizations default="ORG-2004">
    <organization identifier="ORG-2004">
      <title>İş Güvenliği 2004</title>
      <item identifier="ITEM-2004" identifierref="RES-2004">
        <title>Modül 1</title>
        <imsss:sequencing><imsss:objectives>
          <imsss:primaryObjective satisfiedByMeasure="true">
            <imsss:minNormalizedMeasure>0.7</imsss:minNormalizedMeasure>
          </imsss:primaryObjective>
        </imsss:objectives></imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-2004" type="webcontent" adlcp:scormType="sco" href="content/start.html">
      <file href="content/start.html"/>
      <file href="content/app.css"/>
    </resource>
  </resources>
</manifest>`

async function build(name, files) {
  const zip = new JSZip()
  for (const [p, c] of Object.entries(files)) zip.file(p, c)
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const out = join(outDir, name)
  await writeFile(out, buf)
  console.log(`  ✓ ${out} (${(buf.length / 1024).toFixed(1)} KB)`)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  console.log(`SCORM test paketleri üretiliyor → ${outDir}`)
  await build('scorm-1.2-el-hijyeni.zip', {
    'imsmanifest.xml': MANIFEST_12,
    'index.html': HTML_12,
    'assets/style.css': CSS,
  })
  await build('scorm-2004-is-guvenligi.zip', {
    'imsmanifest.xml': MANIFEST_2004,
    'content/start.html': HTML_2004,
    'content/app.css': CSS,
  })
  console.log('\nBitti. /admin/scorm → "Paket Yükle" ile bu .zip dosyalarını yükleyin,')
  console.log('personele atayın, oynatıcıda "Eğitimi Tamamla" → sertifika/geçiş doğrulayın.')
}

main().catch((e) => {
  console.error('HATA:', e)
  process.exit(1)
})
