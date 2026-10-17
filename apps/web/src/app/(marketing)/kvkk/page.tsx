import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site-metadata'
import { LegalPage, type LegalSection } from '@/components/site/legal-page'

export const metadata: Metadata = pageMetadata({
  title: 'KVKK Aydınlatma Metni',
  description:
    '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında KlinoVax aydınlatma metni: işlenen veriler, amaçlar ve haklarınız.',
  path: '/kvkk',
})

const KVKK_EMAIL = 'ekrem@klinovax.com'

const S = {
  sorumlu: { id: 'veri-sorumlusu', label: '1. Veri Sorumlusu' },
  isleyen: { id: 'veri-isleyen', label: '2. Veri İşleyen Sıfatımız ve Sınırı' },
  amac: { id: 'isleme-amaci', label: '3. Kişisel Verilerin İşlenme Amacı' },
  sebepler: { id: 'hukuki-sebepler', label: '4. İşlemenin Hukuki Sebepleri' },
  veriler: { id: 'islenen-veriler', label: '5. İşlenen Kişisel Veriler' },
  aktarim: { id: 'veri-aktarimi', label: '6. Verilerin Aktarılması' },
  saklama: { id: 'saklama-suresi', label: '7. Veri Saklama Süresi' },
  haklar: { id: 'haklariniz', label: '8. Veri Sahibinin Hakları' },
  basvuru: { id: 'basvuru-ve-iletisim', label: '9. Başvuru ve İletişim' },
} as const satisfies Record<string, LegalSection>

const SECTIONS: readonly LegalSection[] = Object.values(S)

/** md. 5/2 bentleri: madde atfı kalın, açıklaması alt satırda. */
const LEGAL_BASES = [
  { ref: 'md. 5/2-c', text: 'Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (iş akdi gereği eğitim kayıtlarının tutulması)' },
  { ref: 'md. 5/2-ç', text: 'Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi (Sağlık Bakanlığı zorunlu eğitim gereksinimleri)' },
  { ref: 'md. 5/2-f', text: 'Veri sorumlusunun meşru menfaatleri için zorunlu olması (platform güvenliği, sistem yönetimi)' },
] as const

const PROCESSED_DATA = [
  'Ad ve Soyad',
  'E-posta adresi',
  'Departman ve unvan bilgisi',
  'Sınav sonuçları ve başarı durumu',
  'Video izleme kayıtları ve ilerleme bilgileri',
  'Dijital imza görselleri (eğitim katılım/imza formu)',
  'Oturum açma zaman damgaları ve IP adresi (audit log)',
] as const

const RETENTION = [
  'Kimlik ve iletişim bilgileri (ad, e-posta): İş akdi sona ermesinden itibaren 10 yıl (BK md. 146)',
  'Video izleme kayıtları ve sertifikalar: 5 yıl',
  'IP adresi ve audit loglar: 2 yıl',
] as const

const RIGHTS = [
  'Kişisel verilerinizin işlenip işlenmediğini öğrenme',
  'Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme',
  'Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme',
  'Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme',
  'Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme',
  'KVKK\'nın 7. maddesi kapsamında kişisel verilerinizin silinmesini veya yok edilmesini isteme',
  'İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme',
] as const

export default function KVKKPage() {
  return (
    <LegalPage breadcrumbPath="/kvkk"
      title="KVKK Aydınlatma Metni"
      lead="Kişisel Verilerin Korunması Kanunu kapsamında veri işleme faaliyetlerimize ilişkin aydınlatma metni."
      updated="Temmuz 2026"
      sections={SECTIONS}
    >
      <h2 id={S.sorumlu.id}>{S.sorumlu.label}</h2>
      <p>
        Bu platformu işleten Ekrem Yılmaz (&quot;KlinoVax&quot; veya &quot;Veri Sorumlusu&quot;), 6698 sayılı Kişisel
        Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri sorumlusu sıfatıyla kişisel verilerinizi bu
        metinde açıklanan amaçlarla ve kanuna uygun olarak işlemektedir.
      </p>

      <h2 id={S.isleyen.id}>{S.isleyen.label}</h2>
      <p>
        KlinoVax, hizmet verdiği sağlık kuruluşlarının personeline ait verileri, ilgili kuruluşun talimatı
        doğrultusunda ve onun adına &quot;veri işleyen&quot; sıfatıyla işler; bu veriler bakımından &quot;veri
        sorumlusu&quot; ilgili sağlık kuruluşudur. KlinoVax bu verileri, kuruluşla yapılan veri işleme
        sözleşmesinde belirlenen amaçların dışında kullanmaz.
      </p>

      <h2 id={S.amac.id}>{S.amac.label}</h2>
      <p>
        Kişisel verileriniz; personel eğitim süreçlerinin yönetilmesi, sınav ve değerlendirme faaliyetlerinin
        gerçekleştirilmesi, eğitim performansının raporlanması, yasal yükümlülüklerin yerine getirilmesi,
        sertifika düzenlenmesi, bilgi güvenliği süreçlerinin yürütülmesi ve iletişim faaliyetlerinin yönetilmesi
        amaçlarıyla işlenmektedir.
      </p>

      <h2 id={S.sebepler.id}>{S.sebepler.label}</h2>
      <p>Kişisel verileriniz aşağıdaki hukuki sebeplere dayanılarak işlenmektedir (KVKK md. 5/2):</p>
      <ul>
        {LEGAL_BASES.map((b) => (
          <li key={b.ref}>
            <strong>{b.ref}</strong>
            <br />
            {b.text}
          </li>
        ))}
      </ul>

      <h2 id={S.veriler.id}>{S.veriler.label}</h2>
      <ul>
        {PROCESSED_DATA.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 id={S.aktarim.id}>{S.aktarim.label}</h2>
      <p>
        Kişisel verileriniz, hizmetin sunulabilmesi için yurt içi ve yurt dışı bulut/altyapı ve yazılım hizmeti
        sağlayıcıları ile yalnızca ilgili amaçla sınırlı olarak, KVKK m.8 ve m.9 kapsamında gerekli teknik ve
        idari tedbirler alınarak paylaşılabilir.
      </p>
      <p>
        Yurt dışına veri aktarımı yalnızca KVKK m.9&apos;da öngörülen şartların (Kurulca ilan edilen yeterli
        korumaya sahip ülkelere aktarım, standart sözleşme, taahhütname veya açık rıza) sağlanması hâlinde
        gerçekleştirilir.
      </p>

      <h2 id={S.saklama.id}>{S.saklama.label}</h2>
      <p>Kişisel verileriniz aşağıdaki süreler boyunca saklanır:</p>
      <ul>
        {RETENTION.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Saklama süresinin dolması veya işleme amacının ortadan kalkması halinde veriler silinir ya da anonim
        hale getirilir.
      </p>

      <h2 id={S.haklar.id}>{S.haklar.label}</h2>
      <p>KVKK&apos;nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
      <ul>
        {RIGHTS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 id={S.basvuru.id}>{S.basvuru.label}</h2>
      <p>
        KVKK kapsamındaki haklarınızı kullanmak için aşağıdaki kanaldan başvurabilirsiniz. Başvurularınız en
        geç 30 (otuz) gün içinde sonuçlandırılır.
      </p>
      <p>
        E-posta: <a href={`mailto:${KVKK_EMAIL}`}>{KVKK_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
