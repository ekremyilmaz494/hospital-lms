import { ShieldCheck } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import LoginAutomationFlow from './LoginAutomationFlow';

/* Landing paletiyle birebir — deep olive zemin, krem metin, emerald + amber vurgu.
   Token referansı: tokens.css → --landing-*. Burada inline sabit kullanılıyor çünkü
   panel koyu zeminde ters renk kullanır (krem metin) ve --landing-* açık tema içindir. */
const CREAM = '#f4f1e1';
const CREAM_SOFT = 'rgba(244, 241, 225, 0.66)';
const CREAM_FAINT = 'rgba(244, 241, 225, 0.42)';
const MINT = '#6dba92';
const AMBER = '#f59e0b';

/**
 * Login sol panel — landing-3d sıcak editöryel tasarım diliyle.
 * Yalnızca lg+ ekranda görünür (page.tsx'te `hidden lg:flex` aside içinde).
 *
 * Merkez görsel: "Eğitimi yükleyin, gerisi otomatik" hikâyesini ANLATAN animasyonlu
 * otomasyon illüstrasyonu (LoginAutomationFlow). İçerik crisp DOM/SVG — üretken video
 * değil; anlam net, marka renkleri, kusursuz loop, ağ maliyeti ~0.
 */
export default function LoginBrandPanel() {
  return (
    <div className="lbp-root">
      <style>{`
        .lbp-root {
          position: absolute;
          inset: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 18px;
          padding: clamp(30px, 3vw, 48px) clamp(40px, 4vw, 60px);
          color: ${CREAM};
          background:
            radial-gradient(120% 80% at 12% 6%, #1f4631 0%, transparent 52%),
            linear-gradient(158deg, #1a3a28 0%, #142d1f 56%, #1a3a28 100%);
        }
        /* Statik sıcak ışıma — atmosfer (dekoratif) */
        .lbp-glow {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(38% 28% at 82% 10%, rgba(245,158,11,0.13), transparent 70%),
            radial-gradient(44% 34% at 14% 88%, rgba(13,150,104,0.16), transparent 72%);
        }
        .lbp-dots {
          position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: 0.3;
          background-image: radial-gradient(rgba(244,241,225,0.10) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(110% 90% at 50% 30%, #000 30%, transparent 78%);
          -webkit-mask-image: radial-gradient(110% 90% at 50% 30%, #000 30%, transparent 78%);
        }

        /* ── Üst: marka ── */
        .lbp-brand { display: flex; align-items: center; gap: 11px; }
        .lbp-brand-dot {
          width: 9px; height: 9px; border-radius: 9999px; background: ${AMBER};
          box-shadow: 0 0 14px ${AMBER}aa;
        }
        .lbp-wordmark {
          font-family: var(--font-display); font-weight: 800; font-size: 25px;
          letter-spacing: -0.01em; color: ${CREAM}; line-height: 1;
        }
        .lbp-eyebrow {
          font-family: var(--font-mono); font-size: 10px; font-weight: 500;
          letter-spacing: 0.34em; text-transform: uppercase; color: ${MINT};
          margin-top: 7px; padding-left: 20px;
        }

        /* ── Orta: başlık + lead + illüstrasyon (metinle birlikte ortalı) ── */
        .lbp-mid {
          position: relative; z-index: 2;
          text-align: center;
        }
        .lbp-headline {
          font-family: var(--font-display); font-weight: 700;
          font-size: clamp(32px, 3.1vw, 48px); line-height: 1.07;
          letter-spacing: -0.03em; color: ${CREAM}; margin: 0;
        }
        .lbp-headline em {
          font-family: var(--font-editorial); font-style: italic; font-weight: 500;
          color: ${AMBER}; letter-spacing: -0.01em;
        }
        .lbp-lead {
          margin: 16px auto 0; font-family: var(--font-body); font-size: 14.5px;
          line-height: 1.55; color: ${CREAM_SOFT}; max-width: 44ch;
        }
        .lbp-art { margin-top: 20px; text-align: center; }

        /* ── Alt: güven + footer ── */
        .lbp-foot { position: relative; z-index: 2; }
        .lbp-trust { display: flex; flex-wrap: wrap; gap: 10px; }
        .lbp-pill {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 9999px;
          background: rgba(244, 241, 225, 0.07);
          border: 1px solid rgba(244, 241, 225, 0.16);
          font-family: var(--font-display); font-size: 11.5px; font-weight: 600;
          color: ${CREAM_SOFT}; backdrop-filter: blur(6px);
        }
        .lbp-rule { height: 1px; background: rgba(244, 241, 225, 0.14); margin: 20px 0 14px; }
        .lbp-copy {
          display: flex; justify-content: space-between; align-items: center;
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.22em;
          text-transform: uppercase; color: ${CREAM_FAINT};
        }
        .lbp-copy strong { color: ${MINT}; font-weight: 500; }
      `}</style>

      <div className="lbp-glow" aria-hidden="true" />
      <div className="lbp-dots" aria-hidden="true" />

      {/* ── Üst: marka kimliği ── */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div className="lbp-brand">
          <span className="lbp-brand-dot" />
          <span className="lbp-wordmark">{BRAND.name}</span>
        </div>
        <div className="lbp-eyebrow">Eğitim Platformu</div>
      </div>

      {/* ── Orta: hook + otomasyon illüstrasyonu ── */}
      <div className="lbp-mid">
        <h1 className="lbp-headline">
          Eğitimi yükleyin,<br />gerisi <em>otomatik.</em>
        </h1>
        <p className="lbp-lead">
          Tek işiniz eğitimi yüklemek — sınav, atama, sertifika ve raporu yapay zekâ
          sizin için üretir.
        </p>
        <div className="lbp-art">
          <LoginAutomationFlow />
        </div>
      </div>

      {/* ── Alt: güven rozeti + footer ── */}
      <div className="lbp-foot">
        <div className="lbp-trust">
          <span className="lbp-pill">
            <ShieldCheck size={14} strokeWidth={2} style={{ color: MINT }} />
            KVKK Uyumlu
          </span>
        </div>
        <div className="lbp-rule" />
        <div className="lbp-copy">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <strong>{BRAND.fullName}</strong>
        </div>
      </div>
    </div>
  );
}
