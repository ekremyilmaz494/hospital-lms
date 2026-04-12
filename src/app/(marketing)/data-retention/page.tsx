import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kisisel Veri Saklama ve Imha Politikasi — Hastane LMS',
  description: '6698 sayili KVKK kapsaminda kisisel veri saklama sureleri ve imha yontemleri.',
}

const sections = [
  {
    title: '1. Amac ve Kapsam',
    content: `Bu politika, 6698 sayili Kisisel Verilerin Korunmasi Kanunu ("KVKK") ve Kisisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkinda Yonetmelik uyarinca hazirlanmistir. Hastane LMS platformunda islenen tum kisisel verilerin saklanma sureleri, imha kosullari ve yontemlerini kapsar.`,
  },
  {
    title: '2. Tanimlar',
    content: `**Kisisel Veri:** Kimliginizi belirli veya belirlenebilir kilan her turlu bilgi.
**Veri Sorumlusu:** Hastane LMS Yazilim Teknolojileri, Ankara, Turkiye.
**Imha:** Kisisel verilerin silinmesi, yok edilmesi veya anonim hale getirilmesi.
**Periyodik Imha:** Kanun'da yer alan kisisel veri isleme sartlarinin tamamen ortadan kalkmasi durumunda, tekrarlayan surelerle resen gerceklestirilen silme, yok etme veya anonimlestime islemidir.`,
  },
  {
    title: '3. Veri Kategorileri ve Saklama Sureleri',
    items: [
      { category: 'Kimlik Bilgileri', data: 'Ad, soyad, TC kimlik no, unvan', period: 'Uyelik suresi + 1 yil', basis: 'Sozlesme ifasi' },
      { category: 'Iletisim Bilgileri', data: 'E-posta, telefon', period: 'Uyelik suresi + 1 yil', basis: 'Sozlesme ifasi' },
      { category: 'Mesleki Bilgiler', data: 'Departman, gorev, sicil no', period: 'Uyelik suresi + 1 yil', basis: 'Sozlesme ifasi' },
      { category: 'Egitim ve Sinav Verileri', data: 'Tamamlama durumu, sinav puanlari, video izleme ilerlemesi', period: 'En az 10 yil', basis: 'Yasal yukumluluk (saglik mevzuati)' },
      { category: 'Sertifika Bilgileri', data: 'Sertifika numarasi, verilis/bitis tarihi', period: 'Sertifika gecerlilik suresi + 5 yil', basis: 'Yasal yukumluluk' },
      { category: 'Erisim Kayitlari', data: 'Giris zamanlari, IP adresi, tarayici bilgisi', period: '2 yil', basis: 'Mesru menfaat (guvenlik)' },
      { category: 'Denetim Kayitlari', data: 'Islem kayitlari (audit log)', period: '3 yil', basis: 'Yasal yukumluluk' },
      { category: 'Gorsel Veriler', data: 'Profil fotografi (istege bagli)', period: 'Kullanici sildikten sonra 30 gun', basis: 'Acik riza' },
      { category: 'KVKK Talep Kayitlari', data: 'Basvuru icerigi, sonuc, tarih', period: '5 yil', basis: 'Yasal yukumluluk (ispat)' },
    ],
  },
  {
    title: '4. Imha Yontemleri',
    content: `**Silme:** Kisisel veriler, ilgili kullanicilarin erisemeyecegi sekilde dijital ortamdan kaldirilir. Veritabaninda ilgili satirlar silinir veya anonim hale getirilir.

**Anonimlestime:** Kisisel veriler, baska verilerle eslestirilse dahi hicbir surette kimliginizi belirlenemez hale getirilir. Ornegin:
- Ad/Soyad → "Silinmis Kullanici"
- E-posta → "deleted_[uuid]@anonymized.local"
- TC Kimlik No → null (tamamen silme)
- Telefon → null (tamamen silme)

**Yok Etme:** Fiziksel ortamlarda (yedek medya vb.) geri dondurulemez sekilde imha. Dijital ortamda uzerine yazma veya sifreleme anahtarinin imhasi.`,
  },
  {
    title: '5. Periyodik Imha Sureci',
    content: `Saklama suresi dolan kisisel veriler, **her 6 ayda bir** resen kontrol edilir ve imha edilir. Periyodik imha takvimleri:

- **Ocak (ilk is gunu):** Temmuz-Aralik donemi sona eren veriler
- **Temmuz (ilk is gunu):** Ocak-Haziran donemi sona eren veriler

Imha islemleri kayit altina alinir ve 3 yil saklanir.`,
  },
  {
    title: '6. Veri Sahibinin Talep Hakki',
    content: `KVKK Madde 11 uyarinca, kisisel verilerinizin silinmesini, yok edilmesini veya anonim hale getirilmesini talep edebilirsiniz.

**Basvuru Yollari:**
- Platform icerisinden: Staff Paneli → Kisisel Verilerim (KVKK) → Yeni Talep
- E-posta: kvkk@hastane-lms.com
- Posta: Hastane LMS Yazilim Teknolojileri, Ankara, Turkiye

**Yasal Sure:** Talebiniz en gec **30 gun** icinde sonuclandirilir. Islem ucret gerektiriyorsa (Kurul tarifesi), bilgilendirilirsiniz.

**Istisnalar:** Kanuni saklama yukumlulugu devam eden veriler (saglik egitim kayitlari — 10 yil), talep uzerine silinemez ancak erisim kisitlanir.`,
  },
  {
    title: '7. Guvenlik Onlemleri',
    content: `- Tum veriler aktarimda TLS/SSL sifreleme ile korunur
- Veritabani erisimi rol tabanli yetkilendirme (RLS) ile kisitlanir
- Yedekleme verileri AES-256-GCM sifreleme ile korunur
- Erisim ve islem kayitlari (audit log) tam izlenebilirlik saglar
- Multi-tenant mimari: Her hastane verisi birbirinden tamamen izole`,
  },
  {
    title: '8. Politika Guncellemeleri',
    content: `Bu politika, mevzuat degisiklikleri veya isleme faaliyetlerindeki degisiklikler dogrultusunda guncellenebilir. Guncellemeler platform uzerinden ve/veya e-posta ile bildirilir.

**Son Guncelleme:** 6 Nisan 2026
**Iletisim:** kvkk@hastane-lms.com`,
  },
]

export default function DataRetentionPage() {
  return (
    <div className="min-h-screen py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: '#0d9668' }}>
            KVKK Uyum
          </p>
          <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: '#0f172a' }}>
            Kisisel Veri Saklama ve Imha Politikasi
          </h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            6698 sayili Kanun ve ilgili yonetmelik kapsaminda hazirlanan politika
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-bold mb-3" style={{ color: '#0f172a' }}>
                {section.title}
              </h2>

              {section.content && (
                <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#475569' }}>
                  {section.content}
                </div>
              )}

              {section.items && (
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #e2e8f0' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>Kategori</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>Veri Tipleri</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>Saklama Suresi</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>Hukuki Dayanak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((item, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td className="px-4 py-3 font-medium text-xs" style={{ color: '#0f172a' }}>{item.category}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>{item.data}</td>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#0d9668' }}>{item.period}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{item.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
