import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanim Sartlari | Devakent Hastanesi",
  description: "Devakent Hastanesi platformu kullanim sartlari ve kosullari.",
};

const LAST_UPDATED = "5 Nisan 2026";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        Kullanim Sartlari
      </h1>
      <p
        className="text-sm mb-10"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Son guncelleme: {LAST_UPDATED}
      </p>

      <div className="space-y-10 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        {/* 1. Hizmet Tanimi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            1. Hizmet Tanimi
          </h2>
          <p>
            Devakent Hastanesi (&quot;Platform&quot;), saglik kuruluslari bunyesinde calisan personelin
            mesleki egitim, sinav ve sertifikasyon sureclerini dijital ortamda yonetmek
            amaciyla sunulan bir bulut tabanli ogrenme yonetim sistemidir. Platform,
            egitim iceriklerinin olusturulmasi, atanmasi, takip edilmesi ve raporlanmasi
            hizmetlerini kapsar.
          </p>
        </section>

        {/* 2. Kullanici Yukumlulukleri */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            2. Kullanici Yukumlulukleri
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Kullanici, platforma erisim icin kendisine tanimlanan hesap bilgilerini
              gizli tutmakla yukumludur. Hesap bilgilerinin ucuncu kisilerle
              paylasilmasindan dogan tum sorumluluk kullaniciya aittir.
            </li>
            <li>
              Platform uzerindeki egitim iceriklerine yalnizca atandigi kapsam dahilinde
              erisim saglanabilir. Yetkisiz erisim girisimleri tespit edildiginde hesap
              askiya alinabilir.
            </li>
            <li>
              Kullanici, platformu yalnizca mesleki egitim ve gelisim amaciyla kullanmayi
              kabul eder. Platformun kotuye kullanimi, yasadisi icerik paylasimi veya
              sistem butunlugunu tehdit eden davranislar kesinlikle yasaktir.
            </li>
            <li>
              Sinav sureclerinde kopya cekmek, baskalari adina sinava girmek veya sistem
              acikliklari uzerinden haksiz avantaj elde etmeye calismak disiplin islemi
              gerektirir.
            </li>
          </ul>
        </section>

        {/* 3. Fikri Mulkiyet */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            3. Fikri Mulkiyet
          </h2>
          <p>
            Platform uzerindeki tum yazilim, tasarim, logo, icerik ve egitim materyalleri
            Devakent Hastanesi ve/veya ilgili icerik saglayicilarinin fikri mulkiyetindedir.
            Bu materyaller, onceden yazili izin alinmaksizin kopyalanamaz, dagitilmaz,
            degistirilemez veya ticari amacla kullanilamaz. Kullanicilar tarafindan platforma
            yuklenen icerikler uzerindeki haklar, ilgili organizasyona aittir.
          </p>
        </section>

        {/* 4. Veri Guvenligi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            4. Veri Guvenligi
          </h2>
          <p>
            Platform, kullanici verilerinin korunmasi icin endüstri standartlarinda
            guvenlik onlemleri uygular. Veriler sifrelenmis baglanti (TLS/SSL) uzerinden
            iletilir ve sunucularda sifrelenmis olarak saklanir. Detayli bilgi icin{" "}
            <a href="/privacy" className="underline" style={{ color: "#0d9668" }}>
              Gizlilik Politikamizi
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
            Devakent Hastanesi, aylik %99,5 erisim orani hedeflemektedir. Planli bakim
            calismalari, en az 48 saat onceden kullanicilara bildirilir. Mucbir sebepler
            (dogal afet, siber saldiri, altyapi saglayici kaynakli kesintiler vb.)
            nedeniyle olusan hizmet kesintilerinden Devakent Hastanesi sorumlu tutulamaz.
          </p>
        </section>

        {/* 6. Fesih Kosullari */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            6. Fesih Kosullari
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Organizasyonlar, abonelik doneminin sonunda sozlesmeyi feshedebilir.
              Fesih bildirimi en az 30 gun onceden yazili olarak yapilmalidir.
            </li>
            <li>
              Kullanim sartlarinin ihlali halinde, Devakent Hastanesi ilgili hesabi veya
              organizasyonu onceden bildirimde bulunmaksizin askiya alma veya feshetme
              hakkini sakli tutar.
            </li>
            <li>
              Fesih durumunda organizasyona ait veriler, talep uzerine 30 gun icerisinde
              disa aktarilabilir formatta teslim edilir. Bu surenin ardından veriler
              kalici olarak silinir.
            </li>
          </ul>
        </section>

        {/* 7. Sorumluluk Sinirlamasi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            7. Sorumluluk Sinirlamasi
          </h2>
          <p>
            Devakent Hastanesi, platformun kullanimindan kaynaklanan dolayli, ozel, arizi veya
            cezai zararlardan sorumlu degildir. Devakent Hastanesi&apos;in toplam sorumlulugu,
            her halukarda ilgili organizasyonun son 12 ayda odedigi abonelik bedelini
            asamaz. Platform uzerinden sunulan egitim icerikleri bilgilendirme amacli olup,
            tibbi tavsiye niteliginde degildir.
          </p>
        </section>

        {/* 8. Uyusmazlik Cozumu */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            8. Uyusmazlik Cozumu
          </h2>
          <p>
            Bu kullanim sartlarindan dogan uyusmazliklarda Turkiye Cumhuriyeti kanunlari
            uygulanir. Taraflar, oncelikle uzlasma yoluyla cozum aramayi kabul eder.
            Uzlasma saglanamadigi takdirde Ankara Mahkemeleri ve Icra Daireleri yetkilidir.
          </p>
        </section>

        {/* 9. Degisiklik Hakki */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            9. Degisiklik Hakki
          </h2>
          <p>
            Devakent Hastanesi, bu kullanim sartlarini onceden bildirimde bulunarak degistirme
            hakkini sakli tutar. Onemli degisiklikler, yururluge girmesinden en az 15 gun
            once platform uzerinden ve/veya e-posta yoluyla kullanicilara bildirilir.
            Degisikliklerin yururluge girmesinden sonra platformu kullanmaya devam etmeniz,
            guncellenmis sartlari kabul ettiginiz anlamina gelir.
          </p>
        </section>

        {/* Iletisim */}
        <section
          className="rounded-2xl p-6"
          style={{ backgroundColor: "var(--color-surface-alt, #f8fafc)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            Iletisim
          </h2>
          <p>
            Bu kullanim sartlari hakkinda sorulariniz icin bizimle iletisime gecebilirsiniz:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>E-posta:</strong> destek@hastane-lms.com
            </li>
            <li>
              <strong>Telefon:</strong> +90 850 000 0000
            </li>
            <li>
              <strong>Adres:</strong> Ankara, Turkiye
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
