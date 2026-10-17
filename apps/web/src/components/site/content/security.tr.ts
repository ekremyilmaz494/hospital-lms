/**
 * /guvenlik Türkçe metinleri — TEK kaynak.
 *
 * Hedef okur: bilgi işlem ve KVKK sorumluları. Her cümle kodda doğrulanmış bir
 * davranışa dayanır (iddia politikası, bkz. home.tr.ts).
 * YASAK: "değiştirilemez" (yerine "değişiklik tespit edilebilir"), "KVKK uyumlu"
 * (yerine "KVKK süreçlerini destekler"), "veriler Türkiye'de", SKS/JCI/ISO/SOC2/sızma
 * testi iddiası, SSO, SMS doğrulama, IP kısıtlama, kesin video yüzdesi, em-dash.
 */

export interface SecurityPoint {
  title: string
  desc: string
}

export const SECURITY_TR = {
  head: {
    overline: 'Güvenlik',
    title: 'Verileriniz kurumunuza ait.',
    lead: 'Bu sayfa, bilgi işlem ve KVKK sorumlularının sorduğu soruları sade bir dille cevaplar: verinin nasıl ayrıldığı, kimin neyi görebildiği, neyin şifrelendiği ve kayıtların nasıl korunduğu.',
  },

  isolation: {
    id: 'kurum-izolasyonu',
    title: 'Her hastanenin verisi ayrı tutulur.',
    lead: 'KlinoVax çok kiracılı bir platformdur: birden fazla hastane aynı altyapıyı kullanır, ancak hiçbiri diğerlerinin verisini göremez.',
    points: [
      'Hastane yöneticisi ve personel için yapılan veritabanı sorguları, oturum açan kullanıcının kurumuyla sınırlanır.',
      'Veritabanı katmanında ayrıca kurum bazlı satır güvenliği politikaları (PostgreSQL RLS) tanımlıdır; politikalar kullanıcının değiştiremeyeceği, sunucu tarafından atanan kurum bilgisine dayanır.',
    ],
  },

  auth: {
    id: 'kimlik-dogrulama',
    title: 'Kimlik doğrulama ve oturum',
    lead: 'Giriş, kimlik doğrulama altyapısı (Supabase Auth) üzerinden yapılır. Hesapları korumak için ek adımlar kurum ve kullanıcı tarafından açılabilir.',
    items: [
      {
        title: 'İki adımlı doğrulama',
        desc: 'Kullanıcılar Google Authenticator veya Microsoft Authenticator gibi bir doğrulama uygulamasıyla ikinci bir giriş adımı açabilir.',
      },
      {
        title: 'Hareketsiz oturum kapanır',
        desc: 'Belirlediğiniz süre boyunca işlem yapılmayan oturum, kapanmadan önce uyarı gösterir ve ardından otomatik olarak sonlanır.',
      },
      {
        title: 'İlk girişte yeni şifre',
        desc: 'Yönetici tarafından oluşturulan veya şifresi sıfırlanan hesap, kullanıcı kendi şifresini belirlemeden işlem yapamaz.',
      },
    ] satisfies readonly SecurityPoint[],
  },

  roles: {
    id: 'rol-bazli-yetki',
    title: 'Rol bazlı yetki',
    lead: 'Kimin neyi görebildiği sunucuda belirlenir; kullanıcının kendi tarayıcısında değiştirebileceği bir bilgiye dayanmaz.',
    items: [
      {
        title: 'Platform yöneticisi',
        desc: 'KlinoVax ekibinin kurumları ve abonelikleri yönettiği roldür. Hastaneler bu rolü kullanmaz.',
      },
      {
        title: 'Hastane yöneticisi',
        desc: 'Yalnızca kendi kurumunun personelini, eğitimlerini ve raporlarını görür ve yönetir.',
      },
      {
        title: 'Personel',
        desc: 'Yalnızca kendisine atanan eğitimleri, kendi sınav sonuçlarını ve sertifikalarını görür.',
      },
    ] satisfies readonly SecurityPoint[],
    note: 'Rol bilgisi sunucu tarafında tutulur ve her istekte sunucuda kontrol edilir. Kullanıcı kendi rolünü değiştiremez.',
  },

  encryption: {
    id: 'sifreleme',
    title: 'Şifreleme',
    lead: 'Veri hem taşınırken hem de en hassas alanlarda saklanırken şifrelenir.',
    points: [
      {
        title: 'Yalnızca şifreli bağlantı',
        desc: 'Tarayıcı ile sunucu arasındaki trafik HTTPS ile şifrelenir. HSTS başlığı, tarayıcılara siteye şifresiz bağlantı kurmamalarını bildirir.',
      },
      {
        title: 'TC kimlik numarası alan bazında şifreli',
        desc: 'TC kimlik numaraları veritabanına yazılmadan önce uygulama katmanında AES-256-GCM ile şifrelenir. Arama için yalnızca tek yönlü bir özet (HMAC-SHA256) tutulur; numara düz metin olarak saklanmaz.',
      },
      {
        title: 'Şifreli yedekler',
        desc: 'Otomatik yedekler AES-256-GCM ile şifrelenmeden kaydedilmez. Şifreleme anahtarı tanımlı değilse yedek alınmaz.',
      },
      {
        title: 'Süreli içerik bağlantıları',
        desc: 'Eğitim videoları ve dokümanlar herkese açık bir adresten sunulmaz; her istekte kısa süre geçerli, imzalı bir bağlantı üretilir.',
      },
    ] satisfies readonly SecurityPoint[],
  },

  audit: {
    id: 'denetim-izi',
    title: 'Değişiklik tespit edilebilir işlem kaydı',
    lead: 'Kritik işlemler kimin, ne zaman, neyi yaptığıyla birlikte kaydedilir. Kayıtlar birbirine bağlı bir zincir oluşturur.',
    items: [
      {
        title: 'Zincirleme kayıt',
        desc: 'Her kayıt, bir önceki kaydın özetini de içeren kendi SHA-256 özetiyle saklanır. Bir kaydın işlem türü, kullanıcısı veya zamanı sonradan değiştirilirse ya da zincirin ortasından bir kayıt silinirse zincir bozulur.',
      },
      {
        title: 'Panelden bütünlük kontrolü',
        desc: 'Hastane yöneticisi kurumunun işlem kayıtlarını panelden inceleyebilir ve zincirin tutarlı olup olmadığını tek işlemle kontrol edebilir.',
      },
      {
        title: 'Saklama süresi sonunda silinir',
        desc: 'İşlem kayıtları kurumunuzun belirlediği saklama süresi kadar tutulur ve süre dolunca otomatik olarak silinir.',
      },
    ] satisfies readonly SecurityPoint[],
  },

  kvkk: {
    id: 'kvkk',
    title: 'KVKK süreçleri',
    lead: 'KlinoVax, kurumunuzun KVKK kapsamındaki yükümlülüklerini yerine getirmesini destekleyen akışlar sunar.',
    points: [
      {
        title: 'Başvuru akışı',
        desc: 'Personel; verilerinin işlenip işlenmediğini öğrenme, düzeltme, silme ve itiraz gibi KVKK kapsamındaki taleplerini sistem içinden iletir. Yönetici talebi panelden yanıtlar.',
      },
      {
        title: 'Sürümlü aydınlatma metni',
        desc: 'Aydınlatma metni güncellendiğinde personel yeni metni görür ve onaylamadan panele geçemez.',
      },
      {
        title: 'Saklama ve imha',
        desc: 'Saklama süresini kurumunuz belirler. Süresi dolan pasif personel kayıtları otomatik olarak anonimleştirilir.',
      },
    ] satisfies readonly SecurityPoint[],
    links: [
      { href: '/kvkk', label: 'KVKK aydınlatma metni' },
      { href: '/data-retention', label: 'Saklama ve imha politikası' },
      { href: '/privacy', label: 'Gizlilik politikası' },
    ],
  },

  hosting: {
    id: 'barindirma',
    title: 'Barındırma ve kurulum seçenekleri',
    lead: 'Verinizin nerede duracağına siz karar verirsiniz.',
    options: [
      {
        title: 'Bulut sürümü',
        desc: 'Uygulama, veritabanı ve dosya depolaması Avrupa Birliği içinde, Frankfurt bölgesinde çalışır. Sunucu kurmanız veya bakımını yapmanız gerekmez.',
      },
      {
        title: 'Kurum içi kurulum',
        desc: 'Verisini kendi sunucusunda tutmak isteyen kurumlar için platform, kurumunuzun altyapısına kurulabilir. Bu durumda veriler kurumunuzun sunucusunda kalır.',
      },
    ] satisfies readonly SecurityPoint[],
  },

  integrity: {
    id: 'sinav-butunlugu',
    title: 'Sınav ve eğitim kayıtlarının bütünlüğü',
    lead: 'Bir eğitimin tamamlandığını gösteren kayıt, eğitimin gerçekten tamamlandığını yansıtmalıdır. Bu kontroller tarayıcıda değil sunucuda yapılır.',
    points: [
      {
        title: 'Sunucuda tutulan sınav süresi',
        desc: 'Sayfayı yenilemek veya cihaz saatini değiştirmek süreyi uzatmaz. Süre dolunca sınav otomatik olarak sonlanır.',
      },
      {
        title: 'İleri sarma kapalı',
        desc: 'Personel videonun izlemediği bölümüne atlayamaz. Geri sarıp tekrar izlemek serbesttir.',
      },
      {
        title: 'Sunucuda doğrulanan izleme süresi',
        desc: 'İzleme süresi gerçekte geçen süreyle karşılaştırılır, olağan dışı hızlı artış kabul edilmez. Videonun neredeyse tamamı gerçekten izlenmeden son sınav açılmaz.',
      },
    ] satisfies readonly SecurityPoint[],
  },

  disclosure: {
    id: 'guvenlik-bildirimi',
    title: 'Güvenlik açığı bildirimi',
    lead: 'KlinoVax’ta bir güvenlik açığı bulduğunuzu düşünüyorsanız lütfen ayrıntıları e-postayla bize iletin. Bildiriminizi inceleyip size dönüş yaparız.',
    emailLabel: 'Bildirim adresi',
    note: 'Lütfen açığı, biz inceleyip giderene kadar başkalarıyla paylaşmayın ve başka kullanıcıların verisine erişmeye çalışmayın.',
  },

  closing: {
    title: 'Güvenlik ekibinizle birlikte inceleyelim.',
    lead: 'Bilgi işlem ve KVKK sorumlularınızın sorularını demo görüşmesinde ya da e-postayla cevaplayalım.',
    primaryCta: 'Demo Talep Edin',
    secondaryCta: 'Bize yazın',
  },
} as const
