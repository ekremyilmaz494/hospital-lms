/**
 * Login sol panel — "Eğitimi yükleyin, gerisi otomatik" otomasyon hikâyesini
 * ANLATAN animasyonlu illüstrasyon (tasarlanmış SVG + CSS motion-graphic).
 *
 * Akış: yükleme kartı → akan veri → AI çekirdeği (nabız + parıltı) → buradan
 * otomatik fışkıran 4 çıktı (Sınav · Atama · Sertifika · Rapor). Bağlantılardaki
 * sürekli parçacık akışı "otomatik" hissini verir. Sonsuz, kusursuz loop.
 *
 * Inline SVG → ağ maliyeti yok. `prefers-reduced-motion` → animasyon durur ama
 * diyagram (anlam) okunur kalır. Pure component (client gerektirmez).
 */

const CREAM = '#f4f1e1';
const CREAM_SOFT = 'rgba(244,241,225,0.72)';
const MINT = '#6dba92';
const EMERALD_LT = '#34d399';
const AMBER = '#f59e0b';

/** Çıktı düğümleri — AI çekirdeğinden otomatik üretilenler. */
const OUTPUTS = [
  { cx: 40, label: 'Sınav', dx: -120 },
  { cx: 120, label: 'Atama', dx: -40 },
  { cx: 200, label: 'Sertifika', dx: 40 },
  { cx: 280, label: 'Rapor', dx: 120 },
];

export default function LoginAutomationFlow() {
  return (
    <div className="lf-wrap" aria-hidden="true">
      <style>{`
        .lf-svg { width: 100%; max-width: 430px; height: auto; display: block; margin: 0 auto; overflow: visible; }
        .lf-label { font-family: var(--font-display); font-size: 10px; font-weight: 600; fill: ${CREAM_SOFT}; letter-spacing: 0.01em; }
        .lf-cap { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.26em; fill: ${MINT}; text-transform: uppercase; }

        /* Bağlantı çizgileri — akan kesik çizgi = veri akışı */
        .lf-flow { stroke-dasharray: 3 7; animation: lf-dash 0.9s linear infinite; }
        @keyframes lf-dash { to { stroke-dashoffset: -20; } }

        /* Parçacıklar — çekirdekten çıktılara doğru akış */
        .lf-p { animation-timing-function: cubic-bezier(.5,0,.5,1); animation-iteration-count: infinite; }
        @keyframes lf-up { 0%{transform:translate(0,0);opacity:0} 14%{opacity:1} 86%{opacity:1} 100%{transform:translate(0,58px);opacity:0} }
        @keyframes lf-o0 { 0%{transform:translate(0,0);opacity:0} 14%{opacity:1} 86%{opacity:1} 100%{transform:translate(-120px,61px);opacity:0} }
        @keyframes lf-o1 { 0%{transform:translate(0,0);opacity:0} 14%{opacity:1} 86%{opacity:1} 100%{transform:translate(-40px,61px);opacity:0} }
        @keyframes lf-o2 { 0%{transform:translate(0,0);opacity:0} 14%{opacity:1} 86%{opacity:1} 100%{transform:translate(40px,61px);opacity:0} }
        @keyframes lf-o3 { 0%{transform:translate(0,0);opacity:0} 14%{opacity:1} 86%{opacity:1} 100%{transform:translate(120px,61px);opacity:0} }

        /* AI çekirdeği */
        .lf-spin { transform-box: fill-box; transform-origin: center; animation: lf-spin 16s linear infinite; }
        @keyframes lf-spin { to { transform: rotate(360deg); } }
        .lf-core, .lf-halo, .lf-spark, .lf-ring, .lf-card, .lf-node {
          transform-box: fill-box; transform-origin: center;
        }
        .lf-core { animation: lf-core 3.2s ease-in-out infinite; }
        @keyframes lf-core { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .lf-halo { animation: lf-halo 3.2s ease-in-out infinite; }
        @keyframes lf-halo { 0%,100%{opacity:.4; transform:scale(1)} 50%{opacity:.7; transform:scale(1.14)} }
        .lf-spark { animation: lf-spark 3.2s ease-in-out infinite; }
        @keyframes lf-spark { 0%,100%{transform:scale(.86);opacity:.9} 50%{transform:scale(1.12);opacity:1} }
        .lf-ring { opacity: 0; animation: lf-ring 3.2s ease-out infinite; }
        .lf-ring.b { animation-delay: 1.6s; }
        @keyframes lf-ring { 0%{transform:scale(.95);opacity:.55} 100%{transform:scale(2);opacity:0} }

        /* Yükleme kartı — hafif salınım */
        .lf-card { animation: lf-bob 3.2s ease-in-out infinite; }
        @keyframes lf-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }

        /* Çıktı düğümleri — parçacık varınca "üretildi" parıltısı (staggered) */
        .lf-node { animation: lf-node 1.8s ease-in-out infinite; }
        @keyframes lf-node { 0%,58%,100%{transform:scale(1)} 76%{transform:scale(1.1)} }

        @media (prefers-reduced-motion: reduce) {
          .lf-svg * { animation: none !important; transform: none !important; opacity: 1 !important; }
          .lf-p { opacity: 0 !important; }
        }
      `}</style>

      <svg className="lf-svg" viewBox="0 0 320 336" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ── Bağlantılar (en altta) ── */}
        <g stroke={MINT} strokeWidth="1.4" strokeLinecap="round" opacity="0.5">
          <line className="lf-flow" x1="160" y1="66" x2="160" y2="124" />
          {OUTPUTS.map((o) => (
            <line key={o.label} className="lf-flow" x1="160" y1="191" x2={o.cx} y2="252" />
          ))}
        </g>

        {/* ── Parçacıklar ── */}
        <g>
          <circle className="lf-p" style={{ animation: 'lf-up 1.7s infinite' }} cx="160" cy="66" r="2.6" fill={AMBER} />
          <circle className="lf-p" style={{ animation: 'lf-up 1.7s infinite', animationDelay: '0.85s' }} cx="160" cy="66" r="2.6" fill={EMERALD_LT} />
          {OUTPUTS.map((o, i) => (
            <g key={o.label}>
              <circle className="lf-p" style={{ animation: `lf-o${i} 1.9s infinite`, animationDelay: `${0.3 + i * 0.12}s` }} cx="160" cy="191" r="2.6" fill={i % 2 ? AMBER : EMERALD_LT} />
              <circle className="lf-p" style={{ animation: `lf-o${i} 1.9s infinite`, animationDelay: `${1.25 + i * 0.12}s` }} cx="160" cy="191" r="2.2" fill={MINT} />
            </g>
          ))}
        </g>

        {/* ── Yükleme kartı (eğitim) ── */}
        <g className="lf-card">
          <rect x="128" y="26" width="64" height="42" rx="11" fill="rgba(13,150,104,0.18)" stroke={EMERALD_LT} strokeWidth="1.4" />
          <path d="M153 39 L153 55 L169 47 Z" fill={CREAM} />
          <circle cx="187" cy="28" r="10" fill={AMBER} />
          <path d="M187 33 L187 23 M183 27 L187 23 L191 27" stroke="#1a3a28" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text className="lf-cap" x="160" y="84" textAnchor="middle">Eğitim</text>

        {/* ── AI çekirdeği ── */}
        <g>
          <circle className="lf-halo" cx="160" cy="158" r="50" fill={EMERALD_LT} opacity="0.18" style={{ filter: 'blur(6px)' }} />
          <circle className="lf-ring" cx="160" cy="158" r="33" fill="none" stroke={EMERALD_LT} strokeWidth="1.3" />
          <circle className="lf-ring b" cx="160" cy="158" r="33" fill="none" stroke={AMBER} strokeWidth="1.3" />
          <circle className="lf-spin" cx="160" cy="158" r="44" fill="none" stroke={MINT} strokeWidth="1.1" strokeDasharray="2 9" opacity="0.6" />
          <circle className="lf-core" cx="160" cy="158" r="33" fill="rgba(13,150,104,0.32)" stroke={EMERALD_LT} strokeWidth="1.6" />
          <path className="lf-spark" d="M160 142 L163.4 154.6 L176 158 L163.4 161.4 L160 174 L156.6 161.4 L144 158 L156.6 154.6 Z" fill={CREAM} />
          <circle className="lf-spark" cx="160" cy="158" r="2.4" fill={AMBER} />
        </g>

        {/* ── Otomatik çıktılar ── */}
        {OUTPUTS.map((o) => (
          <g key={o.label}>
            <rect className="lf-node" x={o.cx - 22} y="252" width="44" height="44" rx="13"
              fill="rgba(13,150,104,0.16)" stroke={EMERALD_LT} strokeWidth="1.3"
              style={{ animationDelay: `${0.5 + o.dx * 0.0042 + 0.5}s` }} />
            <g transform={`translate(${o.cx}, 274)`} stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
              {o.label === 'Sınav' && (<>
                <rect x="-8" y="-9.5" width="16" height="19" rx="2.5" />
                <rect x="-4" y="-12.5" width="8" height="4.5" rx="1.2" />
                <path d="M-4 0.5 L-1 3.5 L5 -3.5" />
              </>)}
              {o.label === 'Atama' && (<>
                <circle cx="-4.5" cy="-5" r="3" />
                <circle cx="5" cy="-4" r="2.4" />
                <path d="M-11 9 a6.5 6.5 0 0 1 13 0" />
                <path d="M2.5 7.5 a5.5 5.5 0 0 1 10.5 0" />
              </>)}
              {o.label === 'Sertifika' && (<>
                <circle cx="0" cy="-4" r="6" />
                <path d="M-4 1 L-7 11 L0 7 L7 11 L4 1" />
              </>)}
              {o.label === 'Rapor' && (<>
                <path d="M-9 9 L9 9" strokeWidth="1.3" />
                <path d="M-6 9 L-6 1 M0 9 L0 -4 M6 9 L6 -7" strokeWidth="2.4" />
              </>)}
            </g>
            <text className="lf-label" x={o.cx} y="316" textAnchor="middle">{o.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
