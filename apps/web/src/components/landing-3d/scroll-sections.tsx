import Link from 'next/link';
import { FeatureStat } from './feature-stat';
import { Footer } from './footer';

type Module = { title: string; desc: string };

// Modüller temaya göre 4 sinematik bölüme dağıtılır (3D model o bölümdeyken
// ilgili modüller yanında belirir). Tek-blok "Yönetim Merkezi" grid'i kaldırıldı.
const MODULES_EGITIM: Module[] = [
  { title: 'Eğitim Sihirbazı', desc: 'Video, doküman ve sınav tek akışta.' },
  { title: 'Soru Bankası', desc: 'Havuzda topla, sınavlarda tekrar kullan.' },
  { title: 'Sınav Otomasyonu', desc: 'Ön/son sınav, otomatik geçti-kaldı.' },
  { title: 'Medya Kütüphanesi', desc: 'Tüm içerik tek merkezde, güvenli erişim.' },
  { title: 'Eğitim Dönemleri', desc: 'Periyodik eğitimi takvime bağla, tekrarlat.' },
];
const MODULES_UYUM: Module[] = [
  { title: 'KVKK Uyum Raporu', desc: 'Denetime hazır çıktı, anında dışa aktar.' },
  { title: 'SMG / SKS Takibi', desc: 'Hizmet içi eğitim ve denetim uyumu.' },
  { title: 'Etkinlik Analizi', desc: 'Eğitimin gerçek etkisini ölç, zayıfı gör.' },
  { title: 'Sertifikalar', desc: 'Otomatik üretim, geçerlilik takibi, PDF.' },
  { title: 'İşlem Geçmişi (Audit)', desc: 'Değiştirilemez kayıt, tam izlenebilirlik.' },
];
const MODULES_KURUM: Module[] = [
  { title: 'Personel Yönetimi', desc: 'Toplu içe aktarma; birim ve role göre düzenleme.' },
  { title: 'Yetkinlik Matrisi', desc: 'Kim neyi tamamladı, kimde eksik var — tek tabloda.' },
  { title: 'Toplu Eğitim Atama', desc: 'Yüzlerce personele role göre tek tıkla atama.' },
];
const MODULES_ERISIM: Module[] = [
  { title: 'Mobil Uygulama', desc: 'Eğitimi telefondan tamamla, sertifikayı indir.' },
  { title: 'Bildirimler', desc: 'Otomatik hatırlatma, duyuru, son tarih uyarısı.' },
  { title: 'Geri Bildirim Formları', desc: 'Form editörü, yanıt toplama, analitik.' },
];

// Tam genişlik "platform" showcase bandı (sinematik akıştan sonra, telefonsuz alan).
const SHOWCASE: { img: string; title: string; desc: string }[] = [
  {
    img: '/landing-3d/egitim.svg',
    title: 'Eğitim & Sınav',
    desc: 'Video, doküman ve otomatik sınavı tek akışta oluştur, ata, ölç.',
  },
  {
    img: '/landing-3d/showcase-mobil.svg',
    title: 'Mobil Erişim',
    desc: 'Personel telefonundan tamamlar; yönetici canlı ilerlemeyi izler.',
  },
  {
    img: '/landing-3d/sertifika.svg',
    title: 'Sertifika & Başarı',
    desc: 'Otomatik sertifika üretimi, geçerlilik takibi ve PDF indirme.',
  },
];

// §5 sağ alan — KlinoVax'ı sıradan LMS'lerden ayıran farklar (küçük spot illüstrasyon).
const DIFFERENTIATORS: { img: string; title: string; desc: string }[] = [
  {
    img: '/landing-3d/diff-video.svg',
    title: 'İleri-sarma kilidi',
    desc: 'Personel videoyu atlayamaz; gerçek izleme süresi ölçülür.',
  },
  {
    img: '/landing-3d/diff-rapor.svg',
    title: 'Denetime hazır uyum',
    desc: 'KVKK, SKS ve hizmet içi eğitim raporları tek tıkla.',
  },
  {
    img: '/landing-3d/diff-saglik.svg',
    title: 'Sağlığa özel',
    desc: 'Hastane iş akışına göre tasarım; verileriniz tamamen izole.',
  },
];

// Sık sorulan sorular (sayfa altı, native <details> akordeon).
const FAQ: { q: string; a: string }[] = [
  {
    q: 'KlinoVax tam olarak nedir?',
    a: 'Hastane, klinik ve eczaneler için uçtan uca personel eğitim ve sınav platformudur. Eğitim oluşturma, atama, video izleme, sınav, sertifika ve denetim raporlamasını tek panelde toplar.',
  },
  {
    q: 'Kurulum ve personel aktarımı ne kadar sürer?',
    a: 'Kurulum için sunucu yönetimi gerekmez; bulut tabanlıdır. Personeli Excel ile toplu içe aktarabilir, birim ve rollere göre dakikalar içinde eğitim atamaya başlayabilirsiniz.',
  },
  {
    q: 'Verilerimiz güvende mi? KVKK uyumlu mu?',
    a: 'Evet. Her kurumun verisi tamamen izole edilir; veriler şifreli saklanır ve tüm kritik işlemler değiştirilemez şekilde kayda alınır. KVKK ve hizmet içi eğitim denetimlerine hazır raporlar üretilir.',
  },
  {
    q: 'Mevcut eğitim içeriklerimizi yükleyebilir miyiz?',
    a: 'Evet. Video ve dokümanlarınızı medya kütüphanesine yükleyip eğitim akışlarınıza ekleyebilir, soru bankasıyla kendi sınavlarınızı oluşturabilirsiniz.',
  },
  {
    q: 'Personel eğitimleri telefondan tamamlayabilir mi?',
    a: 'Evet. Personel eğitimi mobil cihazından izleyip sınavını olur, sertifikasını anında indirir. Videolarda ileri sarma kapalıdır; gerçek izleme süresi ölçülür.',
  },
  {
    q: 'Birden fazla hastane/şube yönetebilir miyiz?',
    a: 'Evet. Çok-kurumlu yapıda her şube kendi personeli, eğitimi ve raporuyla tamamen ayrı çalışır; tümünü tek yönetim panelinden izleyebilirsiniz.',
  },
];

/** Bölüm kopyasının içine gömülen editöryel modül listesi (hairline + check ikon). */
function ModuleList({ items }: { items: Module[] }) {
  return (
    <ul className="l3d-modules">
      {items.map((m) => (
        <li key={m.title} className="l3d-module">
          <svg className="l3d-module-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="l3d-module-text">
            <span className="l3d-module-title">{m.title}</span>
            <span className="l3d-module-desc">{m.desc}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Altı scroll section + yatay referans bandı + footer. Footer <main> DIŞINDA
 * (ScrollTrigger end "bottom bottom" hesabı bozulmasın). 4 özellik bölümü (01–04)
 * numaralı adım + dikey çizgi ile bağlanır; her bölüme temasına göre modüller dağıtılır.
 */
export function ScrollSections() {
  return (
    <>
      <main className="l3d-main">
        {/* §1 — HERO */}
        <section id="hero" data-section="hero" className="l3d-section">
          <div className="l3d-copy l3d-copy-hero l3d-reveal">
            <span className="l3d-eyebrow" data-hero-text>
              HASTANELER İÇİN EĞİTİM PLATFORMU
            </span>
            <h1 className="l3d-headline" data-hero-text>
              Her zaman
              <br />
              hazır.
            </h1>
            <p className="l3d-lead" data-hero-text>
              Zorunlu eğitimleri oluşturun, personele atayın ve tamamlanmayı otomatik izleyin.
              Video, sınav, sertifika ve denetim raporu — hepsi tek panelde.
            </p>
            <div className="l3d-cta-row" data-hero-text>
              <Link href="/demo" className="l3d-cta">
                Demo Talep Et
              </Link>
              <a href="#egitim" className="l3d-link">
                Modülleri keşfet →
              </a>
            </div>
          </div>
          <div className="l3d-scroll-cue" aria-hidden="true">
            <span>Keşfetmek için kaydırın</span>
            <span className="l3d-scroll-cue-line" />
          </div>
        </section>

        {/* §2 — CLOSEUP */}
        <section id="egitim" data-section="closeup" className="l3d-section">
          <div className="l3d-copy l3d-copy-right l3d-step l3d-reveal">
            <span className="l3d-step-num">01</span>
            <span className="l3d-eyebrow">EĞİTİM YÖNETİMİ</span>
            <h2 className="l3d-headline-md">
              Eğitimi siz tasarlayın,
              <br />
              sistem yürütsün.
            </h2>
            <p className="l3d-lead">
              Video, doküman ve sınavı tek akışta hazırlayın. İleri sarma kapalı, izleme süresi
              gerçek — personel eğitimi gerçekten tamamlar, “izlemiş gibi” yapamaz.
            </p>
            {/* Mobil-only içerik illüstrasyonu (≤768px); masaüstünde display:none */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing-3d/sec-egitim.svg" alt="" aria-hidden="true" className="l3d-section-art" />
            <ModuleList items={MODULES_EGITIM} />
          </div>
        </section>

        {/* §3 — FRONT + STATS */}
        <section id="kanit" data-section="front" className="l3d-section">
          <div className="l3d-copy l3d-copy-left l3d-step l3d-reveal">
            <span className="l3d-step-num">02</span>
            <span className="l3d-eyebrow">UYUM & RAPORLAMA</span>
            <h2 className="l3d-headline-md">
              Denetime
              <br />
              her an hazır.
            </h2>
            <p className="l3d-lead">
              Tamamlanma oranları, sertifika geçerlilikleri ve KVKK uyum raporları tek tıkla.
              Değiştirilemez işlem kayıtlarıyla tam izlenebilirlik.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing-3d/sec-uyum.svg" alt="" aria-hidden="true" className="l3d-section-art" />
            <ModuleList items={MODULES_UYUM} />
          </div>
          <div className="l3d-stats l3d-reveal">
            <FeatureStat label="TAMAMLANAN EĞİTİM" value="12.480" unit="+" />
            <FeatureStat label="BAŞARI ORANI" value="94" unit="%" />
            <FeatureStat label="AKTİF KURUM" value="40" unit="+" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing-3d/uyum.svg"
            alt=""
            aria-hidden="true"
            className="l3d-art l3d-art-uyum"
          />
        </section>

        {/* §4 — TOP */}
        <section id="olcek" data-section="top" className="l3d-section">
          <div className="l3d-copy l3d-copy-left l3d-step l3d-reveal">
            <span className="l3d-step-num">03</span>
            <span className="l3d-eyebrow">PERSONEL YÖNETİMİ</span>
            <h2 className="l3d-headline-md">
              Mesai kaybı
              <br />
              olmadan eğitin.
            </h2>
            <p className="l3d-lead">
              Eğitim için personeli salonda toplamaya, işini bırakıp gelmesini beklemeye gerek yok —
              mesai kaybı olmaz. Herkes kendi vardiyasında tamamlar; siz birim ve role göre toplu
              atar, kimde eksik kaldığını yetkinlik matrisinde tek tabloda görürsünüz.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing-3d/sec-personel.svg" alt="" aria-hidden="true" className="l3d-section-art" />
            <ModuleList items={MODULES_KURUM} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing-3d/kurum.svg"
            alt=""
            aria-hidden="true"
            className="l3d-art l3d-art-kurum"
          />
        </section>

        {/* §5 — BACK */}
        <section id="erisim" data-section="back" className="l3d-section">
          <div className="l3d-copy l3d-copy-left l3d-step l3d-reveal">
            <span className="l3d-step-num">04</span>
            <span className="l3d-eyebrow">MOBİL ERİŞİM</span>
            <h2 className="l3d-headline-md">
              Her yerden,
              <br />
              her cihazdan.
            </h2>
            <p className="l3d-lead">
              Personel eğitimini telefonundan tamamlar, sertifikasını anında indirir. Yöneticiler
              ilerlemeyi ve geri bildirimi gerçek zamanlı görür.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing-3d/sec-erisim.svg" alt="" aria-hidden="true" className="l3d-section-art" />
            <ModuleList items={MODULES_ERISIM} />
          </div>
          {/* Sağ alan — projeyi diğerlerinden ayıran 3 fark, küçük illüstrasyonlarla */}
          <aside className="l3d-diff l3d-reveal" aria-label="KlinoVax farkı">
            <span className="l3d-eyebrow">NEDEN FARKLI</span>
            <h3 className="l3d-diff-title">
              Sıradan bir
              <br />
              LMS değil.
            </h3>
            <ul className="l3d-diff-list">
              {DIFFERENTIATORS.map((d) => (
                <li key={d.title} className="l3d-diff-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.img} alt="" aria-hidden="true" className="l3d-diff-ico" />
                  <span className="l3d-diff-text">
                    <span className="l3d-diff-h">{d.title}</span>
                    <span className="l3d-diff-d">{d.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        {/* §6 — GÜVEN (Devakent referansı; telefon ekranında logo görünür) */}
        <section id="guven" data-section="guven" className="l3d-section">
          <div className="l3d-copy l3d-copy-left l3d-copy-guven l3d-reveal">
            <span className="l3d-eyebrow">REFERANS</span>
            <h2 className="l3d-headline-md">
              Sahada
              <br />
              kullanılıyor.
            </h2>
            <p className="l3d-lead">
              Özel Devakent Hastanesi, personel eğitiminden denetim raporlamasına kadar uçtan uca
              KlinoVax kullanıyor.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing-3d/sec-referans.svg" alt="" aria-hidden="true" className="l3d-section-art" />
            <div className="l3d-trust-row">
              <span className="l3d-trust-label">GÜVENİYOR</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/devakent.png"
                alt="Özel Devakent Hastanesi"
                className="l3d-trust-logo"
              />
              <span className="l3d-trust-name">Özel Devakent Hastanesi</span>
            </div>
          </div>
        </section>
      </main>

      {/* Platform showcase — tam genişlik, 3 büyük illüstrasyon kartı */}
      <section className="l3d-showcase" aria-label="Platform">
        <div className="l3d-showcase-head l3d-reveal">
          <span className="l3d-eyebrow">PLATFORM</span>
          <h2 className="l3d-showcase-title">Tek platform, uçtan uca.</h2>
        </div>
        <ul className="l3d-showcase-grid l3d-reveal">
          {SHOWCASE.map((c) => (
            <li key={c.title} className="l3d-showcase-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt="" aria-hidden="true" className="l3d-showcase-img" />
              <span className="l3d-showcase-card-title">{c.title}</span>
              <span className="l3d-showcase-card-desc">{c.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sık sorulan sorular — native <details> akordeon (client JS gerektirmez) */}
      <section id="sss" className="l3d-faq" aria-label="Sık sorulan sorular">
        <div className="l3d-faq-head l3d-reveal">
          <span className="l3d-eyebrow">SIK SORULAN SORULAR</span>
          <h2 className="l3d-showcase-title">Aklınızdaki sorular</h2>
        </div>
        <ul className="l3d-faq-list l3d-reveal">
          {FAQ.map((f) => (
            <li key={f.q} className="l3d-faq-item">
              <details className="l3d-faq-details">
                <summary className="l3d-faq-q">
                  <span>{f.q}</span>
                  <span className="l3d-faq-icon" aria-hidden="true" />
                </summary>
                <p className="l3d-faq-a">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <Footer />
    </>
  );
}
