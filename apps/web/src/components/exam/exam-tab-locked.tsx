import Link from 'next/link'
import { MonitorSmartphone } from 'lucide-react'

/**
 * Sınav başka bir sekmede açıkken gösterilen tam ekran bloklama uyarısı.
 *
 * `useExamTabLock` hook'u `status === 'blocked'` döndürdüğünde pre-exam / post-exam
 * sayfaları soru arayüzü yerine bunu render eder — böylece iki sekme aynı soruyu
 * cevaplayıp birbirinin cevabını ezemez.
 */
export function ExamTabLocked() {
  return (
    <div className="etl-root">
      <div className="etl-card">
        <div className="etl-icon">
          <MonitorSmartphone className="h-6 w-6" />
        </div>
        <h1>Sınav başka bir sekmede açık</h1>
        <p>
          Bu sınav şu anda başka bir tarayıcı sekmesinde devam ediyor. Cevaplarının
          karışmasını önlemek için sınava yalnızca tek sekmeden devam edebilirsin.
        </p>
        <p className="etl-hint">
          Sınava devam etmek için diğer sekmeye geç. O sekmeyi kapattıysan, bu sekme
          birkaç saniye içinde otomatik olarak etkinleşir.
        </p>
        <Link href="/staff/my-trainings" className="etl-link">
          ← Eğitimlerime Dön
        </Link>
      </div>
      <style>{`
        .etl-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: var(--ed-cream);
        }
        .etl-card {
          width: 100%;
          max-width: 460px;
          background: #ffffff;
          border: 1px solid var(--ed-rule);
          border-radius: 4px;
          padding: 36px 32px;
          text-align: center;
          box-shadow: 0 12px 40px rgba(10, 10, 10, 0.08);
        }
        .etl-icon {
          width: 56px;
          height: 56px;
          border-radius: 4px;
          margin: 0 auto 18px;
          background: var(--k-warning-bg);
          color: var(--k-warning);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .etl-card h1 {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 22px;
          font-weight: 500;
          color: var(--ed-ink);
          letter-spacing: -0.015em;
          margin: 0 0 10px;
        }
        .etl-card p {
          font-size: 13px;
          line-height: 1.6;
          color: var(--ed-ink-soft);
          margin: 0 0 8px;
        }
        .etl-hint { color: var(--ed-ink); font-weight: 500; }
        .etl-link {
          display: inline-block;
          margin-top: 16px;
          color: var(--ed-ink);
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
        }
        .etl-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}
