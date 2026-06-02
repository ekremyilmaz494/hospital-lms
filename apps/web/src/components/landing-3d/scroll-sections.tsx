import Link from "next/link";
import { FeatureStat } from "./feature-stat";

/** Yönetim Merkezi grid'i — sistemdeki tüm admin modülleri (sidebar-config ile birebir). */
const HUB_MODULES: { title: string; desc: string }[] = [
  { title: "Eğitim Sihirbazı", desc: "Video, doküman ve sınavı tek akışta dakikalar içinde oluşturun." },
  { title: "Soru Bankası", desc: "Soruları havuzda toplayın, sınavlarda tekrar tekrar kullanın." },
  { title: "Sınav Otomasyonu", desc: "Ön/son sınav, otomatik geçti-kaldı ve ek hak talebi yönetimi." },
  { title: "Medya Kütüphanesi", desc: "Tüm video ve dokümanlar tek merkezde, güvenli erişimle." },
  { title: "Eğitim Dönemleri", desc: "Periyodik eğitimleri takvime bağlayın, otomatik tekrarlatın." },
  { title: "Personel Yönetimi", desc: "Toplu içe aktarma, rol ve birim ataması, tek tıkla davet." },
  { title: "Sertifikalar", desc: "Otomatik üretim, geçerlilik takibi ve PDF indirme." },
  { title: "Yetkinlik Matrisi", desc: "Kim neyi tamamladı, kimde eksik var — tek bakışta görün." },
  { title: "SMG / SKS Takibi", desc: "Sağlıkta hizmet içi eğitim ve denetim uyumu, hazır raporla." },
  { title: "KVKK Uyum Raporu", desc: "Denetime hazır uyum çıktıları, anında dışa aktarma." },
  { title: "Etkinlik Analizi", desc: "Eğitimin gerçek etkisini ölçün, zayıf noktaları görün." },
  { title: "Geri Bildirim Formları", desc: "Form editörü, yanıt toplama ve analitik tek modülde." },
  { title: "Bildirimler", desc: "Otomatik hatırlatma, duyuru ve son tarih uyarıları." },
  { title: "İşlem Geçmişi (Audit)", desc: "Değiştirilemez kayıt ile tam izlenebilirlik." },
  { title: "Çok-Kurumlu Yönetim", desc: "Tamamen izole veriyle sınırsız kurum, tek platform." },
];

/**
 * Altı scroll section + yatay referans bandı + Yönetim Merkezi grid + footer.
 * Bant, grid ve footer <main> DIŞINDA (ScrollTrigger end "bottom bottom" hesabı
 * bozulmasın). Bölüm metinleri yönetici (hospital admin) anlatısıyla yazıldı.
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
              <a href="#yonetim" className="l3d-link">
                Tüm modüller →
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
          <div className="l3d-copy l3d-copy-right">
            <span className="l3d-eyebrow">EĞİTİM & DEĞERLENDİRME</span>
            <h2 className="l3d-headline-md">
              Siz kurgular,
              <br />
              sistem uygular.
            </h2>
            <p className="l3d-lead">
              Eğitim sihirbazıyla video, doküman ve sınavı dakikalar içinde
              hazırlayın. Soru bankası, ön/son sınav, ileri-sarma kilidi ve
              otomatik geçti-kaldı — personel izlemiş gibi yapamaz, gerçekten
              öğrenir.
            </p>
          </div>
        </section>

        {/* §3 — FRONT + STATS */}
        <section id="kanit" data-section="front" className="l3d-section">
          <div className="l3d-copy l3d-copy-bottom-left">
            <span className="l3d-eyebrow">UYUM & RAPORLAMA</span>
            <h2 className="l3d-headline-md">
              Denetim anına
              <br />
              her zaman hazır.
            </h2>
            <p className="l3d-lead">
              KVKK ve SKS uyum raporları, etkinlik analizi, sertifika
              geçerlilikleri ve değiştirilemez işlem geçmişi — Excel beklemeden,
              tek tıkla.
            </p>
          </div>
          <div className="l3d-stats">
            <FeatureStat label="TAMAMLANAN EĞİTİM" value="12.480" unit="+" />
            <FeatureStat label="BAŞARI ORANI" value="94" unit="%" />
            <FeatureStat label="AKTİF KURUM" value="40" unit="+" />
          </div>
        </section>

        {/* §4 — TOP */}
        <section id="olcek" data-section="top" className="l3d-section">
          <div className="l3d-copy l3d-copy-left">
            <span className="l3d-eyebrow">ÇOK KURUMLU YAPI</span>
            <h2 className="l3d-headline-md">
              Kurumunuzla
              <br />
              birlikte ölçeklenir.
            </h2>
            <p className="l3d-lead">
              Tek hastaneden hastane zincirine. Yetkinlik matrisi, eğitim
              dönemleri ve kurum-bazlı tamamen izole veriyle her şube kendi
              personeli, eğitimi ve raporuyla çalışır.
            </p>
          </div>
        </section>

        {/* §5 — BACK */}
        <section id="erisim" data-section="back" className="l3d-section">
          <div className="l3d-copy l3d-copy-left">
            <span className="l3d-eyebrow">HER YERDEN ERİŞİM</span>
            <h2 className="l3d-headline-md">
              Vardiyada, evde,
              <br />
              serviste.
            </h2>
            <p className="l3d-lead">
              Personel eğitimini telefonundan tamamlar, sertifikasını anında
              indirir. Yönetici canlı ilerlemeyi, bildirimleri ve geri bildirim
              sonuçlarını panelden gerçek zamanlı izler.
            </p>
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

      {/* Yönetim Merkezi — sistemdeki tüm admin modülleri */}
      <section id="yonetim" className="l3d-hub" aria-label="Yönetim Merkezi">
        <div className="l3d-hub-head">
          <span className="l3d-eyebrow">YÖNETİM MERKEZİ</span>
          <h2 className="l3d-final-title">Tek panelde tüm sistem.</h2>
          <p className="l3d-lead l3d-hub-lead">
            Eğitimden denetime, personelden sertifikaya — hastane eğitiminin her
            adımı tek yönetim panelinde.
          </p>
        </div>
        <ul className="l3d-hub-grid">
          {HUB_MODULES.map((m) => (
            <li key={m.title} className="l3d-hub-card">
              <span className="l3d-hub-card-title">{m.title}</span>
              <span className="l3d-hub-card-desc">{m.desc}</span>
            </li>
          ))}
        </ul>
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
