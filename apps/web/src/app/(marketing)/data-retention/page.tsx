import { pageMetadata } from '@/lib/site-metadata'
import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { LegalPage, type LegalSection } from '@/components/site/legal-page'

const KVKK_EMAIL = 'ekrem@klinovax.com'

export const metadata: Metadata = pageMetadata({
  title: 'Kişisel Veri Saklama ve İmha Politikası',
  description:
    '6698 sayılı KVKK kapsamında KlinoVax\'ta işlenen kişisel verilerin saklama süreleri ve imha yöntemleri.',
  path: '/data-retention',
});

const S = {
  amac: { id: 'amac-ve-kapsam', label: '1. Amaç ve Kapsam' },
  tanimlar: { id: 'tanimlar', label: '2. Tanımlar' },
  sureler: { id: 'saklama-sureleri', label: '3. Veri Kategorileri ve Saklama Süreleri' },
  yontemler: { id: 'imha-yontemleri', label: '4. İmha Yöntemleri' },
  periyodik: { id: 'periyodik-imha', label: '5. Periyodik İmha Süreci' },
  talep: { id: 'talep-hakki', label: '6. Veri Sahibinin Talep Hakkı' },
  guvenlik: { id: 'guvenlik-onlemleri', label: '7. Güvenlik Önlemleri' },
  guncelleme: { id: 'politika-guncellemeleri', label: '8. Politika Güncellemeleri' },
} as const satisfies Record<string, LegalSection>

const SECTIONS: readonly LegalSection[] = Object.values(S)

const RETENTION_ROWS = [
  { category: 'Kimlik Bilgileri', data: 'Ad, soyad, TC kimlik no, unvan', period: 'Üyelik süresi + 1 yıl', basis: 'Sözleşme ifası' },
  { category: 'İletişim Bilgileri', data: 'E-posta, telefon', period: 'Üyelik süresi + 1 yıl', basis: 'Sözleşme ifası' },
  { category: 'Mesleki Bilgiler', data: 'Departman, görev, sicil no', period: 'Üyelik süresi + 1 yıl', basis: 'Sözleşme ifası' },
  { category: 'Eğitim ve Sınav Verileri', data: 'Tamamlama durumu, sınav puanları, video izleme ilerlemesi', period: 'En az 10 yıl', basis: 'Yasal yükümlülük (sağlık mevzuatı)' },
  { category: 'Sertifika Bilgileri', data: 'Sertifika numarası, veriliş/bitiş tarihi', period: 'Sertifika geçerlilik süresi + 5 yıl', basis: 'Yasal yükümlülük' },
  { category: 'Erişim Kayıtları', data: 'Giriş zamanları, IP adresi, tarayıcı bilgisi', period: '2 yıl', basis: 'Meşru menfaat (güvenlik)' },
  { category: 'Denetim Kayıtları', data: 'İşlem kayıtları (audit log)', period: '3 yıl', basis: 'Yasal yükümlülük' },
  { category: 'Görsel Veriler', data: 'Profil fotoğrafı (isteğe bağlı)', period: 'Kullanıcı sildikten sonra 30 gün', basis: 'Açık rıza' },
  { category: 'KVKK Talep Kayıtları', data: 'Başvuru içeriği, sonuç, tarih', period: '5 yıl', basis: 'Yasal yükümlülük (ispat)' },
] as const

export default function DataRetentionPage() {
  return (
    <LegalPage breadcrumbPath="/data-retention"
      title="Kişisel Veri Saklama ve İmha Politikası"
      lead="6698 sayılı Kanun ve ilgili yönetmelik kapsamında hazırlanan politika"
      sections={SECTIONS}
    >
      <h2 id={S.amac.id}>{S.amac.label}</h2>
      <p>
        Bu politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) ve Kişisel Verilerin
        Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca hazırlanmıştır.{' '}
        {BRAND.fullName} platformunda işlenen tüm kişisel verilerin saklanma süreleri, imha koşulları ve
        yöntemlerini kapsar.
      </p>

      <h2 id={S.tanimlar.id}>{S.tanimlar.label}</h2>
      <p>
        <strong>Kişisel Veri:</strong> Kimliğinizi belirli veya belirlenebilir kılan her türlü bilgi.
      </p>
      <p>
        <strong>Veri Sorumlusu:</strong> Ekrem Yılmaz, Konya, Türkiye.
      </p>
      <p>
        <strong>İmha:</strong> Kişisel verilerin silinmesi, yok edilmesi veya anonim hale getirilmesi.
      </p>
      <p>
        <strong>Periyodik İmha:</strong> Kanun&apos;da yer alan kişisel veri işleme şartlarının tamamen ortadan
        kalkması durumunda, tekrarlayan sürelerle resen gerçekleştirilen silme, yok etme veya anonimleştirme
        işlemidir.
      </p>

      <h2 id={S.sureler.id}>{S.sureler.label}</h2>
      <div className="s-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Kategori</th>
              <th scope="col">Veri Tipleri</th>
              <th scope="col">Saklama Süresi</th>
              <th scope="col">Hukuki Dayanak</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_ROWS.map((row) => (
              <tr key={row.category}>
                <th scope="row">{row.category}</th>
                <td>{row.data}</td>
                <td>
                  <strong>{row.period}</strong>
                </td>
                <td>{row.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id={S.yontemler.id}>{S.yontemler.label}</h2>
      <p>
        <strong>Silme:</strong> Kişisel veriler, ilgili kullanıcıların erişemeyeceği şekilde dijital ortamdan
        kaldırılır. Veritabanında ilgili satırlar silinir veya anonim hale getirilir.
      </p>
      <p>
        <strong>Anonimleştirme:</strong> Kişisel veriler, başka verilerle eşleştirilse dahi hiçbir surette
        kimliğinizi belirlenemez hale getirilir. Örneğin:
      </p>
      <ul>
        <li>Ad/Soyad → &quot;Silinmiş Kullanıcı&quot;</li>
        <li>E-posta → &quot;deleted_[uuid]@anonymized.local&quot;</li>
        <li>TC Kimlik No → null (tamamen silme)</li>
        <li>Telefon → null (tamamen silme)</li>
      </ul>
      <p>
        <strong>Yok Etme:</strong> Fiziksel ortamlarda (yedek medya vb.) geri döndürülemez şekilde imha. Dijital
        ortamda üzerine yazma veya şifreleme anahtarının imhası.
      </p>

      <h2 id={S.periyodik.id}>{S.periyodik.label}</h2>
      <p>
        Saklama süresi dolan kişisel veriler, <strong>her 6 ayda bir</strong> resen kontrol edilir ve imha
        edilir. Periyodik imha takvimleri:
      </p>
      <ul>
        <li>
          <strong>Ocak (ilk iş günü):</strong> Temmuz-Aralık dönemi sona eren veriler
        </li>
        <li>
          <strong>Temmuz (ilk iş günü):</strong> Ocak-Haziran dönemi sona eren veriler
        </li>
      </ul>
      <p>İmha işlemleri kayıt altına alınır ve 3 yıl saklanır.</p>

      <h2 id={S.talep.id}>{S.talep.label}</h2>
      <p>
        KVKK Madde 11 uyarınca, kişisel verilerinizin silinmesini, yok edilmesini veya anonim hale
        getirilmesini talep edebilirsiniz.
      </p>
      <p>
        <strong>Başvuru Yolları:</strong>
      </p>
      <ul>
        <li>Platform içerisinden: Staff Paneli → Kişisel Verilerim (KVKK) → Yeni Talep</li>
        <li>
          E-posta: <a href={`mailto:${KVKK_EMAIL}`}>{KVKK_EMAIL}</a>
        </li>
        <li>Posta: Ekrem Yılmaz, Konya, Türkiye</li>
      </ul>
      <p>
        <strong>Yasal Süre:</strong> Talebiniz en geç <strong>30 gün</strong> içinde sonuçlandırılır. İşlem ücret
        gerektiriyorsa (Kurul tarifesi), bilgilendirilirsiniz.
      </p>
      <p>
        <strong>İstisnalar:</strong> Kanuni saklama yükümlülüğü devam eden veriler (sağlık eğitim kayıtları: 10
        yıl), talep üzerine silinemez ancak erişim kısıtlanır.
      </p>

      <h2 id={S.guvenlik.id}>{S.guvenlik.label}</h2>
      <ul>
        <li>Tüm veriler aktarımda TLS/SSL şifreleme ile korunur</li>
        <li>Veritabanı erişimi rol tabanlı yetkilendirme (RLS) ile kısıtlanır</li>
        <li>Yedekleme verileri AES-256-GCM şifreleme ile korunur</li>
        <li>Erişim ve işlem kayıtları (audit log) tam izlenebilirlik sağlar</li>
        <li>Multi-tenant mimari: Her organizasyon verisi birbirinden tamamen izole</li>
      </ul>

      <h2 id={S.guncelleme.id}>{S.guncelleme.label}</h2>
      <p>
        Bu politika, mevzuat değişiklikleri veya işleme faaliyetlerindeki değişiklikler doğrultusunda
        güncellenebilir. Güncellemeler platform üzerinden ve/veya e-posta ile bildirilir.
      </p>
      <p>
        <strong>Son Güncelleme:</strong> Temmuz 2026
        <br />
        <strong>İletişim:</strong> <a href={`mailto:${KVKK_EMAIL}`}>{KVKK_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
