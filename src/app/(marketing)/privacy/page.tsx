import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikasi | Hastane LMS",
  description:
    "Hastane LMS gizlilik politikasi - KVKK uyumlu kisisel verilerin korunmasi.",
};

const LAST_UPDATED = "5 Nisan 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        Gizlilik Politikasi
      </h1>
      <p
        className="text-sm mb-10"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Son guncelleme: {LAST_UPDATED}
      </p>

      <div className="space-y-10 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        {/* 1. Veri Sorumlusu */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            1. Veri Sorumlusu
          </h2>
          <p>
            6698 sayili Kisisel Verilerin Korunmasi Kanunu (&quot;KVKK&quot;) kapsaminda
            veri sorumlusu sifatiyla hareket eden taraf:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>Unvan:</strong> Hastane LMS Yazilim Teknolojileri
            </li>
            <li>
              <strong>Adres:</strong> Ankara, Turkiye
            </li>
            <li>
              <strong>E-posta:</strong> kvkk@hastane-lms.com
            </li>
            <li>
              <strong>Telefon:</strong> +90 850 000 0000
            </li>
          </ul>
        </section>

        {/* 2. Toplanan Veriler */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            2. Toplanan Kisisel Veriler
          </h2>
          <p>Platform uzerinde asagidaki kisisel veri kategorileri islenmektedir:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Kimlik Bilgileri:</strong> Ad, soyad, T.C. kimlik numarasi,
              unvan, departman bilgisi
            </li>
            <li>
              <strong>Iletisim Bilgileri:</strong> E-posta adresi, telefon numarasi
            </li>
            <li>
              <strong>Mesleki Bilgiler:</strong> Gorev tanimi, calisan numarasi (HIS
              entegrasyonu), sertifika ve yetkinlik bilgileri
            </li>
            <li>
              <strong>Egitim ve Sinav Verileri:</strong> Egitim tamamlama durumlari,
              sinav sonuclari, video ilerleme kayitlari, sertifika bilgileri
            </li>
            <li>
              <strong>Erisim ve Kullanim Verileri:</strong> Oturum acma zamanlari, IP
              adresi, tarayici bilgisi, platformdaki etkinlik kayitlari
            </li>
            <li>
              <strong>Gorsel Veriler:</strong> Profil fotografi (istege bagli)
            </li>
          </ul>
        </section>

        {/* 3. Isleme Amaclari */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            3. Kisisel Verilerin Isleme Amaclari
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Platform hizmetlerinin sunulmasi ve iyilestirilmesi</li>
            <li>Kullanici kimlik dogrulama ve yetkilendirme islemleri</li>
            <li>Egitim atama, takip ve raporlama sureclerinin yurutulmesi</li>
            <li>Sinav uygulama, degerlendirme ve sertifikasyon islemleri</li>
            <li>Yasal yukumluluklerin yerine getirilmesi (saglik personeli egitim kayitlari)</li>
            <li>Platform guvenliginin saglanmasi ve kotuye kullaniminin onlenmesi</li>
            <li>Istatistiksel analiz ve raporlama (anonimlestirilmis verilerle)</li>
            <li>Kullaniciya yonelik bilgilendirme ve destek hizmetleri</li>
          </ul>
        </section>

        {/* 4. Hukuki Dayanak */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            4. Kisisel Veri Islemenin Hukuki Dayanaklari
          </h2>
          <p>
            Kisisel verileriniz, KVKK&apos;nin 5. ve 6. maddelerinde belirtilen asagidaki
            hukuki dayanaklara istinaden islenmektedir:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Sozlesmenin ifasi (m.5/2-c):</strong> Platform hizmetlerinin
              sunulmasi icin gerekli veri isleme faaliyetleri
            </li>
            <li>
              <strong>Hukuki yukumluluk (m.5/2-c):</strong> Saglik mevzuati geregi
              personel egitim kayitlarinin tutulmasi
            </li>
            <li>
              <strong>Mesru menfaat (m.5/2-f):</strong> Platform guvenliginin saglanmasi,
              hizmet kalitesinin arttirilmasi
            </li>
            <li>
              <strong>Acik riza (m.5/1):</strong> Zorunlu olmayan veri isleme
              faaliyetleri (ornegin pazarlama iletisimleri)
            </li>
          </ul>
        </section>

        {/* 5. Veri Aktarimi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            5. Kisisel Verilerin Aktarimi
          </h2>
          <p>Kisisel verileriniz asagidaki durumlarda ucuncu taraflarla paylasilabilir:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Altyapi Saglayicilari:</strong> Sunucu barindirma (Vercel, Supabase),
              dosya depolama (AWS), onbellek (Upstash Redis) hizmetleri icin teknik
              altyapi saglayicilariyla. Bu saglayicilar GDPR ve/veya esdeger veri
              koruma standartlarina uymaktadir.
            </li>
            <li>
              <strong>Organizasyonunuz:</strong> Bagli oldugunuz saglik kurulusu
              yoneticileri, yetkileri dahilinde egitim ve sinav verilerinize
              erisebilir.
            </li>
            <li>
              <strong>Yasal Zorunluluklar:</strong> Yetkili kamu kurum ve kuruluslarina,
              mevzuatin gerektirdigi hallerde veri aktarimi yapilabilir.
            </li>
          </ul>
          <p className="mt-3">
            Kisisel verileriniz yurt disindaki sunucularda islenmektedir. Bu aktarim,
            KVKK&apos;nin 9. maddesi kapsaminda yeterli koruma bulunan ulkelere veya
            yeterli korumayi taahhut eden veri isleyenlerine yapilmaktadir.
          </p>
        </section>

        {/* 6. Saklama Sureleri */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            6. Veri Saklama Sureleri
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Hesap Bilgileri:</strong> Hesap aktif oldugu surece ve hesap
              kapatildiktan sonra 1 yil
            </li>
            <li>
              <strong>Egitim ve Sinav Kayitlari:</strong> Saglik mevzuati geregi en az
              10 yil (yasal zorunluluk)
            </li>
            <li>
              <strong>Sertifika Bilgileri:</strong> Sertifikanin gecerlilik suresi
              boyunca ve sonrasinda 5 yil
            </li>
            <li>
              <strong>Erisim Kayitlari (Log):</strong> 2 yil
            </li>
            <li>
              <strong>Cerez Verileri:</strong> Oturum cerezleri tarayici
              kapatildiginda, kalici cerezler en fazla 1 yil
            </li>
          </ul>
          <p className="mt-3">
            Saklama suresi dolan veriler, periyodik imha sureci kapsaminda otomatik olarak
            silinir veya anonimlestirilir.
          </p>
        </section>

        {/* 7. KVKK Madde 11 Haklari */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            7. KVKK Kapsamindaki Haklariniz (Madde 11)
          </h2>
          <p>
            KVKK&apos;nin 11. maddesi uyarinca asagidaki haklara sahipsiniz:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Kisisel verilerinizin islenip islenmedigini ogrenme</li>
            <li>Kisisel verileriniz islenmisse buna iliskin bilgi talep etme</li>
            <li>
              Kisisel verilerinizin islenme amacini ve bunlarin amacina uygun kullanilip
              kullanilmadigini ogrenme
            </li>
            <li>
              Yurt icinde veya yurt disinda kisisel verilerinizin aktarildigi ucuncu
              kisileri bilme
            </li>
            <li>
              Kisisel verilerinizin eksik veya yanlis islenmis olmasi halinde bunlarin
              duzeltilmesini isteme
            </li>
            <li>
              KVKK&apos;nin 7. maddesinde ongornulen sartlar cercevesinde kisisel
              verilerinizin silinmesini veya yok edilmesini isteme
            </li>
            <li>
              Duzeltme ve silme islemlerinin, kisisel verilerin aktarildigi ucuncu
              kisilere bildirilmesini isteme
            </li>
            <li>
              Islenen verilerin munhasiran otomatik sistemler vasitasiyla analiz
              edilmesi suretiyle aleyhinize bir sonucun ortaya cikmasina itiraz etme
            </li>
            <li>
              Kisisel verilerinizin kanuna aykiri olarak islenmesi sebebiyle zarara
              ugramaniz halinde zararin giderilmesini talep etme
            </li>
          </ul>
          <p className="mt-3">
            Haklarinizi kullanmak icin{" "}
            <a href="mailto:kvkk@hastane-lms.com" className="underline" style={{ color: "#0d9668" }}>
              kvkk@hastane-lms.com
            </a>{" "}
            adresine yazili basvuruda bulunabilir veya platform uzerindeki KVKK basvuru
            formunu kullanabilirsiniz. Basvurulariniz en gec 30 gun icerisinde
            sonuclandirilacaktir.
          </p>
        </section>

        {/* 8. Cerez Politikasi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            8. Cerez Politikasi
          </h2>
          <p>Platform asagidaki cerez turlerini kullanmaktadir:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Zorunlu Cerezler:</strong> Oturum yonetimi, kimlik dogrulama ve
              guvenlik icin gerekli cerezler. Bu cerezler olmadan platform islevlerini
              yerine getiremez.
            </li>
            <li>
              <strong>Islevsel Cerezler:</strong> Kullanici tercihlerinin (dil, tema
              secimi) hatirlanmasi icin kullanilir.
            </li>
            <li>
              <strong>Analitik Cerezler:</strong> Platform kullaniminin
              iyilestirilmesi icin anonimlestirilmis istatistik verileri toplar.
            </li>
          </ul>
          <p className="mt-3">
            Tarayicinizin cerez ayarlarini degistirerek zorunlu olmayan cerezleri
            reddedebilirsiniz. Ancak bu durum, platformun bazi ozelliklerinin duzgun
            calismamasina neden olabilir.
          </p>
        </section>

        {/* 9. VERBIS Kayit Bilgileri */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            9. VERBIS Kayit Bilgileri
          </h2>
          <p>
            6698 sayili Kanun&apos;un 16. maddesi uyarinca, Hastane LMS Veri Sorumlusu olarak
            Veri Sorumlulari Sicil Bilgi Sistemi&apos;ne (VERBIS) kayitlidir.
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>Veri Sorumlusu:</strong> Hastane LMS Yazilim Teknolojileri
            </li>
            <li>
              <strong>VERBIS Kayit Numarasi:</strong> [Kayit tamamlaninca eklenecektir]
            </li>
            <li>
              <strong>Kayit Tarihi:</strong> [Kayit tamamlaninca eklenecektir]
            </li>
          </ul>
          <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
            VERBIS kaydi hakkinda detayli bilgi icin:{" "}
            <a
              href="https://verbis.kvkk.gov.tr"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
              style={{ color: "var(--color-primary)" }}
            >
              verbis.kvkk.gov.tr
            </a>
          </p>
        </section>

        {/* 10. Iletisim */}
        <section
          className="rounded-2xl p-6"
          style={{ backgroundColor: "var(--color-surface-alt, #f8fafc)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            10. Iletisim
          </h2>
          <p>
            Gizlilik politikamiz ve kisisel verilerinizin korunmasi hakkindaki tum soru
            ve talepleriniz icin:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>Veri Sorumlusu Irtibat Kisisi:</strong> kvkk@hastane-lms.com
            </li>
            <li>
              <strong>Genel Destek:</strong> destek@hastane-lms.com
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
