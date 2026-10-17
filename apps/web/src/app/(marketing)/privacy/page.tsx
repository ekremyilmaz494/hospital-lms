import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = pageMetadata({
  title: 'Gizlilik Politikası',
  description:
    'KlinoVax web sitesi ve mobil uygulamasında kişisel verilerin nasıl işlendiği, saklandığı ve korunduğu hakkında bilgilendirme.',
  path: '/privacy',
});

// KVKK / yasal başvuru e-postası (veri sorumlusu irtibat kutusu).
const CONTACT_EMAIL = "ekrem@klinovax.com";
// Genel teknik destek kutusu.
const SUPPORT_EMAIL = "ekrem@klinovax.com";

const LAST_UPDATED = "Temmuz 2026";

// Veri sorumlusu: gerçek kişi (şirket tüzel kişiliği yok).
const LEGAL_ENTITY = "Ekrem Yılmaz";
const LEGAL_ADDRESS = "Konya, Türkiye";
const VERBIS_NUMBER = "Başvuru sürecinde";

// Bölüm başlıkları hem `<h2>` hem içindekiler için tek kaynaktır.
const S = {
  veriSorumlusu: { id: "veri-sorumlusu", label: "1. Veri Sorumlusu" },
  amac: { id: "uygulamanin-amaci", label: "2. Uygulamanın Amacı" },
  toplananVeriler: { id: "toplanan-veriler", label: "3. Topladığımız Kişisel Veriler" },
  mobilAciklama: {
    id: "mobil-veri-aciklamasi",
    label: "4. Mobil Uygulama Veri Açıklaması (App Store & Google Play)",
  },
  islemeAmaclari: { id: "isleme-amaclari", label: "5. Kişisel Verilerin İşleme Amaçları" },
  hukukiDayanak: { id: "hukuki-dayanaklar", label: "6. Kişisel Veri İşlemenin Hukuki Dayanakları" },
  aktarim: { id: "veri-aktarimi", label: "7. Kişisel Verilerin Aktarımı" },
  saklama: { id: "saklama-sureleri", label: "8. Veri Saklama Süreleri" },
  haklar: { id: "haklariniz", label: "9. KVKK Kapsamındaki Haklarınız (Madde 11)" },
  silme: { id: "hesap-ve-veri-silme", label: "10. Hesap ve Veri Silme Talebi" },
  guvenlik: { id: "veri-guvenligi", label: "11. Veri Güvenliği" },
  cocuklar: { id: "cocuklarin-gizliligi", label: "12. Çocukların Gizliliği" },
  cerez: { id: "cerez-politikasi", label: "13. Çerez Politikası" },
  verbis: { id: "verbis", label: "14. VERBIS Kayıt Bilgileri" },
  degisiklikler: { id: "degisiklikler", label: "15. Değişiklikler" },
  iletisim: { id: "iletisim", label: "16. İletişim" },
} as const;

const SECTIONS = Object.values(S);

const DATA_TABLE_HEAD = ["Veri türü", "Kullanım amacı", "Kimliğe bağlı mı?", "Takip için mi?"] as const;

const DATA_TABLE_ROWS = [
  ["Ad (Name)", "Uygulama işlevselliği", "Evet", "Hayır"],
  ["E-posta adresi", "Uygulama işlevselliği (kimlik doğrulama)", "Evet", "Hayır"],
  ["Kullanıcı kimliği (User ID)", "Uygulama işlevselliği", "Evet", "Hayır"],
  ["Cihaz kimliği (Device ID)", "Uygulama işlevselliği (push bildirim)", "Evet", "Hayır"],
  ["Ürün etkileşimi (Product Interaction)", "Uygulama işlevselliği (eğitim takibi)", "Evet", "Hayır"],
  ["Çökme verisi (Crash Data)", "Uygulama işlevselliği", "Hayır", "Hayır"],
  ["Performans verisi (Performance Data)", "Uygulama işlevselliği", "Hayır", "Hayır"],
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage breadcrumbPath="/privacy"
      title="Gizlilik Politikası"
      updated={`${LAST_UPDATED} · Yürürlük tarihi: ${LAST_UPDATED}`}
      lead={
        <>
          Bu gizlilik politikası, <strong>{BRAND.name}</strong> mobil uygulaması (iOS ve Android) ile
          web platformu üzerinden işlenen kişisel verilere ilişkindir. 6698 sayılı Kişisel Verilerin
          Korunması Kanunu (&quot;KVKK&quot;), Apple App Store ve Google Play Store veri açıklama
          gereksinimleriyle uyumlu olacak şekilde hazırlanmıştır.
        </>
      }
      sections={SECTIONS}
    >
      <h2 id={S.veriSorumlusu.id}>{S.veriSorumlusu.label}</h2>
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri
        sorumlusu sıfatıyla hareket eden taraf:
      </p>
      <ul>
        <li>
          <strong>Veri Sorumlusu:</strong> {LEGAL_ENTITY} (gerçek kişi)
        </li>
        <li>
          <strong>Adres:</strong> {LEGAL_ADDRESS}
        </li>
        <li>
          <strong>E-posta:</strong> {CONTACT_EMAIL}
        </li>
        <li>
          <strong>Genel destek:</strong> {SUPPORT_EMAIL}
        </li>
        <li>
          <strong>Telefon:</strong> {BRAND.contact.phone}
        </li>
      </ul>

      <h2 id={S.amac.id}>{S.amac.label}</h2>
      <p>
        {BRAND.name}, hastane ve sağlık kuruluşlarında çalışan personelin (hekim, hemşire,
        teknisyen vb.) zorunlu mesleki eğitim, video izleme, sınav (ön ve son test) ve
        sertifikasyon süreçlerini dijital ortamda yöneten bir öğrenme yönetim sistemidir.
        Uygulama yalnızca yetkili kurum personeli tarafından, kurumları tarafından atanan
        eğitimler kapsamında kullanılır.
      </p>

      <h2 id={S.toplananVeriler.id}>{S.toplananVeriler.label}</h2>
      <p>Platform üzerinde aşağıdaki kişisel veri kategorileri işlenmektedir:</p>
      <ul>
        <li>
          <strong>Kimlik Bilgileri:</strong> Ad, soyad, T.C. kimlik numarası, unvan, departman
          bilgisi
        </li>
        <li>
          <strong>İletişim Bilgileri:</strong> E-posta adresi, telefon numarası
        </li>
        <li>
          <strong>Mesleki Bilgiler:</strong> Görev tanımı, çalışan numarası (HBYS/HIS
          entegrasyonu), sertifika ve yetkinlik bilgileri
        </li>
        <li>
          <strong>Eğitim ve Sınav Verileri:</strong> Eğitim tamamlama durumları, sınav
          sonuçları, video ilerleme kayıtları, sertifika bilgileri
        </li>
        <li>
          <strong>Erişim ve Kullanım Verileri:</strong> Oturum açma zamanları, IP adresi, cihaz
          ve tarayıcı bilgisi, uygulama içi etkinlik kayıtları
        </li>
        <li>
          <strong>Cihaz Tanımlayıcısı:</strong> Anlık (push) bildirim gönderebilmek için cihaz
          bildirim jetonu (push token)
        </li>
        <li>
          <strong>Teşhis Verileri:</strong> Uygulama çökme kayıtları ve performans verileri
          (kararlı çalışmayı sağlamak için)
        </li>
        <li>
          <strong>Görsel Veriler:</strong> Profil fotoğrafı (isteğe bağlı)
        </li>
      </ul>
      <div className="s-callout">
        {BRAND.name}, kullanıcılarının verilerini <strong>reklam</strong> amacıyla toplamaz,{" "}
        <strong>satmaz</strong> ve reklam ağlarıyla paylaşmaz. Uygulamada üçüncü taraf reklam
        veya çapraz uygulama/internet sitesi <strong>takibi (tracking) yoktur</strong>.
      </div>

      <h2 id={S.mobilAciklama.id}>{S.mobilAciklama.label}</h2>
      <p>
        Apple App Store &quot;App Privacy&quot; ve Google Play &quot;Data Safety&quot;
        beyanlarımız aşağıdaki tabloyla birebir uyumludur. Toplanan tüm veriler yalnızca{" "}
        <strong>uygulama işlevselliği</strong> için kullanılır; hiçbiri kullanıcı takibi
        (tracking) için kullanılmaz.
      </p>
      <div className="s-table-wrap">
        <table>
          <thead>
            <tr>
              {DATA_TABLE_HEAD.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA_TABLE_ROWS.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id={S.islemeAmaclari.id}>{S.islemeAmaclari.label}</h2>
      <ul>
        <li>Platform hizmetlerinin sunulması ve iyileştirilmesi</li>
        <li>Kullanıcı kimlik doğrulama ve yetkilendirme işlemleri</li>
        <li>Eğitim atama, takip ve raporlama süreçlerinin yürütülmesi</li>
        <li>Sınav uygulama, değerlendirme ve sertifikasyon işlemleri</li>
        <li>Zorunlu eğitim hatırlatmaları için anlık (push) bildirim gönderilmesi</li>
        <li>Yasal yükümlülüklerin yerine getirilmesi (sağlık personeli eğitim kayıtları)</li>
        <li>Platform güvenliğinin sağlanması ve kötüye kullanımının önlenmesi</li>
        <li>Uygulama kararlılığının sağlanması (çökme/performans teşhisi)</li>
      </ul>

      <h2 id={S.hukukiDayanak.id}>{S.hukukiDayanak.label}</h2>
      <p>
        Kişisel verileriniz, KVKK&apos;nin 5. ve 6. maddelerinde belirtilen aşağıdaki hukuki
        dayanaklara istinaden işlenmektedir:
      </p>
      <ul>
        <li>
          <strong>Sözleşmenin ifası (m.5/2-c):</strong> Platform hizmetlerinin sunulması için
          gerekli veri işleme faaliyetleri
        </li>
        <li>
          <strong>Hukuki yükümlülük (m.5/2-ç):</strong> Sağlık mevzuatı gereği personel eğitim
          kayıtlarının tutulması
        </li>
        <li>
          <strong>Meşru menfaat (m.5/2-f):</strong> Platform güvenliğinin sağlanması, hizmet
          kalitesinin arttırılması
        </li>
        <li>
          <strong>Açık rıza (m.5/1):</strong> Zorunlu olmayan veri işleme faaliyetleri (varsa)
        </li>
      </ul>

      <h2 id={S.aktarim.id}>{S.aktarim.label}</h2>
      <p>Kişisel verileriniz aşağıdaki durumlarda üçüncü taraflarla paylaşılabilir:</p>
      <ul>
        <li>
          <strong>Altyapı ve Hizmet Sağlayıcıları:</strong> Sunucu barındırma, kimlik
          doğrulama, veritabanı, dosya/video depolama, içerik dağıtımı (CDN) ve anlık bildirim
          iletimi gibi hizmetlerin yürütülmesi amacıyla; yurt içi ve yurt dışı bulut/altyapı ve
          yazılım hizmeti sağlayıcıları ile, KVKK m.8 ve m.9 kapsamında gerekli teknik ve idari
          tedbirler alınarak çalışılmaktadır.
        </li>
        <li>
          <strong>Organizasyonunuz:</strong> Bağlı olduğunuz sağlık kuruluşunun yetkili
          yöneticileri, yetkileri dahilinde eğitim ve sınav verilerinize erişebilir.
        </li>
        <li>
          <strong>Yasal Zorunluluklar:</strong> Yetkili kamu kurum ve kuruluşlarına, mevzuatın
          gerektirdiği hallerde veri aktarımı yapılabilir.
        </li>
      </ul>
      <p>
        Kişisel verileriniz gerektiğinde yurt dışında bulunan hizmet sağlayıcılarının
        sunucuları aracılığıyla işlenebilir. Bu tür yurt dışı aktarımlar, KVKK&apos;nin 9.
        maddesinde öngörülen şartların (yeterli korumaya sahip ülke, standart sözleşme,
        taahhütname veya açık rıza) sağlanması halinde gerçekleştirilir. Veriler iletimde
        TLS/SSL ile şifrelenir.
      </p>

      <h2 id={S.saklama.id}>{S.saklama.label}</h2>
      <ul>
        <li>
          <strong>Hesap Bilgileri:</strong> Hesap aktif olduğu sürece ve hesap kapatıldıktan
          sonra 1 yıl
        </li>
        <li>
          <strong>Eğitim ve Sınav Kayıtları:</strong> Sağlık mevzuatı gereği en az 10 yıl (yasal
          zorunluluk)
        </li>
        <li>
          <strong>Sertifika Bilgileri:</strong> Geçerlilik süresi boyunca ve sonrasında 5 yıl
        </li>
        <li>
          <strong>Erişim Kayıtları (Log):</strong> 2 yıl
        </li>
        <li>
          <strong>Çökme/Performans Verileri:</strong> En fazla 90 gün
        </li>
        <li>
          <strong>Çerez Verileri:</strong> Oturum çerezleri tarayıcı kapatıldığında, kalıcı
          çerezler en fazla 1 yıl
        </li>
      </ul>
      <p>
        Saklama süresi dolan veriler, periyodik imha süreci kapsamında otomatik olarak silinir
        veya anonimleştirilir.
      </p>

      <h2 id={S.haklar.id}>{S.haklar.label}</h2>
      <p>KVKK&apos;nin 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
        <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
        <li>
          Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp
          kullanılmadığını öğrenme
        </li>
        <li>
          Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme
        </li>
        <li>
          Kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde bunların
          düzeltilmesini isteme
        </li>
        <li>
          KVKK&apos;nin 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin
          silinmesini veya yok edilmesini isteme
        </li>
        <li>
          Düzeltme ve silme işlemlerinin, kişisel verilerin aktarıldığı üçüncü kişilere
          bildirilmesini isteme
        </li>
        <li>
          İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle
          aleyhinize bir sonucun ortaya çıkmasına itiraz etme
        </li>
        <li>
          Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız
          halinde zararın giderilmesini talep etme
        </li>
      </ul>
      <p>
        Haklarınızı kullanmak için <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
        adresine yazılı başvuruda bulunabilir veya platform üzerindeki KVKK başvuru formunu
        kullanabilirsiniz. Başvurularınız en geç 30 gün içerisinde sonuçlandırılacaktır.
      </p>

      <h2 id={S.silme.id}>{S.silme.label}</h2>
      <p>
        Hesabınızın ve ilişkili kişisel verilerinizin silinmesini talep etmek için{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> adresine başvurabilir veya
        bağlı olduğunuz kurumun sistem yöneticisiyle iletişime geçebilirsiniz. Yasal saklama
        yükümlülüğüne tabi kayıtlar (örn. zorunlu eğitim kayıtları), ilgili mevzuatta öngörülen
        süre boyunca saklanmaya devam eder; bu süre sonunda silinir veya anonimleştirilir.
      </p>

      <h2 id={S.guvenlik.id}>{S.guvenlik.label}</h2>
      <p>
        Verileriniz, endüstri standardı teknik ve idari tedbirlerle korunur: iletimde TLS/SSL
        şifreleme, kimlik doğrulamada güvenli jeton saklama (iOS Keychain / Android Keystore
        tabanlı güvenli depolama), yetki bazlı erişim kontrolü ve düzenli denetim kayıtları.
      </p>

      <h2 id={S.cocuklar.id}>{S.cocuklar.label}</h2>
      <p>
        {BRAND.name} yalnızca yetişkin sağlık kuruluşu personeline yöneliktir; 18 yaş altı
        kişilerden bilerek kişisel veri toplanmaz.
      </p>

      <h2 id={S.cerez.id}>{S.cerez.label}</h2>
      <p>Platform aşağıdaki çerez türlerini kullanmaktadır:</p>
      <ul>
        <li>
          <strong>Zorunlu Çerezler:</strong> Oturum yönetimi, kimlik doğrulama ve güvenlik için
          gerekli çerezler. Bu çerezler olmadan platform işlevlerini yerine getiremez.
        </li>
        <li>
          <strong>İşlevsel Çerezler:</strong> Kullanıcı tercihlerinin (dil, tema seçimi)
          hatırlanması için kullanılır.
        </li>
        <li>
          <strong>Analitik Çerezler:</strong> Platform kullanımının iyileştirilmesi için
          anonimleştirilmiş istatistik verileri toplar.
        </li>
      </ul>
      <p>
        Tarayıcınızın çerez ayarlarını değiştirerek zorunlu olmayan çerezleri reddedebilirsiniz.
        Ancak bu durum, platformun bazı özelliklerinin düzgün çalışmamasına neden olabilir.
      </p>

      <h2 id={S.verbis.id}>{S.verbis.label}</h2>
      <p>
        6698 sayılı Kanun&apos;un 16. maddesi uyarınca veri sorumlusu olarak Veri Sorumluları
        Sicil Bilgi Sistemi&apos;ne (VERBIS) kayıt durumumuz:
      </p>
      <ul>
        <li>
          <strong>Veri Sorumlusu:</strong> {LEGAL_ENTITY}
        </li>
        <li>
          <strong>VERBIS Kayıt Numarası:</strong> {VERBIS_NUMBER}
        </li>
      </ul>
      <p>
        VERBIS kaydı hakkında detaylı bilgi için:{" "}
        <a href="https://verbis.kvkk.gov.tr" target="_blank" rel="noopener noreferrer">
          verbis.kvkk.gov.tr
        </a>
      </p>

      <h2 id={S.degisiklikler.id}>{S.degisiklikler.label}</h2>
      <p>
        Bu gizlilik politikası gerektiğinde güncellenebilir. Önemli değişiklikler uygulama
        ve/veya e-posta yoluyla bildirilir. Güncel sürüm her zaman bu sayfada yayımlanır.
      </p>

      <h2 id={S.iletisim.id}>{S.iletisim.label}</h2>
      <p>
        Gizlilik politikamız ve kişisel verilerinizin korunması hakkındaki tüm soru ve
        talepleriniz için:
      </p>
      <ul>
        <li>
          <strong>Veri Sorumlusu İrtibat:</strong> {CONTACT_EMAIL}
        </li>
        <li>
          <strong>Genel Destek:</strong> {SUPPORT_EMAIL}
        </li>
        <li>
          <strong>Telefon:</strong> {BRAND.contact.phone}
        </li>
        <li>
          <strong>Adres:</strong> {LEGAL_ADDRESS}
        </li>
      </ul>
    </LegalPage>
  );
}
