import Link from 'next/link'
import { HOME_TR } from '../content/home.tr'

/**
 * SSS: yerel `<details>`; cevaplar sunucu HTML'inde, JS'siz açılır ve arama
 * motorlarınca okunur. FAQPage işaretlemesi bilinçli olarak yok (zengin sonuç vermiyor).
 */
export function Faq() {
  const c = HOME_TR.faq
  return (
    <section id="sss" className="s-section s-section-alt" aria-labelledby="sss-title">
      <div className="s-container s-faq">
        <div className="s-faq-side">
          <h2 id="sss-title" className="s-h2">
            {c.title}
          </h2>
          <p className="s-lead">
            Cevabını bulamadığınız bir soru mu var? <Link href="/iletisim">Bize yazın</Link>.
          </p>
        </div>
        <div className="s-faq-list">
          {c.items.map((item) => (
            <details key={item.q} className="s-faq-item">
              <summary>
                <h3>{item.q}</h3>
                <span className="s-faq-icon" aria-hidden="true" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
