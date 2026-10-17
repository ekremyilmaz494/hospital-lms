/**
 * /sss Türkçe metinleri — TEK kaynak.
 *
 * Her cevap kodla doğrulanmış bir yeteneğe dayanır (iddia politikası, bkz. home.tr.ts).
 * Ana sayfadaki SSS cevaplarıyla (HOME_TR.faq) çelişmemeli; ortak sorular aynı içeriği taşır.
 * YASAK: uydurma rakam/yorum, "değiştirilemez", "KVKK uyumlu", "veriler Türkiye'de",
 * SMG/akreditasyon modülü, SSO, SMS doğrulama, hazır içerik kütüphanesi, fiyat, em-dash,
 * kesin video tamamlanma yüzdesi.
 */

export interface FaqLink {
  href: string
  label: string
}

export interface FaqItem {
  q: string
  a: string
  /** Cevabın sonuna eklenen isteğe bağlı iç bağlantı. */
  link?: FaqLink
}

export interface FaqGroup {
  /** Çapa kimliği (ASCII, kebab-case); grubun `<h2 id>`'si. */
  id: string
  title: string
  items: readonly FaqItem[]
}

export const FAQ_TR = {
  head: {
    overline: 'Destek',
    title: 'Sık sorulan sorular',
    lead: 'Eğitim akışı, sınav, sertifika, kurulum, güvenlik ve mobil uygulama hakkında en çok sorulan soruların cevapları burada.',
  },

  tocTitle: 'Konular',

  groups: [
    {
      id: 'egitim-akisi',
      title: 'Eğitim akışı',
      items: [
        {
          q: 'KlinoVax tam olarak nedir?',
          a: 'Hastaneler için personel eğitim ve sınav platformudur. Eğitim hazırlama, atama, video takibi, ön ve son sınav, sertifika ve denetim belgelerini tek yerde toplar.',
        },
        {
          q: 'Bir eğitim hangi adımlardan geçer?',
          a: 'Eğitim personele atanır. Personel önce ön sınava girer, ardından eğitim içeriğini tamamlar ve son sınava geçer. Sonuç geçti veya kaldı olarak kaydedilir. Yalnızca sınavdan oluşan bir eğitim de tanımlayabilirsiniz; bu durumda personel doğrudan sınava girer.',
        },
        {
          q: 'Kendi eğitim içeriklerimizi kullanabilir miyiz?',
          a: 'Evet. Video, PDF ve ses dosyalarınızı yükleyip eğitime eklersiniz. Soruları kendiniz yazabilir, soru bankasında saklayabilir veya yüklediğiniz içerikten yapay zekâ desteğiyle soru taslağı üretebilirsiniz.',
        },
        {
          q: 'Eğitimleri personele nasıl atarız?',
          a: 'Eğitimi seçtiğiniz birimlere veya tek tek personele atarsınız. Bir birime eğitim kuralı tanımlarsanız o birime yeni eklenen personele aynı eğitimler otomatik olarak atanır.',
        },
        {
          q: 'Personel videoyu atlayarak sınava geçebilir mi?',
          a: 'Hayır. Videoda ileri sarma kapalıdır ve izleme süresi sunucuda doğrulanır. Videonun neredeyse tamamı izlenmeden son sınav açılmaz.',
        },
        {
          q: 'Personel videoyu yarıda bırakırsa ne olur?',
          a: 'Videoda kaldığı yer sunucuda kaydedilir. Personel döndüğünde video kaldığı yerden devam eder; daha önce izlediği bölümleri geri sarıp tekrar izleyebilir.',
        },
        {
          q: 'Son tarihi yaklaşan personele hatırlatma gidiyor mu?',
          a: 'Evet. Son tarihten kaç gün önce hatırlatma gideceğini kurum ayarlarından siz belirlersiniz. Süresi geçen eğitimler ve geçerlilik süresi dolmak üzere olan sertifikalar için de e-posta ve uygulama bildirimi gönderilir.',
        },
      ],
    },
    {
      id: 'sinav-ve-sertifika',
      title: 'Sınav ve sertifika',
      items: [
        {
          q: 'Geçme notunu ve sınav hakkını kim belirler?',
          a: 'Siz belirlersiniz. Geçme notu ve deneme hakkı her eğitim için ayrı ayarlanır; kurum genelinde varsayılan değerler de tanımlayabilirsiniz.',
        },
        {
          q: 'Sınav süresi ve soru sırası nasıl yönetiliyor?',
          a: 'Süre sunucuda tutulur; sayfayı yenilemek veya cihaz saatini değiştirmek süreyi uzatmaz, süre dolunca sınav otomatik olarak sonlanır. Soruların karıştırılması varsayılan olarak açıktır ve her denemede sorular farklı bir sırayla gelir.',
        },
        {
          q: 'Personel sınavda başarısız olursa ne olur?',
          a: 'Belirlediğiniz hak sayısı kadar tekrar dener. Hakkı biten personel ek hak talep edebilir, yönetici onaylarsa yeniden sınava girer.',
        },
        {
          q: 'Kalan veya katılmayan personele eğitimi yeniden atayabilir miyiz?',
          a: 'Evet. Tek işlemle yeni bir tur atama yapılır ve personele yeni bir son tarih verilir. Önceki turun kayıtları silinmez, geçmiş korunur.',
        },
        {
          q: 'Sertifikanın gerçek olduğu nasıl doğrulanır?',
          a: 'Her sertifikanın üzerinde bir QR kod bulunur. Kod okutulduğunda açılan herkese açık sayfa, sertifikanın geçerli, süresi dolmuş veya iptal edilmiş olduğunu gösterir.',
        },
        {
          q: 'Denetimde hangi belgeleri sunabiliriz?',
          a: 'Eğitim Duyuru Formu, Katılım ve İmza Formu, Kayıt Sicil Formu, sertifikalar ve uyum raporu PDF veya Excel olarak alınabilir.',
        },
      ],
    },
    {
      id: 'kurulum-ve-entegrasyon',
      title: 'Kurulum ve entegrasyon',
      items: [
        {
          q: 'Kurulum ne kadar sürer, personeli nasıl aktarırız?',
          a: 'Bulut sürümünde sunucu kurmanız gerekmez. Personeli Excel ile toplu aktarabilir, birimlere göre hemen eğitim atamaya başlayabilirsiniz.',
        },
        {
          q: 'Mevcut soru bankamızı sisteme aktarabilir miyiz?',
          a: 'Evet. Sorularınızı Excel dosyasıyla soru bankasına toplu olarak aktarır, daha sonra farklı eğitimlerde yeniden kullanırsınız.',
        },
        {
          q: 'SCORM paketlerini kullanabilir miyiz?',
          a: 'Evet. SCORM paketinizi ZIP dosyası olarak yüklersiniz; içerik eğitim olarak personele atanabilir ve web ile mobil uygulamada açılır.',
        },
        {
          q: 'Sistemi kendi sunucumuzda çalıştırabilir miyiz?',
          a: 'Evet. Verisini kendi sunucusunda tutmak isteyen kurumlar için kurum içi kurulum seçeneği vardır. Bu kurulumda platform ve veriler kurumunuzun altyapısında çalışır.',
        },
        {
          q: 'Birden fazla hastaneyi yönetebilir miyiz?',
          a: 'Evet. Grup yapısında her hastane kendi personeli ve eğitimiyle ayrı çalışır; grup yöneticisi tümünün raporunu tek panelden görür.',
        },
      ],
    },
    {
      id: 'guvenlik-ve-kvkk',
      title: 'Güvenlik ve KVKK',
      items: [
        {
          q: 'Verilerimiz nerede tutuluyor, güvende mi?',
          a: 'Bulut sürümü Avrupa (Frankfurt) bölgesinde çalışır. Her kurumun verisi diğerlerinden izole edilir, TC kimlik numaraları şifreli saklanır. İsteyen kurumlar için kurum içi kurulum seçeneği vardır.',
          link: { href: '/guvenlik', label: 'Güvenlik yaklaşımımızı inceleyin' },
        },
        {
          q: 'KVKK süreçlerini nasıl destekliyor?',
          a: 'Personel KVKK kapsamındaki başvurularını sistem içinden yapar, yönetici yanıtlar. Aydınlatma metni sürümlüdür; metin değişince personelden yeniden onay alınır.',
          link: { href: '/kvkk', label: 'KVKK aydınlatma metnini okuyun' },
        },
        {
          q: 'Kişisel veriler ne kadar süre saklanıyor?',
          a: 'Saklama süresini kurumunuz belirler. Süresi dolan pasif personel kayıtları otomatik olarak anonimleştirilir, eski işlem kayıtları da aynı süre sonunda silinir.',
          link: { href: '/data-retention', label: 'Saklama ve imha politikasını okuyun' },
        },
        {
          q: 'Hesaplar için iki adımlı doğrulama var mı?',
          a: 'Evet. Kullanıcılar Google Authenticator veya Microsoft Authenticator gibi bir doğrulama uygulamasıyla iki adımlı doğrulamayı açabilir. Ayrıca belirlediğiniz süre boyunca işlem yapılmayan oturumlar otomatik olarak kapatılır.',
        },
      ],
    },
    {
      id: 'mobil-uygulama',
      title: 'Mobil uygulama',
      items: [
        {
          q: 'Personel eğitimleri telefondan tamamlayabilir mi?',
          a: 'Evet. iOS ve Android uygulamasıyla eğitimini izler, sınavını tamamlar, sertifikasını indirir.',
        },
        {
          q: 'Sınav sırasında internet bağlantısı koparsa ne olur?',
          a: 'Mobil uygulamada verilen cevaplar cihazda bekletilir ve bağlantı geri geldiğinde otomatik olarak gönderilir.',
        },
        {
          q: 'Yeni atamalar telefona bildirim olarak geliyor mu?',
          a: 'Evet. Yeni eğitim atandığında, son tarih yaklaştığında ve sertifikanın geçerlilik süresi dolmak üzereyken uygulamaya bildirim gönderilir.',
        },
      ],
    },
    {
      id: 'demo-ve-baslangic',
      title: 'Demo ve başlangıç',
      items: [
        {
          q: 'Demoyu nasıl talep edebiliriz?',
          a: 'Demo sayfasındaki formu doldurmanız yeterlidir. Sizinle iletişime geçeriz ve hastanenizin eğitim akışını demo ortamında birlikte inceleriz.',
          link: { href: '/demo', label: 'Demo talep formuna gidin' },
        },
      ],
    },
  ] satisfies readonly FaqGroup[],

  closing: {
    title: 'Sorunuzun cevabını bulamadınız mı?',
    lead: 'Bize yazın ya da demo talep edin; hastanenizin eğitim sürecine özel sorularınızı birlikte cevaplayalım.',
    primaryCta: 'Demo Talep Edin',
    secondaryCta: 'Bize yazın',
  },
} as const
