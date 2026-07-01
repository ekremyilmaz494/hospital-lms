import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Gizlilik Politikasi | ${BRAND.fullName}`,
  description: `${BRAND.fullName} gizlilik politikasi - KVKK uyumlu, App Store ve Google Play veri beyanlariyla uyumlu kisisel verilerin korunmasi.`,
};

// KVKK / yasal basvuru e-postasi (veri sorumlusu irtibat kutusu).
const CONTACT_EMAIL = "kvkk@klinovax.info";
// Genel teknik destek kutusu.
const SUPPORT_EMAIL = "ekremyilmaz@klinovax.info";

const LAST_UPDATED = "Temmuz 2026";

// Veri sorumlusu — gercek kisi (sirket tuzel kisiligi yok).
const LEGAL_ENTITY = "Ekrem Yilmaz";
const LEGAL_ADDRESS = "Buhara Mah. Baris Cad. Damlakent Sitesi No: 77/6, Selcuklu / Konya";
const VERBIS_NUMBER = "Basvuru surecinde";

const headingPrimary = { color: "var(--color-text-primary)" } as const;

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2" style={headingPrimary}>
        Gizlilik Politikasi
      </h1>
      <p className="text-sm mb-2" style={{ color: "var(--color-text-tertiary)" }}>
        Son guncelleme: {LAST_UPDATED} · Yururluk tarihi: {LAST_UPDATED}
      </p>
      <p className="text-sm mb-10 max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
        Bu gizlilik politikasi, <strong>{BRAND.name}</strong> mobil uygulamasi (iOS ve Android) ile
        web platformu uzerinden islenen kisisel verilere iliskindir. 6698 sayili Kisisel Verilerin
        Korunmasi Kanunu (&quot;KVKK&quot;), Apple App Store ve Google Play Store veri aciklama
        gereksinimleriyle uyumlu olacak sekilde hazirlanmistir.
      </p>

      <div
        className="space-y-10 text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {/* 1. Veri Sorumlusu */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            1. Veri Sorumlusu
          </h2>
          <p>
            6698 sayili Kisisel Verilerin Korunmasi Kanunu (&quot;KVKK&quot;) kapsaminda veri
            sorumlusu sifatiyla hareket eden taraf:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>Veri Sorumlusu:</strong> {LEGAL_ENTITY} (gercek kisi)
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
        </section>

        {/* 2. Uygulamanin Amaci */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            2. Uygulamanin Amaci
          </h2>
          <p>
            {BRAND.name}, hastane ve saglik kuruluslarinda calisan personelin (hekim, hemsire,
            teknisyen vb.) zorunlu mesleki egitim, video izleme, sinav (on ve son test) ve
            sertifikasyon sureclerini dijital ortamda yoneten bir ogrenme yonetim sistemidir.
            Uygulama yalnizca yetkili kurum personeli tarafindan, kurumlari tarafindan atanan
            egitimler kapsaminda kullanilir.
          </p>
        </section>

        {/* 3. Toplanan Veriler */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            3. Topladigimiz Kisisel Veriler
          </h2>
          <p>Platform uzerinde asagidaki kisisel veri kategorileri islenmektedir:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Kimlik Bilgileri:</strong> Ad, soyad, T.C. kimlik numarasi, unvan, departman
              bilgisi
            </li>
            <li>
              <strong>Iletisim Bilgileri:</strong> E-posta adresi, telefon numarasi
            </li>
            <li>
              <strong>Mesleki Bilgiler:</strong> Gorev tanimi, calisan numarasi (HBYS/HIS
              entegrasyonu), sertifika ve yetkinlik bilgileri
            </li>
            <li>
              <strong>Egitim ve Sinav Verileri:</strong> Egitim tamamlama durumlari, sinav
              sonuclari, video ilerleme kayitlari, sertifika bilgileri
            </li>
            <li>
              <strong>Erisim ve Kullanim Verileri:</strong> Oturum acma zamanlari, IP adresi, cihaz
              ve tarayici bilgisi, uygulama ici etkinlik kayitlari
            </li>
            <li>
              <strong>Cihaz Tanimlayicisi:</strong> Anlik (push) bildirim gonderebilmek icin cihaz
              bildirim jetonu (push token)
            </li>
            <li>
              <strong>Teshis Verileri:</strong> Uygulama cokme kayitlari ve performans verileri
              (kararli calismayi saglamak icin)
            </li>
            <li>
              <strong>Gorsel Veriler:</strong> Profil fotografi (istege bagli)
            </li>
          </ul>
          <div
            className="mt-4 rounded-xl p-4 text-sm"
            style={{
              backgroundColor: "var(--color-surface-alt, #f8fafc)",
              borderLeft: "3px solid var(--color-primary)",
              border: "1px solid var(--color-border)",
            }}
          >
            {BRAND.name}, kullanicilarinin verilerini <strong>reklam</strong> amaciyla toplamaz,{" "}
            <strong>satmaz</strong> ve reklam aglariyla paylasmaz. Uygulamada ucuncu taraf reklam
            veya capraz uygulama/internet sitesi <strong>takibi (tracking) yoktur</strong>.
          </div>
        </section>

        {/* 4. Mobil Uygulama Veri Aciklamasi (App Store & Google Play) */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            4. Mobil Uygulama Veri Aciklamasi (App Store &amp; Google Play)
          </h2>
          <p>
            Apple App Store &quot;App Privacy&quot; ve Google Play &quot;Data Safety&quot;
            beyanlarimiz asagidaki tabloyla birebir uyumludur. Toplanan tum veriler yalnizca{" "}
            <strong>uygulama islevselligi</strong> icin kullanilir; hicbiri kullanici takibi
            (tracking) icin kullanilmaz.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {["Veri turu", "Kullanim amaci", "Kimlige bagli mi?", "Takip icin mi?"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left font-semibold p-2.5"
                        style={{
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-surface-alt, #f8fafc)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Ad (Name)", "Uygulama islevselligi", "Evet", "Hayir"],
                  ["E-posta adresi", "Uygulama islevselligi (kimlik dogrulama)", "Evet", "Hayir"],
                  ["Kullanici kimligi (User ID)", "Uygulama islevselligi", "Evet", "Hayir"],
                  ["Cihaz kimligi (Device ID)", "Uygulama islevselligi (push bildirim)", "Evet", "Hayir"],
                  ["Urun etkilesimi (Product Interaction)", "Uygulama islevselligi (egitim takibi)", "Evet", "Hayir"],
                  ["Cokme verisi (Crash Data)", "Uygulama islevselligi", "Hayir", "Hayir"],
                  ["Performans verisi (Performance Data)", "Uygulama islevselligi", "Hayir", "Hayir"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className="p-2.5 align-top"
                        style={{ border: "1px solid var(--color-border)" }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Isleme Amaclari */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            5. Kisisel Verilerin Isleme Amaclari
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Platform hizmetlerinin sunulmasi ve iyilestirilmesi</li>
            <li>Kullanici kimlik dogrulama ve yetkilendirme islemleri</li>
            <li>Egitim atama, takip ve raporlama sureclerinin yurutulmesi</li>
            <li>Sinav uygulama, degerlendirme ve sertifikasyon islemleri</li>
            <li>Zorunlu egitim hatirlatmalari icin anlik (push) bildirim gonderilmesi</li>
            <li>Yasal yukumluluklerin yerine getirilmesi (saglik personeli egitim kayitlari)</li>
            <li>Platform guvenliginin saglanmasi ve kotuye kullaniminin onlenmesi</li>
            <li>Uygulama kararliliginin saglanmasi (cokme/performans teshisi)</li>
          </ul>
        </section>

        {/* 6. Hukuki Dayanak */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            6. Kisisel Veri Islemenin Hukuki Dayanaklari
          </h2>
          <p>
            Kisisel verileriniz, KVKK&apos;nin 5. ve 6. maddelerinde belirtilen asagidaki hukuki
            dayanaklara istinaden islenmektedir:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Sozlesmenin ifasi (m.5/2-c):</strong> Platform hizmetlerinin sunulmasi icin
              gerekli veri isleme faaliyetleri
            </li>
            <li>
              <strong>Hukuki yukumluluk (m.5/2-c):</strong> Saglik mevzuati geregi personel egitim
              kayitlarinin tutulmasi
            </li>
            <li>
              <strong>Mesru menfaat (m.5/2-f):</strong> Platform guvenliginin saglanmasi, hizmet
              kalitesinin arttirilmasi
            </li>
            <li>
              <strong>Acik riza (m.5/1):</strong> Zorunlu olmayan veri isleme faaliyetleri (varsa)
            </li>
          </ul>
        </section>

        {/* 7. Veri Aktarimi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            7. Kisisel Verilerin Aktarimi
          </h2>
          <p>Kisisel verileriniz asagidaki durumlarda ucuncu taraflarla paylasilabilir:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Altyapi ve Hizmet Saglayicilari:</strong> Sunucu barindirma, kimlik
              dogrulama, veritabani, dosya/video depolama, icerik dagitimi (CDN) ve anlik bildirim
              iletimi gibi hizmetlerin yurutulmesi amaciyla; yurt ici ve yurt disi bulut/altyapi ve
              yazilim hizmeti saglayicilari ile, KVKK m.8 ve m.9 kapsaminda gerekli teknik ve idari
              tedbirler alinarak calisilmaktadir.
            </li>
            <li>
              <strong>Organizasyonunuz:</strong> Bagli oldugunuz saglik kurulusunun yetkili
              yoneticileri, yetkileri dahilinde egitim ve sinav verilerinize erisebilir.
            </li>
            <li>
              <strong>Yasal Zorunluluklar:</strong> Yetkili kamu kurum ve kuruluslarina, mevzuatin
              gerektirdigi hallerde veri aktarimi yapilabilir.
            </li>
          </ul>
          <p className="mt-3">
            Kisisel verileriniz gerektiginde yurt disinda bulunan hizmet saglayicilarinin
            sunuculari araciligiyla islenebilir. Bu tur yurt disi aktarimlar, KVKK&apos;nin 9.
            maddesinde ongorulen sartlarin (yeterli korumaya sahip ulke, standart sozlesme,
            taahhutname veya acik riza) saglanmasi halinde gerceklestirilir. Veriler iletimde
            TLS/SSL ile sifrelenir.
          </p>
        </section>

        {/* 8. Saklama Sureleri */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            8. Veri Saklama Sureleri
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Hesap Bilgileri:</strong> Hesap aktif oldugu surece ve hesap kapatildiktan
              sonra 1 yil
            </li>
            <li>
              <strong>Egitim ve Sinav Kayitlari:</strong> Saglik mevzuati geregi en az 10 yil (yasal
              zorunluluk)
            </li>
            <li>
              <strong>Sertifika Bilgileri:</strong> Gecerlilik suresi boyunca ve sonrasinda 5 yil
            </li>
            <li>
              <strong>Erisim Kayitlari (Log):</strong> 2 yil
            </li>
            <li>
              <strong>Cokme/Performans Verileri:</strong> En fazla 90 gun
            </li>
            <li>
              <strong>Cerez Verileri:</strong> Oturum cerezleri tarayici kapatildiginda, kalici
              cerezler en fazla 1 yil
            </li>
          </ul>
          <p className="mt-3">
            Saklama suresi dolan veriler, periyodik imha sureci kapsaminda otomatik olarak silinir
            veya anonimlestirilir.
          </p>
        </section>

        {/* 9. KVKK Madde 11 Haklari */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            9. KVKK Kapsamindaki Haklariniz (Madde 11)
          </h2>
          <p>KVKK&apos;nin 11. maddesi uyarinca asagidaki haklara sahipsiniz:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Kisisel verilerinizin islenip islenmedigini ogrenme</li>
            <li>Kisisel verileriniz islenmisse buna iliskin bilgi talep etme</li>
            <li>
              Kisisel verilerinizin islenme amacini ve bunlarin amacina uygun kullanilip
              kullanilmadigini ogrenme
            </li>
            <li>
              Yurt icinde veya yurt disinda kisisel verilerinizin aktarildigi ucuncu kisileri bilme
            </li>
            <li>
              Kisisel verilerinizin eksik veya yanlis islenmis olmasi halinde bunlarin
              duzeltilmesini isteme
            </li>
            <li>
              KVKK&apos;nin 7. maddesinde ongorulen sartlar cercevesinde kisisel verilerinizin
              silinmesini veya yok edilmesini isteme
            </li>
            <li>
              Duzeltme ve silme islemlerinin, kisisel verilerin aktarildigi ucuncu kisilere
              bildirilmesini isteme
            </li>
            <li>
              Islenen verilerin munhasiran otomatik sistemler vasitasiyla analiz edilmesi suretiyle
              aleyhinize bir sonucun ortaya cikmasina itiraz etme
            </li>
            <li>
              Kisisel verilerinizin kanuna aykiri olarak islenmesi sebebiyle zarara ugramaniz
              halinde zararin giderilmesini talep etme
            </li>
          </ul>
          <p className="mt-3">
            Haklarinizi kullanmak icin{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "#0d9668" }}>
              {CONTACT_EMAIL}
            </a>{" "}
            adresine yazili basvuruda bulunabilir veya platform uzerindeki KVKK basvuru formunu
            kullanabilirsiniz. Basvurulariniz en gec 30 gun icerisinde sonuclandirilacaktir.
          </p>
        </section>

        {/* 10. Hesap ve Veri Silme Talebi (Google Play zorunlu) */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            10. Hesap ve Veri Silme Talebi
          </h2>
          <p>
            Hesabinizin ve iliskili kisisel verilerinizin silinmesini talep etmek icin{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: "#0d9668" }}>
              {CONTACT_EMAIL}
            </a>{" "}
            adresine basvurabilir veya bagli oldugunuz kurumun sistem yoneticisiyle iletisime
            gecebilirsiniz. Yasal saklama yukumlulugune tabi kayitlar (orn. zorunlu egitim
            kayitlari), ilgili mevzuatta ongorulen sure boyunca saklanmaya devam eder; bu sure
            sonunda silinir veya anonimlestirilir.
          </p>
        </section>

        {/* 11. Veri Guvenligi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            11. Veri Guvenligi
          </h2>
          <p>
            Verileriniz, endustri standardi teknik ve idari tedbirlerle korunur: iletimde TLS/SSL
            sifreleme, kimlik dogrulamada guvenli jeton saklama (iOS Keychain / Android Keystore
            tabanli guvenli depolama), yetki bazli erisim kontrolu ve duzenli denetim kayitlari.
          </p>
        </section>

        {/* 12. Cocuklarin Gizliligi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            12. Cocuklarin Gizliligi
          </h2>
          <p>
            {BRAND.name} yalnizca yetiskin saglik kurulusu personeline yoneliktir; 18 yas alti
            kisilerden bilerek kisisel veri toplanmaz.
          </p>
        </section>

        {/* 13. Cerez Politikasi */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            13. Cerez Politikasi
          </h2>
          <p>Platform asagidaki cerez turlerini kullanmaktadir:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>Zorunlu Cerezler:</strong> Oturum yonetimi, kimlik dogrulama ve guvenlik icin
              gerekli cerezler. Bu cerezler olmadan platform islevlerini yerine getiremez.
            </li>
            <li>
              <strong>Islevsel Cerezler:</strong> Kullanici tercihlerinin (dil, tema secimi)
              hatirlanmasi icin kullanilir.
            </li>
            <li>
              <strong>Analitik Cerezler:</strong> Platform kullaniminin iyilestirilmesi icin
              anonimlestirilmis istatistik verileri toplar.
            </li>
          </ul>
          <p className="mt-3">
            Tarayicinizin cerez ayarlarini degistirerek zorunlu olmayan cerezleri reddedebilirsiniz.
            Ancak bu durum, platformun bazi ozelliklerinin duzgun calismamasina neden olabilir.
          </p>
        </section>

        {/* 14. VERBIS Kayit Bilgileri */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            14. VERBIS Kayit Bilgileri
          </h2>
          <p>
            6698 sayili Kanun&apos;un 16. maddesi uyarinca veri sorumlusu olarak Veri Sorumlulari
            Sicil Bilgi Sistemi&apos;ne (VERBIS) kayit durumumuz:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>Veri Sorumlusu:</strong> {LEGAL_ENTITY}
            </li>
            <li>
              <strong>VERBIS Kayit Numarasi:</strong> {VERBIS_NUMBER}
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

        {/* 15. Degisiklikler */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            15. Degisiklikler
          </h2>
          <p>
            Bu gizlilik politikasi gerektiginde guncellenebilir. Onemli degisiklikler uygulama
            ve/veya e-posta yoluyla bildirilir. Guncel surum her zaman bu sayfada yayimlanir.
          </p>
        </section>

        {/* 16. Iletisim */}
        <section
          className="rounded-2xl p-6"
          style={{
            backgroundColor: "var(--color-surface-alt, #f8fafc)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 className="text-lg font-semibold mb-3" style={headingPrimary}>
            16. Iletisim
          </h2>
          <p>
            Gizlilik politikamiz ve kisisel verilerinizin korunmasi hakkindaki tum soru ve
            talepleriniz icin:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <strong>Veri Sorumlusu Irtibat:</strong> {CONTACT_EMAIL}
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
        </section>
      </div>
    </div>
  );
}
