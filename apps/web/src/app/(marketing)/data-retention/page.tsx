import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

const KVKK_EMAIL = 'kvkk@klinovax.info'

export const metadata: Metadata = {
  title: `Kişisel Veri Saklama ve İmha Politikası — ${BRAND.fullName}`,
  description: '6698 sayılı KVKK kapsamında kişisel veri saklama süreleri ve imha yöntemleri.',
}

const sections = [
  {
    title: '1. Amaç ve Kapsam',
    content: `Bu politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca hazırlanmıştır. ${BRAND.fullName} platformunda işlenen tüm kişisel verilerin saklanma süreleri, imha koşulları ve yöntemlerini kapsar.`,
  },
  {
    title: '2. Tanımlar',
    content: `**Kişisel Veri:** Kimliğinizi belirli veya belirlenebilir kılan her türlü bilgi.
**Veri Sorumlusu:** Ekrem Yılmaz, Konya, Türkiye.
**İmha:** Kişisel verilerin silinmesi, yok edilmesi veya anonim hale getirilmesi.
**Periyodik İmha:** Kanun'da yer alan kişisel veri işleme şartlarının tamamen ortadan kalkması durumunda, tekrarlayan sürelerle resen gerçekleştirilen silme, yok etme veya anonimleştirme işlemidir.`,
  },
  {
    title: '3. Veri Kategorileri ve Saklama Süreleri',
    items: [
      { category: 'Kimlik Bilgileri', data: 'Ad, soyad, TC kimlik no, unvan', period: 'Üyelik süresi + 1 yıl', basis: 'Sözleşme ifası' },
      { category: 'İletişim Bilgileri', data: 'E-posta, telefon', period: 'Üyelik süresi + 1 yıl', basis: 'Sözleşme ifası' },
      { category: 'Mesleki Bilgiler', data: 'Departman, görev, sicil no', period: 'Üyelik süresi + 1 yıl', basis: 'Sözleşme ifası' },
      { category: 'Eğitim ve Sınav Verileri', data: 'Tamamlama durumu, sınav puanları, video izleme ilerlemesi', period: 'En az 10 yıl', basis: 'Yasal yükümlülük (sağlık mevzuatı)' },
      { category: 'Sertifika Bilgileri', data: 'Sertifika numarası, veriliş/bitiş tarihi', period: 'Sertifika geçerlilik süresi + 5 yıl', basis: 'Yasal yükümlülük' },
      { category: 'Erişim Kayıtları', data: 'Giriş zamanları, IP adresi, tarayıcı bilgisi', period: '2 yıl', basis: 'Meşru menfaat (güvenlik)' },
      { category: 'Denetim Kayıtları', data: 'İşlem kayıtları (audit log)', period: 'Kuruma özel (varsayılan 1 yıl; yönetici 30 gün - 10 yıl arasında ayarlar)', basis: 'Meşru menfaat (güvenlik ve hesap verebilirlik)' },
      { category: 'Görsel Veriler', data: 'Profil fotoğrafı (isteğe bağlı)', period: 'Kullanıcı sildikten sonra 30 gün', basis: 'Açık rıza' },
      { category: 'KVKK Talep Kayıtları', data: 'Başvuru içeriği, sonuç, tarih', period: '5 yıl', basis: 'Yasal yükümlülük (ispat)' },
    ],
  },
  {
    title: '4. İmha Yöntemleri',
    content: `**Silme:** Kişisel veriler, ilgili kullanıcıların erişemeyeceği şekilde dijital ortamdan kaldırılır. Veritabanında ilgili satırlar silinir veya anonim hale getirilir.

**Anonimleştirme:** Kişisel veriler, başka verilerle eşleştirilse dahi hiçbir surette kimliğiniz belirlenemez hale getirilir. Örneğin:
- Ad/Soyad → "Silinmiş Kullanıcı"
- E-posta → "deleted_[uuid]@anonymized.local"
- TC Kimlik No → null (tamamen silme)
- Telefon → null (tamamen silme)

**Yok Etme:** Fiziksel ortamlarda (yedek medya vb.) geri döndürülemez şekilde imha. Dijital ortamda üzerine yazma veya şifreleme anahtarının imhası.`,
  },
  {
    title: '5. Periyodik İmha Süreci',
    content: `Saklama süresi dolan kişisel veriler, **her 6 ayda bir** resen kontrol edilir ve imha edilir. Periyodik imha takvimleri:

- **Ocak (ilk iş günü):** Temmuz-Aralık dönemi sona eren veriler
- **Temmuz (ilk iş günü):** Ocak-Haziran dönemi sona eren veriler

İmha işlemleri kayıt altına alınır ve 3 yıl saklanır.`,
  },
  {
    title: '6. Veri Sahibinin Talep Hakkı',
    content: `KVKK Madde 11 uyarınca, kişisel verilerinizin silinmesini, yok edilmesini veya anonim hale getirilmesini talep edebilirsiniz.

**Başvuru Yolları:**
- Platform içerisinden: Staff Paneli → Kişisel Verilerim (KVKK) → Yeni Talep
- E-posta: ${KVKK_EMAIL}
- Posta: Ekrem Yılmaz, Buhara Mah. Barış Cad. Damlakent Sitesi No: 77/6, Selçuklu / Konya

**Yasal Süre:** Talebiniz en geç **30 gün** içinde sonuçlandırılır. İşlem ücret gerektiriyorsa (Kurul tarifesi), bilgilendirilirsiniz.

**İstisnalar:** Kanuni saklama yükümlülüğü devam eden veriler (sağlık eğitim kayıtları — 10 yıl), talep üzerine silinemez ancak erişim kısıtlanır.`,
  },
  {
    title: '7. Güvenlik Önlemleri',
    content: `- Tüm veriler aktarımda TLS/SSL şifreleme ile korunur
- Veritabanı erişimi satır düzeyi güvenlik (RLS) ve rol tabanlı yetkilendirme ile kısıtlanır
- Yedekleme verileri AES-256-GCM şifreleme ile korunur
- Erişim ve işlem kayıtları (audit log) tutulur; saklama süresi kuruma özeldir
- Multi-tenant mimari: Her organizasyon verisi birbirinden tamamen izole`,
  },
  {
    title: '8. Politika Güncellemeleri',
    content: `Bu politika, mevzuat değişiklikleri veya işleme faaliyetlerindeki değişiklikler doğrultusunda güncellenebilir. Güncellemeler platform üzerinden ve/veya e-posta ile bildirilir.

**Son Güncelleme:** Temmuz 2026
**İletişim:** ${KVKK_EMAIL}`,
  },
]

export default function DataRetentionPage() {
  return (
    <div className="px-4 pb-24 pt-6 lg:pt-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--landing-brand)' }}>
            KVKK Uyum
          </p>
          <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Kişisel Veri Saklama ve İmha Politikası
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            6698 sayılı Kanun ve ilgili yönetmelik kapsamında hazırlanan politika
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                {section.title}
              </h2>

              {section.content && (
                <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
                  {section.content}
                </div>
              )}

              {section.items && (
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--landing-rule-strong)' }}>
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr style={{ background: 'var(--landing-surface)' }}>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Kategori</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Veri Tipleri</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Saklama Süresi</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Hukuki Dayanak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((item, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--landing-rule-strong)' }}>
                          <td className="px-4 py-3 font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>{item.category}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.data}</td>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--landing-brand)' }}>{item.period}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.basis}</td>
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
