/**
 * Ana sayfa (/) Türkçe metinleri — TEK kaynak.
 *
 * Her cümle kodla doğrulanmış bir yeteneğe dayanır (bkz. plan §4.4 iddia politikası).
 * YASAK: uydurma rakam/yorum, "değiştirilemez", "KVKK uyumlu", "veriler Türkiye'de",
 * SMG/akreditasyon modülü, SSO, hazır içerik kütüphanesi, fiyat, em-dash.
 */

export const HOME_TR = {
  hero: {
    overline: 'Hastane eğitim yönetim sistemi',
    title: 'Hastane eğitimlerini atayın, ölçün, kanıtlayın.',
    lead: 'Zorunlu eğitim, sınav, sertifika ve denetim kayıtları tek platformda. İmza föyü ve Excel takibine gerek kalmaz.',
    primaryCta: 'Demo Talep Edin',
    secondaryCta: 'Nasıl çalışır',
  },

  problem: {
    title: 'Eğitim yapılıyor ama kanıtı dağınık.',
    lead: 'Çoğu hastanede zorunlu eğitimler hâlâ birkaç farklı araçla yürür. Denetim yaklaşınca bu dağınıklık en çok zamanı alan iş olur.',
    items: [
      {
        title: 'Excel listeleri',
        desc: 'Kimin hangi eğitimi aldığı birden çok dosyada tutulur, güncel olanı bulmak zordur.',
      },
      {
        title: 'Kâğıt imza föyleri',
        desc: 'Katılım kâğıtla kanıtlanır; föyler taranır, dosyalanır, bazen kaybolur.',
      },
      {
        title: 'Telefonla hatırlatma',
        desc: 'Son tarihi yaklaşan personel tek tek aranır, vardiyalı ekiplerde kimse atlanmasın diye uğraşılır.',
      },
      {
        title: 'Denetim öncesi telaş',
        desc: 'Kayıtlar denetimden önce toplanır; eksikler son anda fark edilir.',
      },
    ],
  },

  flow: {
    title: 'Dört adımda eğitimden kanıta',
    lead: 'Siz eğitimi hazırlarsınız. Atama, takip, sınav ve belgeleme aynı akışta otomatik ilerler.',
    steps: [
      {
        key: 'assign',
        name: 'Atayın',
        title: 'Doğru eğitim, doğru kişiye',
        desc: 'Eğitimi birime, unvana veya kişiye atayın. Departman kuralı tanımlarsanız yeni gelen personele de otomatik atanır.',
      },
      {
        key: 'learn',
        name: 'Öğrensinler',
        title: 'Vardiyasında, kendi cihazından',
        desc: 'Personel videoyu, dokümanı veya ses kaydını web ya da mobil uygulamadan tamamlar. Yarıda bıraktığı yerden devam eder.',
      },
      {
        key: 'exam',
        name: 'Ölçün',
        title: 'Ön sınav ve son sınav',
        desc: 'Eğitimden önce ve sonra sınav uygulanır. Sorular karıştırılabilir, süre sunucuda tutulur, geçme notu ve hak sayısı sizin ayarınızdır.',
      },
      {
        key: 'proof',
        name: 'Kanıtlayın',
        title: 'Sertifika ve denetim formu hazır',
        desc: 'Geçen personelin sertifikası otomatik üretilir. Katılım, imza ve sonuçlar denetimde istenen formlara dökülür.',
      },
    ],
  },

  videoLock: {
    title: 'İzlemeden sınava geçilmez.',
    lead: 'Online eğitimin en bilinen açığı videoyu açıp beklemektir. KlinoVax bunu üç katmanda engeller.',
    points: [
      { title: 'İleri sarma kapalı', desc: 'Personel izlemediği bölüme atlayamaz. Geri sarıp tekrar izlemek serbesttir.' },
      { title: 'İzleme süresi sunucuda doğrulanır', desc: 'Videonun neredeyse tamamı gerçekten izlenmeden son sınav açılmaz.' },
      { title: 'Kaldığı yerden devam', desc: 'Vardiya araya girerse personel döndüğünde aynı saniyeden devam eder.' },
    ],
  },

  evidence: {
    title: 'Denetim geldiğinde kanıt elinizde.',
    lead: 'Eğitim kayıtları ayrı bir işe dönüşmez; her tamamlanan eğitim kendi belgesini üretir.',
    items: [
      { title: 'QR ile doğrulanan sertifika', desc: 'Her sertifikanın üzerinde bir doğrulama kodu bulunur. Kod, sertifikanın geçerli, süresi dolmuş veya iptal edilmiş olduğunu herkese açık bir sayfada gösterir.' },
      { title: 'Denetim formları tek tıkla', desc: 'Eğitim Duyuru Formu, Katılım ve İmza Formu ve Kayıt Sicil Formu PDF olarak hazırlanır.' },
      { title: 'Uyum raporu', desc: 'Zorunlu eğitimlerde kimin eksik olduğunu birim bazında görür, eksiklere hatırlatma gönderirsiniz.' },
      { title: 'İzlenebilir işlem geçmişi', desc: 'Kritik işlemler zincirleme bir kayıtla tutulur. Kayıt sonradan değiştirilirse tutarlılık kontrolü bunu gösterir.' },
    ],
  },

  automation: {
    title: 'Takip işi sistemde kalır.',
    lead: 'Hatırlatma, gecikme ve yenileme takibi kendiliğinden işler; ekibiniz telefonla aramak zorunda kalmaz.',
    items: [
      { title: 'Son tarih yaklaşınca', desc: 'Personele e-posta ve bildirim gider; kaç gün önce gideceğini siz belirlersiniz.' },
      { title: 'Süre geçince', desc: 'Geciken eğitimler için hatırlatma gönderilir, yöneticiler listede görür.' },
      { title: 'Sertifika bitmeden', desc: 'Geçerlilik süresi dolmadan önce yenileme hatırlatması gönderilir.' },
      { title: 'Kalan ve katılmayanlar için', desc: 'Tek işlemle ikinci tur atama yapılır; geçmiş kayıtlar korunur.' },
    ],
  },

  roles: {
    title: 'Kim için ne değişir',
    lead: 'Aynı platform, her ekibin kendi sorusuna cevap verir.',
    items: [
      { who: 'Kalite birimi ve eğitim sorumlusu', before: 'Kayıtlar dağınık, denetimden önce toplanıyor.', after: 'Formlar, raporlar ve eksik listesi her an güncel.' },
      { who: 'Hastane yönetimi', before: 'Zorunlu eğitimlerin durumu görünmüyor.', after: 'Tamamlanma, gecikme ve eğitim etkililiği tek ekranda.' },
      { who: 'İnsan kaynakları', before: 'Yeni gelen ve ayrılan personelin takibi elle yapılıyor.', after: 'Excel ile toplu aktarım, departmana göre otomatik atama.' },
      { who: 'Bilgi işlem ve KVKK sorumlusu', before: 'Veri güvenliği ve yetkiler belirsiz.', after: 'Kurumlar arası izolasyon, rol bazlı yetki, KVKK başvuru akışı.' },
      { who: 'Personel', before: 'Eğitim için vardiya dışında toplanmak gerekiyor.', after: 'Telefondan tamamlar, sertifikasına anında erişir.' },
    ],
  },

  mobile: {
    title: 'Her vardiyada, her cihazda.',
    lead: 'iOS ve Android uygulamasıyla personel eğitimi koridorda, nöbet arasında veya evde tamamlar.',
    points: [
      'Bağlantı koparsa sınav cevapları cihazda bekler, bağlantı gelince gönderilir.',
      'Bildirimle yeni atama ve son tarih hatırlatması.',
      'Sertifikayı PDF olarak indirme.',
    ],
  },

  security: {
    title: 'Verileriniz kurumunuza ait.',
    lead: 'Her hastanenin verisi diğerlerinden ayrı tutulur ve yalnızca yetkili kişilerce görülür.',
    items: [
      { title: 'Kurumlar arası izolasyon', desc: 'Hastane kullanıcılarının sorguları kendi kurumlarıyla sınırlanır; veritabanında satır bazlı güvenlik politikaları da tanımlıdır.' },
      { title: 'Hassas alanlar şifreli', desc: 'TC kimlik numaraları uygulama katmanında şifrelenerek saklanır; yedekler şifrelidir.' },
      { title: 'KVKK başvuru akışı', desc: 'Personelin bilgi, düzeltme ve silme talepleri sistem içinden alınır ve yanıtlanır.' },
      { title: 'Barındırma ve kurulum seçeneği', desc: 'Bulut sürümü Avrupa (Frankfurt) bölgesinde çalışır. Verisini kendi sunucusunda tutmak isteyen kurumlar için kurum içi kurulum seçeneği vardır.' },
      { title: 'Çok hastaneli yapı', desc: 'Grup hastaneleri her şubeyi ayrı yönetir, konsolide raporu tek panelden alır.' },
    ],
  },

  reference: {
    heroProof: 'Özel Devakent Hastanesi’nde kullanılıyor · Web, iOS ve Android',
    overline: 'Referans',
    title: 'Sahada kullanılıyor.',
    body: 'Özel Devakent Hastanesi, personel eğitiminden denetim belgelerine kadar eğitim sürecini KlinoVax ile yürütüyor.',
    logoAlt: 'Özel Devakent Hastanesi',
  },

  faq: {
    title: 'Sık sorulan sorular',
    items: [
      { q: 'KlinoVax tam olarak nedir?', a: 'Hastaneler için personel eğitim ve sınav platformudur. Eğitim hazırlama, atama, video takibi, ön ve son sınav, sertifika ve denetim belgelerini tek yerde toplar.' },
      { q: 'Kurulum ne kadar sürer, personeli nasıl aktarırız?', a: 'Bulut sürümünde sunucu kurmanız gerekmez. Personeli Excel ile toplu aktarabilir, birim ve unvana göre hemen eğitim atamaya başlayabilirsiniz.' },
      { q: 'Kendi eğitim içeriklerimizi kullanabilir miyiz?', a: 'Evet. Video, PDF ve ses dosyalarınızı yükleyip eğitime eklersiniz. Soruları kendiniz yazabilir, soru bankasında saklayabilir veya yüklediğiniz içerikten yapay zekâ desteğiyle soru taslağı üretebilirsiniz.' },
      { q: 'Personel videoyu atlayarak sınava geçebilir mi?', a: 'Hayır. Videoda ileri sarma kapalıdır ve izleme süresi sunucuda doğrulanır. Videonun neredeyse tamamı izlenmeden son sınav açılmaz.' },
      { q: 'Sınavda başarısız olan personel ne olur?', a: 'Belirlediğiniz hak sayısı kadar tekrar dener. Hakkı biten personel ek hak talep edebilir, yönetici onaylarsa yeniden sınava girer.' },
      { q: 'Denetimde hangi belgeleri sunabiliriz?', a: 'Eğitim Duyuru Formu, Katılım ve İmza Formu, Kayıt Sicil Formu, sertifikalar ve uyum raporu PDF veya Excel olarak alınabilir.' },
      { q: 'Verilerimiz nerede tutuluyor, güvende mi?', a: 'Bulut sürümü Avrupa (Frankfurt) bölgesinde çalışır. Her kurumun verisi diğerlerinden izole edilir, TC kimlik numaraları şifreli saklanır. İsteyen kurumlar için kurum içi kurulum seçeneği vardır.' },
      { q: 'KVKK süreçlerini nasıl destekliyor?', a: 'Personel KVKK kapsamındaki başvurularını sistem içinden yapar, yönetici yanıtlar. Aydınlatma metni sürümlüdür; metin değişince personelden yeniden onay alınır.' },
      { q: 'Personel eğitimleri telefondan tamamlayabilir mi?', a: 'Evet. iOS ve Android uygulamasıyla eğitimini izler, sınavını tamamlar, sertifikasını indirir.' },
      { q: 'Birden fazla hastaneyi yönetebilir miyiz?', a: 'Evet. Grup yapısında her hastane kendi personeli ve eğitimiyle ayrı çalışır; grup yöneticisi tümünün raporunu tek panelden görür.' },
    ],
  },

  closing: {
    title: 'Eğitim sürecinizi birlikte görelim.',
    lead: 'Hastanenizin eğitim akışını demo ortamında gösterelim; atama, sınav, sertifika ve rapor adımlarını birlikte inceleyelim.',
    primaryCta: 'Demo Talep Edin',
    secondaryCta: 'Bize yazın',
  },
} as const;

export type HomeContent = typeof HOME_TR;
