import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMetadata } from '@/lib/site-metadata'
import { PageHead } from '@/components/site/page-head'
import { FAQ_TR } from '@/components/site/content/faq.tr'
import './sss.css'

export const metadata: Metadata = pageMetadata({
  title: 'Sık Sorulan Sorular',
  description:
    'Hastane eğitim yönetim sistemi KlinoVax hakkında sorular: eğitim akışı, sınav, sertifika, kurulum, KVKK ve mobil uygulama.',
  path: '/sss',
})

/**
 * SSS: konulara ayrılmış yerel `<details>` listesi. Cevaplar sunucu HTML'inde,
 * JS olmadan açılır ve arama motorlarınca okunur.
 */
export default function FaqPage() {
  const c = FAQ_TR
  return (
    <>
      <PageHead breadcrumbPath="/sss" overline={c.head.overline} title={c.head.title} lead={c.head.lead} />

      <div className="s-container s-page-body">
        <div className="s-legal">
          <nav className="s-toc" aria-label="Soru konuları">
            <p className="s-toc-title">{c.tocTitle}</p>
            <ol>
              {c.groups.map((group) => (
                <li key={group.id}>
                  <a href={`#${group.id}`}>{group.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="sss-groups">
            {c.groups.map((group) => (
              <section key={group.id} className="sss-group" aria-labelledby={group.id}>
                <h2 id={group.id} className="s-h2 sss-group-title">
                  {group.title}
                </h2>
                <div className="s-faq-list">
                  {group.items.map((item) => (
                    <details key={item.q} className="s-faq-item">
                      <summary>
                        <h3>{item.q}</h3>
                        <span className="s-faq-icon" aria-hidden="true" />
                      </summary>
                      <p>
                        {item.a}
                        {'link' in item && item.link && (
                          <>
                            {' '}
                            <Link href={item.link.href}>{item.link.label}</Link>.
                          </>
                        )}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <section className="s-closing sss-closing" aria-labelledby="sss-kapanis">
          <div className="s-closing-panel">
            <h2 id="sss-kapanis" className="s-h2">
              {c.closing.title}
            </h2>
            <p className="s-lead">{c.closing.lead}</p>
            <div className="s-cta-row">
              <Link href="/demo" className="s-btn s-btn-primary">
                {c.closing.primaryCta}
              </Link>
              <Link href="/iletisim" className="s-btn s-btn-ghost">
                {c.closing.secondaryCta}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
