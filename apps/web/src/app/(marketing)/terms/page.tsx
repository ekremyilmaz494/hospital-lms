import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = pageMetadata({
  title: 'Kullanım Şartları',
  description:
    'KlinoVax personel eğitim platformunun kurumlar ve kullanıcılar için kullanım şartları ve koşulları.',
  path: '/terms',
});

const LAST_UPDATED = "Temmuz 2026";

// Bölüm başlıkları hem `<h2>` hem içindekiler için tek kaynaktır.
const S = {
  hizmet: { id: "hizmet-tanimi", label: "1. Hizmet Tanımı" },
  yukumlulukler: { id: "kullanici-yukumlulukleri", label: "2. Kullanıcı Yükümlülükleri" },
  fikriMulkiyet: { id: "fikri-mulkiyet", label: "3. Fikri Mülkiyet" },
  guvenlik: { id: "veri-guvenligi", label: "4. Veri Güvenliği" },
  seviye: { id: "hizmet-seviyesi", label: "5. Hizmet Seviyesi" },
  fesih: { id: "fesih-kosullari", label: "6. Fesih Koşulları" },
  sorumluluk: { id: "sorumluluk-sinirlamasi", label: "7. Sorumluluk Sınırlaması" },
  uyusmazlik: { id: "uyusmazlik-cozumu", label: "8. Uyuşmazlık Çözümü" },
  degisiklik: { id: "degisiklik-hakki", label: "9. Değişiklik Hakkı" },
  iletisim: { id: "iletisim", label: "İletişim" },
} as const;

const SECTIONS = Object.values(S);

export default function TermsPage() {
  return (
    <LegalPage breadcrumbPath="/terms" title="Kullanım Şartları" updated={LAST_UPDATED} sections={SECTIONS}>
      <h2 id={S.hizmet.id}>{S.hizmet.label}</h2>
      <p>
        {BRAND.fullName} (&quot;Platform&quot;), kurumlar bünyesinde çalışan personelin
        mesleki eğitim, sınav ve sertifikasyon süreçlerini dijital ortamda yönetmek
        amacıyla sunulan bir bulut tabanlı öğrenme yönetim sistemidir. Platform,
        eğitim içeriklerinin oluşturulması, atanması, takip edilmesi ve raporlanması
        hizmetlerini kapsar.
      </p>

      <h2 id={S.yukumlulukler.id}>{S.yukumlulukler.label}</h2>
      <ul>
        <li>
          Kullanıcı, platforma erişim için kendisine tanımlanan hesap bilgilerini
          gizli tutmakla yükümlüdür. Hesap bilgilerinin üçüncü kişilerle
          paylaşılmasından doğan tüm sorumluluk kullanıcıya aittir.
        </li>
        <li>
          Platform üzerindeki eğitim içeriklerine yalnızca atandığı kapsam dahilinde
          erişim sağlanabilir. Yetkisiz erişim girişimleri tespit edildiğinde hesap
          askıya alınabilir.
        </li>
        <li>
          Kullanıcı, platformu yalnızca mesleki eğitim ve gelişim amacıyla kullanmayı
          kabul eder. Platformun kötüye kullanımı, yasadışı içerik paylaşımı veya
          sistem bütünlüğünü tehdit eden davranışlar kesinlikle yasaktır.
        </li>
        <li>
          Sınav süreçlerinde kopya çekmek, başkaları adına sınava girmek veya sistem
          açıklıkları üzerinden haksız avantaj elde etmeye çalışmak disiplin işlemi
          gerektirir.
        </li>
      </ul>

      <h2 id={S.fikriMulkiyet.id}>{S.fikriMulkiyet.label}</h2>
      <p>
        Platform üzerindeki tüm yazılım, tasarım, logo, içerik ve eğitim materyalleri{" "}
        {BRAND.fullName} ve/veya ilgili içerik sağlayıcılarının fikri mülkiyetindedir.
        Bu materyaller, önceden yazılı izin alınmaksızın kopyalanamaz, dağıtılmaz,
        değiştirilemez veya ticari amaçla kullanılamaz. Kullanıcılar tarafından platforma
        yüklenen içerikler üzerindeki haklar, ilgili organizasyona aittir.
      </p>

      <h2 id={S.guvenlik.id}>{S.guvenlik.label}</h2>
      <p>
        Platform, kullanıcı verilerinin korunması için endüstri standartlarında
        güvenlik önlemleri uygular. Veriler şifrelenmiş bağlantı (TLS/SSL) üzerinden
        iletilir ve sunucularda şifrelenmiş olarak saklanır. Detaylı bilgi için{" "}
        <Link href="/privacy">Gizlilik Politikamızı</Link> inceleyebilirsiniz.
      </p>

      <h2 id={S.seviye.id}>{S.seviye.label}</h2>
      <p>
        {BRAND.fullName}, aylık %99,5 erişim oranı hedeflemektedir. Planlı bakım
        çalışmaları, en az 48 saat önceden kullanıcılara bildirilir. Mücbir sebepler
        (doğal afet, siber saldırı, altyapı sağlayıcı kaynaklı kesintiler vb.)
        nedeniyle oluşan hizmet kesintilerinden {BRAND.fullName} sorumlu tutulamaz.
      </p>

      <h2 id={S.fesih.id}>{S.fesih.label}</h2>
      <ul>
        <li>
          Organizasyonlar, abonelik döneminin sonunda sözleşmeyi feshedebilir.
          Fesih bildirimi en az 30 gün önceden yazılı olarak yapılmalıdır.
        </li>
        <li>
          Kullanım şartlarının ihlali halinde, {BRAND.fullName} ilgili hesabı veya
          organizasyonu önceden bildirimde bulunmaksızın askıya alma veya feshetme
          hakkını saklı tutar.
        </li>
        <li>
          Fesih durumunda organizasyona ait veriler, talep üzerine 30 gün içerisinde
          dışa aktarılabilir formatta teslim edilir. Bu sürenin ardından veriler
          kalıcı olarak silinir.
        </li>
      </ul>

      <h2 id={S.sorumluluk.id}>{S.sorumluluk.label}</h2>
      <p>
        {BRAND.fullName}, platformun kullanımından kaynaklanan dolaylı, özel, arızi veya
        cezai zararlardan sorumlu değildir. {BRAND.fullName}&apos;in toplam sorumluluğu,
        her halükarda ilgili organizasyonun son 12 ayda ödediği abonelik bedelini
        aşamaz. Platform üzerinden sunulan eğitim içerikleri bilgilendirme amaçlı olup,
        tıbbi tavsiye niteliğinde değildir.
      </p>

      <h2 id={S.uyusmazlik.id}>{S.uyusmazlik.label}</h2>
      <p>
        Bu kullanım şartlarından doğan uyuşmazlıklarda Türkiye Cumhuriyeti kanunları
        uygulanır. Taraflar, öncelikle uzlaşma yoluyla çözüm aramayı kabul eder.
        Uzlaşma sağlanamadığı takdirde Konya Mahkemeleri ve İcra Daireleri yetkilidir.
      </p>

      <h2 id={S.degisiklik.id}>{S.degisiklik.label}</h2>
      <p>
        {BRAND.fullName}, bu kullanım şartlarını önceden bildirimde bulunarak değiştirme
        hakkını saklı tutar. Önemli değişiklikler, yürürlüğe girmesinden en az 15 gün
        önce platform üzerinden ve/veya e-posta yoluyla kullanıcılara bildirilir.
        Değişikliklerin yürürlüğe girmesinden sonra platformu kullanmaya devam etmeniz,
        güncellenmiş şartları kabul ettiğiniz anlamına gelir.
      </p>

      <h2 id={S.iletisim.id}>{S.iletisim.label}</h2>
      <p>
        Bu kullanım şartları hakkında sorularınız için bizimle iletişime geçebilirsiniz:
      </p>
      <ul>
        <li>
          <strong>E-posta:</strong> {BRAND.supportEmail}
        </li>
        <li>
          <strong>Telefon:</strong> 0553 953 06 96
        </li>
        <li>
          <strong>Adres:</strong> Konya, Türkiye
        </li>
      </ul>
    </LegalPage>
  );
}
