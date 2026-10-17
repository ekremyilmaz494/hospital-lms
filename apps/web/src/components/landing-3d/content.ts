/**
 * Ana sayfa (3D landing) metin ve veri sabitleri.
 *
 * `scroll-sections.tsx` yalnızca buradan render eder; metin bütçeleri ve iddia
 * kontrolleri `__tests__/content-budget.test.ts` ile `content-claims.test.ts`
 * tarafından bu dosyaya karşı çalışır.
 *
 * ÖNEMLİ (3D koruması): `<main>` içindeki 6 bölümün her biri ~100vh varsayılır
 * (telefon scroll timeline'ı buna bağlı). Bu yüzden `<main>` metinleri sert
 * karakter bütçelerine tabidir; ayrıntılı içerik yalnızca showcase'ten SONRA gelir.
 * Doğrulanmamış iddia (sahte istatistik, "KVKK uyumlu kılar", "Türkiye'de" vb.)
 * eklenmez.
 */

export type Module = { title: string; desc: string };

type Cta = { label: string; href: string };

/** Karakter bütçeleri — `<main>` içi metinler için SERT üst sınırlar. */
export const BUDGETS = {
  heroLead: 205,
  /** egitim + kanit bölümleri lead. */
  denseLead: 250,
  olcekLead: 400,
  erisimLead: 250,
  guvenLead: 300,
  /** Modül başlığı (tüm bölümler). */
  moduleTitle: 20,
  /** Modül açıklaması: egitim + kanit bölümleri. */
  moduleDescDense: 48,
  /** Modül açıklaması: diğer bölümler. */
  moduleDesc: 70,
  differentiatorDesc: 80,
  statLabel: 18,
  /** egitim + kanit bölümlerindeki modül sayısı (tam). */
  denseModuleCount: 4,
} as const;

// ── <main> bölümleri ───────────────────────────────────────────────

export const HERO = {
  id: 'hero',
  eyebrow: 'HASTANELER İÇİN EĞİTİM PLATFORMU',
  headline: ['Eğitimi yükleyin,', 'gerisi otomatik.'],
  lead: "Eğitiminizi bir kez yükleyin; hatırlatma, sınav, sertifika ve denetim raporlarını KlinoVax yürütsün. Personel, vardiyasını aksatmadan eğitimini web'den veya telefondan tamamlar.",
  primaryCta: { label: 'Demo Talep Et', href: '/demo' } satisfies Cta,
  secondaryCta: { label: 'Modülleri keşfet →', href: '#egitim' } satisfies Cta,
  storesLabel: 'Mobil uygulamayı indirin',
  scrollCue: 'Keşfetmek için kaydırın',
} as const;

export const MODULES = {
  egitim: [
    { title: 'Eğitim Sihirbazı', desc: 'Video, PDF ve ses; taslak olarak kaydedilir.' },
    { title: 'Yapay Zekâ ile Soru', desc: 'İçerikten soru taslağı çıkar, onay sizde.' },
    { title: 'Ön ve Son Sınav', desc: 'Geçme notu, deneme hakkı ve süre sınırı.' },
    { title: 'Soru Bankası', desc: "Excel'den aktarın; sorular karıştırılır." },
  ],
  kanit: [
    { title: 'Uyum Raporu', desc: 'Departman ve eğitim bazında tamamlanma.' },
    { title: 'SKS Belgeleri', desc: 'Katılım çizelgesi ve duyuru formu, PDF.' },
    { title: 'Sertifikalar', desc: 'Sınav geçilince otomatik; QR kodlu PDF.' },
    { title: 'İşlem Kaydı', desc: 'SHA-256 zincirli, bütünlüğü doğrulanabilir.' },
  ],
  olcek: [
    { title: 'Excel ile Aktarım', desc: 'Şablon, önizleme ve geri alma ile toplu aktarım.' },
    { title: 'Hedefli Atama', desc: 'Departman, alt birim veya kişi bazında atayın.' },
    { title: 'Yetkinlik Matrisi', desc: 'Kimin hangi eğitimi tamamladığı tek tabloda.' },
  ],
  erisim: [
    { title: 'Mobil Uygulama', desc: 'Eğitim, sınav, sertifika ve takvim; iOS ve Android.' },
    { title: 'Bildirimler', desc: 'Uygulama içi, e-posta ve anlık; son tarih hatırlatmalı.' },
    { title: 'Geri Bildirim Formu', desc: 'Form editörü, yanıt analizi, PDF/ZIP dışa aktarım.' },
  ],
} as const satisfies Record<string, readonly Module[]>;

export const SECTIONS = {
  egitim: {
    id: 'egitim',
    dataSection: 'closeup',
    step: '01',
    eyebrow: 'EĞİTİM YÖNETİMİ',
    headline: ['Eğitimi siz tasarlayın,', 'sistem yürütsün.'],
    lead: 'Eğitimi video, PDF veya ses olarak sihirbazla hazırlayın; yapay zekâ soru taslağı çıkarsın, onay sizde kalsın. İleri sarma kilitli, izleme süresi sunucuda doğrulanır, personel kaldığı yerden devam eder.',
    art: '/landing-3d/sec-egitim.svg',
  },
  kanit: {
    id: 'kanit',
    dataSection: 'front',
    step: '02',
    eyebrow: 'UYUM & RAPORLAMA',
    headline: ['Denetime', 'her an hazır.'],
    lead: 'Zorunlu eğitimlerin tamamlanmasını departman ve eğitim bazında izleyin; SKS katılım çizelgesini ve duyuru formunu PDF olarak alın. İşlem kayıtları SHA-256 ile zincirlenir, bütünlüğü doğrulanabilir.',
    art: '/landing-3d/sec-uyum.svg',
    sideArt: { src: '/landing-3d/uyum.svg', className: 'l3d-art l3d-art-uyum' },
  },
  olcek: {
    id: 'olcek',
    dataSection: 'top',
    step: '03',
    eyebrow: 'PERSONEL YÖNETİMİ',
    headline: ['Mesai kaybı', 'olmadan eğitin.'],
    lead: 'Personel eğitimini kendi vardiyasında tamamlar; salon planlamak gerekmez. Kadroyu Excel ile önizleyerek aktarın, hatalıysa geri alın; eğitimi departman, alt birim veya kişi bazında atayın. Hatırlatmalar kendiliğinden gider, yetkinlik matrisi eksikleri tek tabloda gösterir.',
    art: '/landing-3d/sec-personel.svg',
    sideArt: { src: '/landing-3d/kurum.svg', className: 'l3d-art l3d-art-kurum' },
  },
  erisim: {
    id: 'erisim',
    dataSection: 'back',
    step: '04',
    eyebrow: 'MOBİL ERİŞİM',
    headline: ['Her yerden,', 'her cihazdan.'],
    lead: 'Personel için iOS ve Android uygulaması: eğitim, sınav, sertifika ve takvim cebinde. Yöneticiler ilerlemeyi web panelinden canlı izler. Bildirimler uygulama içi, e-posta ve anlık olarak ulaşır.',
    art: '/landing-3d/sec-erisim.svg',
  },
  guven: {
    id: 'guven',
    dataSection: 'guven',
    eyebrow: 'REFERANS',
    headline: ['Sahada', 'kullanılıyor.'],
    lead: "Özel Devakent Hastanesi, personel eğitim ve sınav süreçlerini KlinoVax ile yürütüyor. Siz de KlinoVax'ı kurumunuzda 30 gün ücretsiz deneyin.",
    art: '/landing-3d/sec-referans.svg',
    trust: {
      label: 'GÜVENİYOR',
      logo: '/logos/devakent.png',
      logoAlt: 'Özel Devakent Hastanesi',
      name: 'Özel Devakent Hastanesi',
    },
  },
} as const;

/** Kanıt bölümü istatistikleri — yalnızca doğrulanabilir ürün verileri. */
export const STATS: readonly { label: string; value: string; unit?: string }[] = [
  { label: 'RAPOR TÜRÜ', value: '7' },
  { label: 'DOSYA ŞİFRELEME', value: '256', unit: ' bit' },
  { label: 'PLATFORM', value: '3' },
];

/** §erisim sağ alan — "farkımız" bloğu. */
export const DIFFERENTIATORS = {
  ariaLabel: 'KlinoVax farkı',
  eyebrow: 'FARKIMIZ',
  titleLines: ['Neden', 'KlinoVax?'],
  items: [
    {
      img: '/landing-3d/diff-video.svg',
      title: 'İleri sarma kilidi',
      desc: 'Video atlanamaz; izleme süresi sunucuda doğrulanır.',
    },
    {
      img: '/landing-3d/diff-rapor.svg',
      title: 'Denetim belgeleri',
      desc: 'Uyum raporu, SKS çizelgesi ve duyuru formu PDF olarak hazır.',
    },
    {
      img: '/landing-3d/diff-saglik.svg',
      title: 'Sağlığa özel',
      desc: 'Sağlık kurumlarına göre tasarlandı; kurum verileri birbirinden izole.',
    },
  ],
} as const;

// ── <main> SONRASI bantlar ─────────────────────────────────────────

/** Platform showcase (tam genişlik, telefonsuz alan). `.l3d-showcase` ilk eşleşme olmalı. */
export const SHOWCASE = {
  id: 'platform',
  ariaLabel: 'Platform',
  eyebrow: 'PLATFORM',
  title: 'Eğitimden denetime tek platform.',
  cards: [
    {
      img: '/landing-3d/egitim.svg',
      title: 'Eğitim & Sınav',
      desc: 'Eğitimi video, PDF veya ses olarak hazırlayın; departman, alt birim ya da kişi bazında atayın. Ön ve son sınav, geçme notu ve deneme hakkıyla sonuç kendiliğinden belirlenir.',
    },
    {
      img: '/landing-3d/showcase-mobil.svg',
      title: 'Mobil Erişim',
      desc: 'Personel eğitimi iOS ve Android uygulamasından tamamlar, bildirimlerle hatırlatılır. Yöneticiler ilerlemeyi web panelinden izler; canlı sınav takibi de burada yapılır.',
    },
    {
      img: '/landing-3d/sertifika.svg',
      title: 'Sertifika & Başarı',
      desc: 'Sınavı geçen personelin sertifikası otomatik oluşur. Kurum logolu, QR kodlu PDF herkese açık doğrulama sayfasından kontrol edilir; bitiş yaklaşınca hatırlatma gider.',
    },
  ],
} as const;

export const FLOW = {
  id: 'nasil-calisir',
  eyebrow: 'NASIL ÇALIŞIR',
  title: 'Kurulumdan rapora dört adım.',
  lead: 'Sunucu kurmadan, bulut üzerinde başlarsınız. Her adımın sonunda bir sonrakine hazır bir çıktınız olur.',
  steps: [
    {
      title: 'Kurumu hazırlayın',
      desc: 'Logonuzu ve renklerinizi tanımlayın, yöneticileri ekleyin. Personeli Excel şablonuyla önizleyip toplu aktarın; gerekirse işlemi geri alın.',
    },
    {
      title: 'İçeriği yükleyin',
      desc: 'Video, PDF veya sesi sihirbaza ekleyin. Videonun transkripti otomatik çıkar, yapay zekâ soru taslağı önerir; son onay sizde.',
    },
    {
      title: 'Atayın ve hatırlatın',
      desc: 'Eğitimi departman, alt birim veya kişi bazında atayın. Son tarihten önce, son gün ve gecikmede bildirim kendiliğinden gider.',
    },
    {
      title: 'Takip edin ve raporlayın',
      desc: '7 rapor türünü PDF veya Excel olarak alın. SKS belgeleri ve sertifikalar PDF olarak aynı panelde hazırdır.',
    },
  ],
} as const;

export const FEATURE_GROUPS = {
  id: 'ozellikler',
  eyebrow: 'ÖZELLİKLER',
  title: 'Platformun içinde neler var?',
  lead: 'Ayrıntıya bakmak isteyenler için dört başlıkta özellik listesi.',
  groups: [
    {
      title: 'Eğitim & İçerik',
      modules: [
        { title: 'Eğitim Sihirbazı', desc: 'Taslak kaydı; video, PDF ve ses içerik.' },
        { title: 'Otomatik Transkript', desc: 'Videonun metni kendiliğinden çıkarılır.' },
        { title: 'Medya Kütüphanesi', desc: 'Video ve ses içerikleriniz tek yerde.' },
        { title: 'Eğitim Dönemleri', desc: 'Yıllık dönemler (1 Ocak–31 Aralık) kendiliğinden devreder.' },
        { title: 'İleri Sarma Kilidi', desc: 'İzleme süresi sunucuda doğrulanır, ilerleme geri gitmez.' },
      ],
    },
    {
      title: 'Ölçme & Rapor',
      modules: [
        { title: 'Ön ve Son Sınav', desc: 'Varsayılan geçme notu 70, en fazla 3 deneme.' },
        { title: 'Soru Havuzu', desc: 'Soru karıştırma, rastgele havuz ve ek deneme talebi.' },
        { title: 'Yönetim Raporları', desc: 'Genel Özet, Departman, Personel ve Eğitim Bazlı rapor.' },
        { title: 'Analiz Raporları', desc: 'Başarısızlık, Skor Analizi ve Süre Analizi; PDF/Excel.' },
        { title: 'Etkinlik Analizi', desc: 'Ön-son sınav kıyası, öğrenme kazancı ve trend.' },
      ],
    },
    {
      title: 'Yönetim',
      modules: [
        { title: 'Hastane Grupları', desc: 'Grup paneli, birleşik raporlar ve ortak personel.' },
        { title: 'Kurum Markası', desc: 'Logonuzu ve renklerinizi tanımlayın.' },
        { title: 'Yönetici Ekibi', desc: 'Esas Yönetici, ekibine yeni yöneticiler ekler.' },
        { title: 'Toplu Personel Aktarımı', desc: 'Excel şablonu, önizleme ve geri alma.' },
        { title: 'Yetkinlik Matrisi', desc: 'Personel ve eğitim kesişiminde eksikleri görün.' },
      ],
    },
    {
      title: 'Personel Deneyimi',
      modules: [
        { title: 'Mobil Uygulama', desc: "Eğitim, sınav ve sertifika iOS ve Android'de." },
        { title: 'Günlük Mini Test', desc: 'Seri ve rozetlerle alışkanlık kazandırır.' },
        { title: 'Takvim', desc: 'Atanan eğitimler ve son tarihler tek takvimde.' },
        { title: 'Face ID', desc: 'Telefonda hızlı ve güvenli giriş.' },
        { title: 'Sertifika Paylaşımı', desc: 'Sertifikanızı telefondan paylaşın.' },
      ],
    },
  ],
} as const satisfies {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  groups: readonly { title: string; modules: readonly Module[] }[];
};

type SpecItem = { text: string; note?: string };

/** Güvenlik "teknik künye" — mono etiketli spesifikasyon satırları. */
export const SECURITY = {
  id: 'guvenlik',
  eyebrow: 'GÜVENLİK',
  title: 'Teknik künye.',
  lead: 'Bilgi işlem ve satın alma ekiplerinin sorduğu soruların kısa yanıtları, tek sayfada.',
  panelTitle: 'KLİNOVAX · TEKNİK KÜNYE',
  noteLabel: 'TALEP ÜZERİNE',
  rows: [
    { label: 'BARINDIRMA', items: [{ text: 'AB · Frankfurt' }] },
    {
      label: 'ŞİFRELEME',
      items: [
        { text: 'Aktarımda TLS' },
        { text: 'Dosyalarda AES-256' },
        { text: 'T.C. kimlik no ve gizli anahtarlarda AES-256-GCM' },
      ],
    },
    { label: 'YEDEKLEME', items: [{ text: 'Günlük, şifreli ve doğrulanan yedek' }] },
    {
      label: 'İZOLASYON',
      items: [
        { text: 'Satır düzeyi güvenlik (RLS)' },
        { text: 'Her sorguda kurum filtresi' },
      ],
    },
    {
      label: 'ERİŞİM',
      items: [
        { text: '2FA (TOTP + SMS)' },
        { text: 'Güvenilir cihaz' },
        { text: 'IP izin listesi' },
        { text: 'Kuruma özel oturum zaman aşımı' },
        { text: 'Sınavda tek sekme kilidi' },
      ],
    },
    { label: 'İŞLEM KAYDI', items: [{ text: 'SHA-256 zincirli, bütünlüğü doğrulanabilir' }] },
    {
      label: 'KVKK',
      items: [
        { text: 'Veri sahibi başvuru yönetimi' },
        { text: 'Aydınlatma metni onayı' },
        { text: 'Kuruma özel saklama süreleri' },
        { text: 'Kullanıcı verisi silme' },
      ],
    },
    {
      label: 'KURUMSAL',
      items: [
        { text: 'SSO (SAML/OIDC)', note: 'Talep üzerine' },
        { text: 'Kurum içi (on-premise) kurulum', note: 'Talep üzerine' },
      ],
    },
  ] as readonly { label: string; items: readonly SpecItem[] }[],
  footnote: 'KlinoVax, kurumunuzun KVKK süreçlerine destek olur.',
} as const;

export const FAQ = {
  id: 'sss',
  ariaLabel: 'Sık sorulan sorular',
  eyebrow: 'SIK SORULAN SORULAR',
  title: 'Aklınızdaki sorular',
  items: [
    {
      q: 'KlinoVax tam olarak nedir?',
      a: 'Sağlık kurumları için personel eğitim, sınav ve uyum platformudur. Eğitimi yükler, departman, alt birim veya kişi bazında atar; video, sınav, sertifika ve raporları tek panelden yönetirsiniz.',
    },
    {
      q: 'Kurulum, personel aktarımı ve deneme süreci nasıl işler?',
      a: 'Bulut tabanlıdır, sunucu kurmanız gerekmez. Personel listesini Excel şablonuyla önizleyip aktarır, gerekirse işlemi geri alırsınız. Ücretsiz deneme 30 gündür. SSO (SAML/OIDC) ve kurum içi kurulum talep üzerine sunulur.',
    },
    {
      q: 'Verilerimiz güvende mi?',
      a: "Barındırma Frankfurt'ta (AB) yapılır. Dosyalar AES-256, T.C. kimlik numaraları ve gizli anahtarlar AES-256-GCM ile şifrelenir; günlük şifreli yedek alınır. Her kurumun verisi satır düzeyi güvenlik ve kurum filtresiyle ayrılır.",
    },
    {
      q: 'KVKK konusunda nasıl destek veriyorsunuz?',
      a: 'KlinoVax KVKK süreçlerinize destek olur: veri sahibi başvuru yönetimi, aydınlatma metni onayı, kullanıcı verisi silme ve kuruma özel saklama süreleri hazırdır. KVKK kapsamındaki yükümlülükler kurumunuzda kalır.',
    },
    {
      q: 'Mevcut eğitim içeriklerimizi yükleyebilir miyiz?',
      a: 'Evet. Video, PDF ve ses dosyalarınızı eğitim sihirbazıyla yükler, taslağı kaydedip sonra devam edersiniz. Videonun transkripti otomatik çıkar; yapay zekâ içerikten soru taslağı önerir, son onay sizdedir.',
    },
    {
      q: 'Personel eğitimleri telefondan tamamlayabilir mi?',
      a: 'Evet. Personel iOS ve Android uygulamasından eğitimi izler, sınava girer ve sertifikasını paylaşır. Videoda ileri sarma kilitlidir; izleme süresi sunucuda doğrulanır, yarım kalan eğitime kaldığı yerden devam edilir.',
    },
    {
      q: 'Sınav kuralları nasıl belirlenir?',
      a: "Ön ve son sınav tanımlarsınız. Varsayılan geçme notu 70, varsayılan deneme hakkı 3'tür; süre sınırı, soru karıştırma ve rastgele soru havuzu kullanılabilir. Hakkı biten personel ek deneme talep eder, yönetici onaylar.",
    },
    {
      q: 'Sınavı geçemeyen personele ne olur?',
      a: 'Haklarını kullanarak yeniden dener veya ek deneme ister. Başarısız ya da eğitime katılmayan personele ikinci tur olarak yeniden atama yapabilirsiniz. Yenileme süresi tanımlı eğitimlerde ise sertifika süresi dolunca atama, kurumun aktif eğitim dönemi varsa kendiliğinden yeniden açılır ve personele bildirim gider.',
    },
    {
      q: 'Sertifikalar nasıl çalışır?',
      a: 'Sınav geçilince sertifika otomatik oluşur; geçerlilik süresi eğitimin yenileme süresine eşittir. Kurum logolu, QR kodlu PDF herkese açık bir sayfada doğrulanır; bitişten önce hatırlatma gider.',
    },
    {
      q: 'Hangi raporları alabiliriz?',
      a: 'Genel Özet, Departman, Personel, Eğitim Bazlı, Başarısızlık, Skor Analizi ve Süre Analizi olmak üzere 7 rapor türünü PDF veya Excel olarak alırsınız. Etkinlik analizi ön-son sınav kıyasını ve öğrenme kazancını gösterir.',
    },
    {
      q: 'SKS denetim belgeleri hazır mı?',
      a: 'Evet. Eğitim katılım (imza) çizelgesi, eğitim duyuru formu ve sertifikalar PDF olarak üretilir. Uyum raporu zorunlu eğitim durumunu departman ve eğitim bazında gösterir.',
    },
    {
      q: 'Birden fazla hastane veya şube yönetebilir miyiz?',
      a: 'Evet. Hastane gruplarında grup paneli, birleşik raporlar ve hastaneler arası ortak personel kullanılabilir. Grup kurulumunu yalnızca KlinoVax yapar; talebinizi demo görüşmesinde iletebilirsiniz.',
    },
  ],
} as const;

export const FINAL_CTA = {
  title: 'Kurumunuzda 30 gün ücretsiz deneyin.',
  lead: 'Eğitimlerinizi yükleyin, personelinizi aktarın ve sonucu kendi kurumunuzda görün. Demo talebinizi bırakın, size dönelim.',
  primary: { label: 'Demo Talep Et', href: '/demo' } satisfies Cta,
  secondary: { label: 'İletişim', href: '/contact' } satisfies Cta,
} as const;

/** Sayfadaki tüm bölüm id'leri (DOM sırasıyla): önce `<main>`, sonra bantlar. */
export const SECTION_IDS = [
  HERO.id,
  SECTIONS.egitim.id,
  SECTIONS.kanit.id,
  SECTIONS.olcek.id,
  SECTIONS.erisim.id,
  SECTIONS.guven.id,
  SHOWCASE.id,
  FLOW.id,
  FEATURE_GROUPS.id,
  SECURITY.id,
  FAQ.id,
] as const;

/** `<main>` içindeki id'ler (3D timeline bunlara bağlı; DEĞİŞTİRME / EKLEME). */
export const MAIN_SECTION_IDS = SECTION_IDS.slice(0, 6);

/**
 * SSS içeriğinden schema.org `FAQPage` JSON-LD'si üretir.
 *
 * @returns `<script type="application/ld+json">` içine gömülecek JSON string;
 *   `<` karakteri `<` olarak kaçışlanır (`</script>` enjeksiyonuna karşı).
 */
export function faqJsonLd(): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
