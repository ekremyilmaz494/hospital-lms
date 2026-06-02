import Link from "next/link";
import { FeatureStat } from "./feature-stat";

type Module = { title: string; desc: string };

// Modüller temaya göre 4 sinematik bölüme dağıtılır (3D model o bölümdeyken
// ilgili modüller yanında belirir). Tek-blok "Yönetim Merkezi" grid'i kaldırıldı.
const MODULES_EGITIM: Module[] = [
  { title: "Eğitim Sihirbazı", desc: "Video, doküman ve sınav tek akışta." },
  { title: "Soru Bankası", desc: "Havuzda topla, sınavlarda tekrar kullan." },
  { title: "Sınav Otomasyonu", desc: "Ön/son sınav, otomatik geçti-kaldı." },
  { title: "Medya Kütüphanesi", desc: "Tüm içerik tek merkezde, güvenli erişim." },
  { title: "Eğitim Dönemleri", desc: "Periyodik eğitimi takvime bağla, tekrarlat." },
];
const MODULES_UYUM: Module[] = [
  { title: "KVKK Uyum Raporu", desc: "Denetime hazır çıktı, anında dışa aktar." },
  { title: "SMG / SKS Takibi", desc: "Hizmet içi eğitim ve denetim uyumu." },
  { title: "Etkinlik Analizi", desc: "Eğitimin gerçek etkisini ölç, zayıfı gör." },
  { title: "Sertifikalar", desc: "Otomatik üretim, geçerlilik takibi, PDF." },
  { title: "İşlem Geçmişi (Audit)", desc: "Değiştirilemez kayıt, tam izlenebilirlik." },
];
const MODULES_KURUM: Module[] = [
  { title: "Personel Yönetimi", desc: "Toplu içe aktarma, rol ve birim ataması." },
  { title: "Yetkinlik Matrisi", desc: "Kim neyi tamamladı, kimde eksik var." },
  { title: "Çok-Kurumlu Yönetim", desc: "Tamamen izole veriyle sınırsız kurum." },
];
const MODULES_ERISIM: Module[] = [
  { title: "Mobil Uygulama", desc: "Eğitimi telefondan tamamla, sertifikayı indir." },
  { title: "Bildirimler", desc: "Otomatik hatırlatma, duyuru, son tarih uyarısı." },
  { title: "Geri Bildirim Formları", desc: "Form editörü, yanıt toplama, analitik." },
];

// Tam genişlik "platform" showcase bandı (sinematik akıştan sonra, telefonsuz alan).
const SHOWCASE: { img: string; title: string; desc: string }[] = [
  {
    img: "/landing-3d/egitim.svg",
    title: "Eğitim & Sınav",
    desc: "Video, doküman ve otomatik sınavı tek akışta oluştur, ata, ölç.",
  },
  {
    img: "/landing-3d/erisim.svg",
    title: "Mobil Erişim",
    desc: "Personel telefonundan tamamlar; yönetici canlı ilerlemeyi izler.",
  },
  {
    img: "/landing-3d/sertifika.svg",
    title: "Sertifika & Başarı",
    desc: "Otomatik sertifika üretimi, geçerlilik takibi ve PDF indirme.",
  },
];

/** Bölüm kopyasının içine gömülen editöryel modül listesi (hairline + check ikon). */
function ModuleList({ items }: { items: Module[] }) {
  return (
    <ul className="l3d-modules">
      {items.map((m) => (
        <li key={m.title} className="l3d-module">
          <svg
            className="l3d-module-ico"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
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
          <div className="l3d-copy l3d-copy-hero">
            <span className="l3d-eyebrow" data-hero-text>
              PERSONELİNİZ HER ZAMAN
            </span>
            <h1 className="l3d-headline" data-hero-text>
              Hazır.
            </h1>
            <p className="l3d-lead" data-hero-text>
              Eğitimi siz oluşturun, personele atayın; ileri-sarmasız video ve
              otomatik sınavla ölçün, sertifikalandırın ve denetime hazır
              raporlayın — hepsi tek yönetim panelinde.
            </p>
            <div className="l3d-cta-row" data-hero-text>
              <Link href="/demo" className="l3d-cta">
                Demo Talep Et
              </Link>
              <a href="#egitim" className="l3d-link">
                Modülleri keşfet →
              </a>
            </div>
            <div className="l3d-trust" data-hero-text>
              <span className="l3d-trust-label">GÜVENİYOR</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/devakent.png"
                alt="Özel Konya Devakent Hastanesi"
                className="l3d-trust-logo"
              />
            </div>
          </div>
          <div className="l3d-scroll-cue" aria-hidden="true">
            <span>Keşfetmek için kaydırın</span>
            <span className="l3d-scroll-cue-line" />
          </div>
        </section>

        {/* §2 — CLOSEUP */}
        <section id="egitim" data-section="closeup" className="l3d-section">
          <div className="l3d-copy l3d-copy-right l3d-step">
            <span className="l3d-step-num">01</span>
            <span className="l3d-eyebrow">EĞİTİM & DEĞERLENDİRME</span>
            <h2 className="l3d-headline-md">
              Siz kurgular,
              <br />
              sistem uygular.
            </h2>
            <p className="l3d-lead">
              Eğitim sihirbazıyla video, doküman ve sınavı dakikalar içinde
              hazırlayın. İleri-sarma kilidi ve otomatik geçti-kaldı — personel
              izlemiş gibi yapamaz, gerçekten öğrenir.
            </p>
            <ModuleList items={MODULES_EGITIM} />
          </div>
        </section>

        {/* §3 — FRONT + STATS */}
        <section id="kanit" data-section="front" className="l3d-section">
          <div className="l3d-copy l3d-copy-left l3d-step">
            <span className="l3d-step-num">02</span>
            <span className="l3d-eyebrow">UYUM & RAPORLAMA</span>
            <h2 className="l3d-headline-md">
              Denetim anına
              <br />
              her zaman hazır.
            </h2>
            <p className="l3d-lead">
              Uyum raporları, etkinlik analizi, sertifika geçerlilikleri ve
              değiştirilemez işlem geçmişi — Excel beklemeden, tek tıkla.
            </p>
            <ModuleList items={MODULES_UYUM} />
          </div>
          <div className="l3d-stats">
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
          <div className="l3d-copy l3d-copy-left l3d-step">
            <span className="l3d-step-num">03</span>
            <span className="l3d-eyebrow">KURUM & PERSONEL</span>
            <h2 className="l3d-headline-md">
              Kurumunuzla
              <br />
              birlikte ölçeklenir.
            </h2>
            <p className="l3d-lead">
              Tek hastaneden hastane zincirine. Kurum-bazlı tamamen izole veriyle
              her şube kendi personeli, eğitimi ve raporuyla çalışır.
            </p>
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
          <div className="l3d-copy l3d-copy-left l3d-step">
            <span className="l3d-step-num">04</span>
            <span className="l3d-eyebrow">ERİŞİM & İLETİŞİM</span>
            <h2 className="l3d-headline-md">
              Vardiyada, evde,
              <br />
              serviste.
            </h2>
            <p className="l3d-lead">
              Personel eğitimini telefonundan tamamlar, sertifikasını anında
              indirir. Yönetici canlı ilerlemeyi ve geri bildirimi panelden
              gerçek zamanlı izler.
            </p>
            <ModuleList items={MODULES_ERISIM} />
          </div>
        </section>

        {/* §6 — FINAL */}
        <section id="demo-cta" data-section="final" className="l3d-section">
          <div className="l3d-copy l3d-copy-final">
            <span className="l3d-eyebrow">{"KLİNOVAX'I DENEYİN"}</span>
            <h2 className="l3d-final-title">
              Canlı
              <br />
              3D
              <br />
              <span className="l3d-final-pill">demo</span>
            </h2>
            <Link href="/demo" className="l3d-cta">
              Demo Talep Et
            </Link>
          </div>
        </section>
      </main>

      {/* Platform showcase — tam genişlik, 3 büyük illüstrasyon kartı */}
      <section className="l3d-showcase" aria-label="Platform">
        <div className="l3d-showcase-head">
          <span className="l3d-eyebrow">PLATFORM</span>
          <h2 className="l3d-showcase-title">Tek platform, uçtan uca.</h2>
        </div>
        <ul className="l3d-showcase-grid">
          {SHOWCASE.map((c) => (
            <li key={c.title} className="l3d-showcase-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.img}
                alt=""
                aria-hidden="true"
                className="l3d-showcase-img"
              />
              <span className="l3d-showcase-card-title">{c.title}</span>
              <span className="l3d-showcase-card-desc">{c.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Yatay referans bandı — bölümler arası geçişte tam genişlik şerit */}
      <section className="l3d-trustband" aria-label="Referanslar">
        <span className="l3d-trustband-label">GÜVENİYOR</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/devakent.png"
          alt="Özel Konya Devakent Hastanesi"
          className="l3d-trustband-logo"
        />
        <span className="l3d-trustband-name">Özel Konya Devakent Hastanesi</span>
        <span className="l3d-trustband-sep" aria-hidden="true">
          ·
        </span>
        <span className="l3d-trustband-tag">
          Sağlık kurumlarının uçtan uca eğitim tercihi
        </span>
      </section>

      <footer className="l3d-footer">
        <div className="l3d-footer-brand-col">
          <span className="l3d-footer-brand">© KlinoVax · Eğitim Platformu</span>
          <span className="l3d-footer-credit">
            3D model: MajdyModels · CC BY 4.0
          </span>
        </div>
        <nav className="l3d-footer-links">
          <Link href="/privacy">Gizlilik</Link>
          <Link href="/kvkk">KVKK</Link>
          <Link href="/terms">Kullanım Şartları</Link>
          <Link href="/contact">İletişim</Link>
        </nav>
      </footer>
    </>
  );
}
