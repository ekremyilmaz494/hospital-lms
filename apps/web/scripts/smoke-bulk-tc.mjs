// Smoke test fixture: /admin/staff toplu yükleme + TC entegrasyonu
// 5 satır × 5 farklı senaryo — her biri farklı kod yolunu zorlar.
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../tmp-smoke-bulk-tc.xlsx');

const wb = new ExcelJS.Workbook();
const sh = wb.addWorksheet('Personel');

sh.columns = [
  { header: 'Ad', key: 'ad', width: 16 },
  { header: 'Soyad', key: 'soyad', width: 16 },
  { header: 'TC Kimlik No', key: 'tc', width: 16 },
  { header: 'E-posta', key: 'email', width: 30 },
  { header: 'Şifre', key: 'sifre', width: 18 },
  { header: 'Telefon', key: 'tel', width: 14 },
  { header: 'Departman', key: 'dep', width: 16 },
  { header: 'Unvan', key: 'unvan', width: 16 },
];

// TC sütununu text formatla — öndeki 0 kaybolmasın
for (let r = 2; r <= 10; r++) sh.getCell(`C${r}`).numFmt = '@';

const rows = [
  // 1) DIRECT MODE OK — geçerli TC + şifre → AES-GCM şifreli kayıt
  { ad: 'Ayşe',   soyad: 'Yılmaz', tc: '10000000146', email: 'smoke.ok@deneme.test',     sifre: 'GeçiciP@ss123', tel: '05551110001', dep: '', unvan: 'Hemşire' },

  // 2) INVITE MODE OK — TC ve şifre boş → davet linki
  { ad: 'Mehmet', soyad: 'Demir',  tc: '',            email: 'smoke.invite@deneme.test', sifre: '',              tel: '05551110002', dep: '', unvan: 'Doktor'  },

  // 3) HATA: Geçersiz TC (checksum) — 12345678901 NVİ kuralını geçmez
  { ad: 'Hatalı', soyad: 'TC',     tc: '12345678901', email: 'smoke.badtc@deneme.test',  sifre: 'GeçiciP@ss123', tel: '05551110003', dep: '', unvan: '' },

  // 4) HATA: Direct mode + TC boş — "şifre belirlenmiş satırlarda TC zorunlu"
  { ad: 'Şifre',  soyad: 'TcYok',  tc: '',            email: 'smoke.notc@deneme.test',   sifre: 'GeçiciP@ss123', tel: '05551110004', dep: '', unvan: '' },

  // 5) HATA: Aynı TC dosya içinde tekrar (1. satır ile aynı) — duplicate yakalanmalı
  { ad: 'Ayşe',   soyad: 'Kopya',  tc: '10000000146', email: 'smoke.dup@deneme.test',    sifre: 'GeçiciP@ss123', tel: '05551110005', dep: '', unvan: '' },
];
rows.forEach(r => sh.addRow(r));

await wb.xlsx.writeFile(out);
console.log('OK', out);
