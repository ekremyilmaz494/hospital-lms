import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Kullanım Şartları | ${BRAND.fullName}`,
  description: `${BRAND.fullName} platformu kullanım şartları ve koşulları.`,
};

const LAST_UPDATED = "Temmuz 2026";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 pb-16 pt-4 lg:pt-8">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        Kullanım Şartları
      </h1>
      <p
        className="text-sm mb-10"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Son güncelleme: {LAST_UPDATED}
      </p>

      <div className="space-y-10 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        {/* 1. Hizmet Tanımı */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            1. Hizmet Tanımı
          </h2>
          <p>
            {BRAND.fullName} (&quot;Platform&quot;), kurumlar bünyesinde çalışan personelin
            mesleki eğitim, sınav ve sertifikasyon süreçlerini dijital ortamda yönetmek
            amacıyla sunulan bir bulut tabanlı öğrenme yönetim sistemidir. Platform,
            eğitim içeriklerinin oluşturulması, atanması, takip edilmesi ve raporlanması
            hizmetlerini kapsar.
          </p>
        </section>

        {/* 2. Kullanıcı Yükümlülükleri */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            2. Kullanıcı Yükümlülükleri
          </h2>
          <ul className="list-disc pl-6 space-y-2">
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
              açıkları üzerinden haksız avantaj elde etmeye çalışmak disiplin işlemi
              gerektirir.
            </li>
          </ul>
        </section>

        {/* 3. Fikri Mülkiyet */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            3. Fikri Mülkiyet
          </h2>
          <p>
            Platform üzerindeki tüm yazılım, tasarım, logo, içerik ve eğitim materyalleri
            {BRAND.fullName} ve/veya ilgili içerik sağlayıcılarının fikri mülkiyetindedir.
            Bu materyaller, önceden yazılı izin alınmaksızın kopyalanamaz, dağıtılamaz,
            değiştirilemez veya ticari amaçla kullanılamaz. Kullanıcılar tarafından platforma
            yüklenen içerikler üzerindeki haklar, ilgili organizasyona aittir.
          </p>
        </section>

        {/* 4. Veri Güvenliği */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            4. Veri Güvenliği
          </h2>
          <p>
            Platform, kullanıcı verilerinin korunması için endüstri standartlarında
            güvenlik önlemleri uygular. Veriler şifrelenmiş bağlantı (TLS/SSL) üzerinden
            iletilir ve sunucularda şifrelenmiş olarak saklanır. Detaylı bilgi için{" "}
            <a href="/privacy" className="underline" style={{ color: "#0d9668" }}>
              Gizlilik Politikamızı
            </a>{" "}
            inceleyebilirsiniz.
          </p>
        </section>

        {/* 5. Hizmet Seviyesi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            5. Hizmet Seviyesi
          </h2>
          <p>
            {BRAND.fullName}, aylık %99,5 erişim oranı hedeflemektedir. Planlı bakım
            çalışmaları, en az 48 saat önceden kullanıcılara bildirilir. Mücbir sebepler
            (doğal afet, siber saldırı, altyapı sağlayıcı kaynaklı kesintiler vb.)
            nedeniyle oluşan hizmet kesintilerinden {BRAND.fullName} sorumlu tutulamaz.
          </p>
        </section>

        {/* 6. Fesih Koşulları */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            6. Fesih Koşulları
          </h2>
          <ul className="list-disc pl-6 space-y-2">
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
        </section>

        {/* 7. Sorumluluk Sınırlaması */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            7. Sorumluluk Sınırlaması
          </h2>
          <p>
            {BRAND.fullName}, platformun kullanımından kaynaklanan dolaylı, özel, arızi veya
            cezai zararlardan sorumlu değildir. {BRAND.fullName}&apos;in toplam sorumluluğu,
            her halükârda ilgili organizasyonun son 12 ayda ödediği abonelik bedelini
            aşamaz. Platform üzerinden sunulan eğitim içerikleri bilgilendirme amaçlı olup,
            tıbbi tavsiye niteliğinde değildir.
          </p>
        </section>

        {/* 8. Uyuşmazlık Çözümü */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            8. Uyuşmazlık Çözümü
          </h2>
          <p>
            Bu kullanım şartlarından doğan uyuşmazlıklarda Türkiye Cumhuriyeti kanunları
            uygulanır. Taraflar, öncelikle uzlaşma yoluyla çözüm aramayı kabul eder.
            Uzlaşma sağlanamadığı takdirde Konya Mahkemeleri ve İcra Daireleri yetkilidir.
          </p>
        </section>

        {/* 9. Değişiklik Hakkı */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            9. Değişiklik Hakkı
          </h2>
          <p>
            {BRAND.fullName}, bu kullanım şartlarını önceden bildirimde bulunarak değiştirme
            hakkını saklı tutar. Önemli değişiklikler, yürürlüğe girmesinden en az 15 gün
            önce platform üzerinden ve/veya e-posta yoluyla kullanıcılara bildirilir.
            Değişikliklerin yürürlüğe girmesinden sonra platformu kullanmaya devam etmeniz,
            güncellenmiş şartları kabul ettiğiniz anlamına gelir.
          </p>
        </section>

        {/* İletişim */}
        <section
          className="rounded-2xl p-6"
          style={{ backgroundColor: "var(--color-surface-alt, #f8fafc)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            İletişim
          </h2>
          <p>
            Bu kullanım şartları hakkında sorularınız için bizimle iletişime geçebilirsiniz:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>E-posta:</strong> {BRAND.supportEmail}
            </li>
            <li>
              <strong>Telefon:</strong> 0553 953 06 96
            </li>
            <li>
              <strong>Adres:</strong> Buhara Mah. Barış Cad. Damlakent Sitesi No: 77/6, Selçuklu / Konya
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
