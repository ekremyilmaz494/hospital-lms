import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { PageHead } from '@/components/site/page-head';
import { BRAND } from '@/lib/brand';
import { pageMetadata } from '@/lib/site-metadata';
import { ContactClient } from './contact-client';
import './form-page.css';

export const metadata: Metadata = pageMetadata({
  title: 'İletişim',
  description:
    'Demo, kurulum, KVKK ve teknik sorularınız için KlinoVax\'a e-posta veya telefonla ulaşın.',
  path: '/iletisim',
});

/** `0553 953 06 96` → `tel:05539530696` (yalnız rakam ve baştaki +). */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export default function ContactPage() {
  const { email, phone, city } = BRAND.contact;
  const linkedin = BRAND.founder.linkedin;

  return (
    <>
      <PageHead breadcrumbPath="/iletisim"
        overline="İletişim"
        title="Bize ulaşın"
        lead="Kurulum, kullanım, KVKK veya iş birliğiyle ilgili sorularınızı bu formla iletebilir ya da doğrudan e-posta gönderebilirsiniz."
      />

      <div className="s-container s-page-body">
        <div className="s-formpage">
          <ContactClient />

          <aside className="s-formpage-aside" aria-label="Diğer iletişim yolları">
            <section className="s-formpage-block" aria-labelledby="iletisim-dogrudan">
              <h2 id="iletisim-dogrudan" className="s-h3">
                Doğrudan iletişim
              </h2>
              <ul className="s-formpage-list">
                <li>
                  <span className="s-point-icon" aria-hidden="true">
                    <Mail size={18} />
                  </span>
                  <div>
                    <p className="s-formpage-term">E-posta</p>
                    <p className="s-formpage-value">
                      <a href={`mailto:${email}`} className="s-formpage-link">
                        {email}
                      </a>
                    </p>
                  </div>
                </li>
                {phone && (
                  <li>
                    <span className="s-point-icon" aria-hidden="true">
                      <Phone size={18} />
                    </span>
                    <div>
                      <p className="s-formpage-term">Telefon</p>
                      <p className="s-formpage-value">
                        <a href={telHref(phone)} className="s-formpage-link">
                          {phone}
                        </a>
                      </p>
                    </div>
                  </li>
                )}
                <li>
                  <span className="s-point-icon" aria-hidden="true">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <p className="s-formpage-term">Konum</p>
                    <p className="s-formpage-value">{city}</p>
                  </div>
                </li>
                {linkedin && (
                  <li>
                    <span className="s-point-icon" aria-hidden="true">
                      <UserRound size={18} />
                    </span>
                    <div>
                      <p className="s-formpage-term">LinkedIn</p>
                      <p className="s-formpage-value">
                        <a href={linkedin} className="s-formpage-link" target="_blank" rel="noopener noreferrer">
                          {BRAND.founder.name} profili
                          <span className="sr-only"> (yeni sekmede açılır)</span>
                        </a>
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </section>

            <section className="s-formpage-block s-formpage-rule" aria-labelledby="iletisim-demo">
              <h2 id="iletisim-demo" className="s-h3">
                Demo mu istiyorsunuz?
              </h2>
              <p>
                Platformu hastanenizin eğitim senaryosuyla görmek için demo talep formunu doldurun.
              </p>
              <p>
                <Link href="/demo" className="s-formpage-link">
                  Demo talep formuna gidin
                </Link>
              </p>
            </section>

            <section className="s-formpage-block s-formpage-rule" aria-labelledby="iletisim-kvkk">
              <h2 id="iletisim-kvkk" className="s-h3">
                Kişisel veri talepleri
              </h2>
              <p>
                KVKK kapsamındaki haklarınızı nasıl kullanacağınız ve başvuru kanalı aydınlatma metninde
                açıklanır.
              </p>
              <p>
                <Link href="/kvkk" className="s-formpage-link">
                  KVKK Aydınlatma Metni&apos;ni okuyun
                </Link>
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
