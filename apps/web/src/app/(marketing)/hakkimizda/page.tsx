import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { pageMetadata } from '@/lib/site-metadata'
import { BRAND } from '@/lib/brand'
import { organizationJsonLd } from '@/lib/organization-jsonld'
import { PageHead } from '@/components/site/page-head'
import { FounderCard } from '@/components/site/founder-card'
import { SectionHead } from '@/components/site/home/section-head'

export const metadata: Metadata = pageMetadata({
  title: 'Hakkımızda',
  description:
    'KlinoVax, 2026\'da Konya\'da kurulan, hastane ve sağlık kurumları için personel eğitim ve sınav platformudur. Kurucu: Ekrem Yılmaz.',
  path: '/hakkimizda',
})

/** Platformun yaptığı işler. Her madde ana sayfa metniyle (home.tr.ts) aynı doğrulanmış yeteneğe dayanır. */
const WHAT_WE_DO = [
  {
    title: 'Atama',
    desc: 'Eğitim birime, unvana veya kişiye atanır. Departman kuralı tanımlanırsa yeni gelen personele de otomatik atanır.',
  },
  {
    title: 'İzleme takibi',
    desc: 'Videoda ileri sarma kapalıdır ve izleme süresi sunucuda doğrulanır. Personel yarıda bıraktığı yerden devam eder.',
  },
  {
    title: 'Sınav ve sertifika',
    desc: 'Eğitimden önce ve sonra sınav uygulanır. Geçen personelin sertifikası otomatik üretilir ve QR kodla doğrulanır.',
  },
  {
    title: 'Denetim belgeleri',
    desc: 'Katılım, imza ve sonuçlar denetimde istenen formlara dökülür; uyum raporu birim bazında eksikleri gösterir.',
  },
] as const

export default function AboutPage() {
  const { legal, contact, founder } = BRAND

  return (
    <>
      {/* Statik künye (kullanıcı girdisi yok): şirket doğrulaması için makine-okunur */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd('tr') }} />

      <PageHead breadcrumbPath="/hakkimizda"
        overline="Hakkımızda"
        title="Hastane eğitimini tek bir akışta topluyoruz."
        lead={`${BRAND.name}, hastane ve sağlık kurumları için geliştirilen personel eğitim ve sınav platformudur. Eğitimin atanmasından denetimde istenen belgelere kadar her adım aynı yerde yürür.`}
      />

      <section className="s-container s-page-body" aria-labelledby="neden-title">
        <div className="s-split s-about-intro">
          <div className="s-prose">
            <h2 id="neden-title">{`Neden ${BRAND.name}?`}</h2>
            <p>
              Hastanelerde zorunlu eğitimler düzenli olarak yapılır, ancak kayıtları çoğu zaman dağınık kalır. Katılım kâğıt
              imza föyleriyle, takip Excel listeleriyle, hatırlatma ise telefonla yürür. Denetim yaklaştığında bu
              kayıtları bir araya getirmek, eğitimin kendisinden daha fazla zaman alır.
            </p>
            <p>
              {`${BRAND.name}'ı bu boşluğu kapatmak için geliştirdik. Amacımız, eğitim tamamlandığı anda kaydının da oluşması ve denetimde istenen belgenin hazır olmasıdır. Kurumun işi eğitimi hazırlamaktır; atama, takip, sınav ve belgeleme aynı akışta kendiliğinden ilerler.`}
            </p>
            <p>Personel eğitimlerini web üzerinden ya da iOS ve Android uygulamasından tamamlar.</p>
          </div>
          <FounderCard locale="tr" />
        </div>
      </section>

      <section className="s-section s-section-alt" aria-labelledby="ne-yapiyoruz-title">
        <div className="s-container">
          <SectionHead
            id="ne-yapiyoruz-title"
            title="Ne yapıyoruz"
            lead="Eğitim sürecinin dört adımını tek platformda birleştiriyoruz."
          />
          <ul className="s-rows s-rows-4 s-rows-ruled">
            {WHAT_WE_DO.map((item) => (
              <li key={item.title}>
                <h3 className="s-h3">{item.title}</h3>
                <p>{item.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="s-section s-reference" aria-labelledby="referans-title">
        <div className="s-container s-reference-inner">
          <p className="s-overline">Referans</p>
          <h2 id="referans-title" className="s-h2">
            Sahada kullanılıyor.
          </h2>
          <p className="s-lead">
            {`Özel Devakent Hastanesi, personel eğitiminden denetim belgelerine kadar eğitim sürecini ${BRAND.name} ile yürütüyor.`}
          </p>
          <Image
            src="/logos/devakent.png"
            alt="Özel Devakent Hastanesi"
            width={256}
            height={71}
            className="s-reference-logo"
          />
        </div>
      </section>

      <section className="s-section s-section-alt" aria-labelledby="kunye-title">
        <div className="s-container">
          <SectionHead
            id="kunye-title"
            title="Şirket künyesi"
            lead="Kurumsal bilgilerimiz ve bize doğrudan ulaşabileceğiniz e-posta adresi."
          />
          <dl className="s-facts">
            <div>
              <dt>İşletme adı</dt>
              <dd>{legal.businessName}</dd>
            </div>
            <div>
              <dt>Kuruluş yılı</dt>
              <dd>{legal.foundedYear}</dd>
            </div>
            <div>
              <dt>Konum</dt>
              <dd>{contact.city}</dd>
            </div>
            <div>
              <dt>E-posta</dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </dd>
            </div>
            <div>
              <dt>Kurucu</dt>
              <dd>
                {founder.linkedin ? (
                  <a href={founder.linkedin} target="_blank" rel="noopener noreferrer">
                    {`${founder.name} (LinkedIn)`}
                  </a>
                ) : (
                  founder.name
                )}
              </dd>
            </div>
          </dl>
          <div className="s-cta-row">
            <Link href="/demo" className="s-btn s-btn-primary">
              Demo Talep Edin
            </Link>
            <Link href="/iletisim" className="s-btn s-btn-ghost">
              İletişim
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
