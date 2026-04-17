/**
 * Category-specific illustrations for the Features section.
 * Each SVG is a distinct visual metaphor tuned to its category.
 * Brand palette only — no stock, no emoji.
 */

const BRAND = "#0d9668";
const BRAND_LIGHT = "#6dba92";
const BRAND_50 = "#ecfdf5";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";
const CREAM = "#f5f0e6";

type IllProps = { className?: string };

/** Video Eğitimler — Video player with frames + progress + waveform */
export function VideoTrainingIllustration({ className }: IllProps) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden>
      <defs>
        <linearGradient id="vid-screen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={DARK} />
          <stop offset="100%" stopColor="#0d2010" />
        </linearGradient>
        <radialGradient id="vid-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity="0.3" />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow behind */}
      <circle cx="200" cy="130" r="130" fill="url(#vid-glow)" />

      {/* Ghost frames — stacked behind */}
      <rect x="30" y="60" width="280" height="150" rx="14" fill={DARK} opacity="0.08" transform="rotate(-3 170 135)" />
      <rect x="40" y="50" width="280" height="150" rx="14" fill={DARK} opacity="0.15" transform="rotate(-1.5 180 125)" />

      {/* Main video frame */}
      <g>
        <rect x="50" y="40" width="280" height="150" rx="14" fill="url(#vid-screen)" />
        <rect x="50" y="40" width="280" height="150" rx="14" fill="none" stroke={BRAND_LIGHT} strokeOpacity="0.2" />

        {/* Video content mock — abstract scene */}
        <circle cx="140" cy="100" r="24" fill={BRAND} opacity="0.4" />
        <rect x="170" y="90" width="120" height="6" rx="3" fill={BRAND_LIGHT} opacity="0.6" />
        <rect x="170" y="104" width="80" height="5" rx="2.5" fill={BRAND_LIGHT} opacity="0.35" />

        {/* Play button */}
        <circle cx="190" cy="150" r="22" fill="white" fillOpacity="0.95" />
        <path d="M 184,141 L 184,159 L 201,150 Z" fill={DARK} />

        {/* Progress bar */}
        <rect x="70" y="175" width="240" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
        <rect x="70" y="175" width="164" height="3" rx="1.5" fill={BRAND}>
          <animate attributeName="width" values="50;164;220;50" dur="6s" repeatCount="indefinite" />
        </rect>
        <circle cx="234" cy="176.5" r="4.5" fill={BRAND_LIGHT}>
          <animate attributeName="cx" values="120;234;290;120" dur="6s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* 1080p badge */}
      <g transform="translate(300, 55)">
        <rect x="-22" y="-10" width="44" height="20" rx="10" fill={ACCENT} />
        <text x="0" y="5" textAnchor="middle" fill={DARK} fontSize="10" fontWeight="900">
          1080p
        </text>
      </g>

      {/* Waveform below */}
      <g transform="translate(50, 220)">
        {Array.from({ length: 28 }).map((_, i) => {
          const h = 4 + Math.abs(Math.sin(i * 0.5)) * 18;
          return (
            <rect
              key={i}
              x={i * 10}
              y={-h / 2}
              width="4"
              height={h}
              rx="2"
              fill={BRAND}
              opacity={0.35 + (i % 4) * 0.15}
            >
              <animate
                attributeName="height"
                values={`${h};${h * 0.3};${h}`}
                dur={`${1 + (i % 3) * 0.4}s`}
                repeatCount="indefinite"
              />
            </rect>
          );
        })}
      </g>
    </svg>
  );
}

/** Sınav Sistemi — Question card with options + checkmarks + timer */
export function ExamIllustration({ className }: IllProps) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden>
      <defs>
        <radialGradient id="exam-glow" cx="60%" cy="40%" r="60%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.2" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="100" r="130" fill="url(#exam-glow)" />

      {/* Stacked cards behind */}
      <rect x="60" y="52" width="230" height="145" rx="16" fill="white" opacity="0.6" transform="rotate(-4 175 124)" />
      <rect x="55" y="48" width="230" height="145" rx="16" fill="white" opacity="0.8" transform="rotate(-2 170 120)" />

      {/* Main question card */}
      <g>
        <rect x="50" y="40" width="230" height="160" rx="16" fill="white" stroke={DARK} strokeOpacity="0.08" />

        {/* Header bar */}
        <rect x="66" y="56" width="60" height="10" rx="5" fill={BRAND_LIGHT} opacity="0.5" />
        <rect x="246" y="52" width="22" height="18" rx="9" fill={ACCENT} />
        <text x="257" y="65" textAnchor="middle" fill={DARK} fontSize="9" fontWeight="900">3/5</text>

        {/* Question text lines */}
        <rect x="66" y="82" width="180" height="8" rx="4" fill={DARK} opacity="0.8" />
        <rect x="66" y="96" width="140" height="8" rx="4" fill={DARK} opacity="0.4" />

        {/* Options */}
        {[
          { y: 118, correct: false, selected: false },
          { y: 140, correct: true, selected: true },
          { y: 162, correct: false, selected: false },
        ].map((opt, i) => (
          <g key={i}>
            <rect
              x="66"
              y={opt.y}
              width="200"
              height="16"
              rx="8"
              fill={opt.correct ? BRAND : CREAM}
              fillOpacity={opt.correct ? 0.12 : 0.8}
              stroke={opt.correct ? BRAND : "transparent"}
              strokeWidth={opt.correct ? 1.5 : 0}
            />
            <circle
              cx="78"
              cy={opt.y + 8}
              r="5"
              fill={opt.correct ? BRAND : "white"}
              stroke={opt.correct ? BRAND : DARK}
              strokeOpacity={opt.correct ? 1 : 0.2}
              strokeWidth="1.5"
            />
            {opt.correct && (
              <path
                d={`M 75,${opt.y + 8} L 77,${opt.y + 10} L 81,${opt.y + 6}`}
                stroke="white"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <rect x="90" y={opt.y + 5} width="120" height="6" rx="3" fill={DARK} opacity={opt.correct ? 0.85 : 0.4} />
          </g>
        ))}
      </g>

      {/* Timer circle top-right */}
      <g transform="translate(330, 80)">
        <circle cx="0" cy="0" r="32" fill="white" stroke={DARK} strokeOpacity="0.08" strokeWidth="1" />
        <circle
          cx="0"
          cy="0"
          r="28"
          fill="none"
          stroke={BRAND}
          strokeWidth="3.5"
          strokeDasharray="175.9"
          strokeDashoffset="70"
          strokeLinecap="round"
          transform="rotate(-90)"
        >
          <animate attributeName="stroke-dashoffset" values="175.9;40;175.9" dur="8s" repeatCount="indefinite" />
        </circle>
        <text x="0" y="4" textAnchor="middle" fill={DARK} fontSize="14" fontWeight="900" fontFamily="ui-monospace, monospace">
          45
        </text>
      </g>

      {/* Floating correct mark */}
      <g transform="translate(55, 215)">
        <circle cx="0" cy="0" r="14" fill={BRAND} />
        <path d="M -5,0 L -1,4 L 6,-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Raporlama — Bar chart + trend line + data points */
export function ReportsIllustration({ className }: IllProps) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden>
      <defs>
        <linearGradient id="rep-bar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={BRAND_LIGHT} />
          <stop offset="100%" stopColor={BRAND} />
        </linearGradient>
        <linearGradient id="rep-area" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid background */}
      <g stroke={DARK} strokeOpacity="0.06" strokeWidth="1">
        {[60, 100, 140, 180].map((y) => (
          <line key={y} x1="40" y1={y} x2="380" y2={y} strokeDasharray="2 4" />
        ))}
      </g>

      {/* Bars */}
      {[
        { x: 60, h: 60, label: "P" },
        { x: 100, h: 95, label: "S" },
        { x: 140, h: 80, label: "Ç" },
        { x: 180, h: 120, label: "P" },
        { x: 220, h: 105, label: "C" },
        { x: 260, h: 140, label: "C" },
        { x: 300, h: 125, label: "P" },
      ].map((bar, i) => (
        <g key={i}>
          <rect
            x={bar.x}
            y={200 - bar.h}
            width="22"
            height={bar.h}
            rx="4"
            fill="url(#rep-bar)"
            opacity="0.9"
          >
            <animate
              attributeName="height"
              values={`0;${bar.h};${bar.h}`}
              dur="1.2s"
              begin={`${i * 0.1}s`}
              repeatCount="1"
              fill="freeze"
            />
            <animate
              attributeName="y"
              values={`200;${200 - bar.h};${200 - bar.h}`}
              dur="1.2s"
              begin={`${i * 0.1}s`}
              repeatCount="1"
              fill="freeze"
            />
          </rect>
          <text
            x={bar.x + 11}
            y="218"
            textAnchor="middle"
            fill={DARK}
            fontSize="9"
            fontWeight="700"
            opacity="0.4"
          >
            {bar.label}
          </text>
        </g>
      ))}

      {/* Trend area under line */}
      <path
        d="M 71,140 L 111,110 L 151,125 L 191,80 L 231,90 L 271,60 L 311,75 L 311,200 L 71,200 Z"
        fill="url(#rep-area)"
      />

      {/* Trend line overlaid */}
      <path
        d="M 71,140 L 111,110 L 151,125 L 191,80 L 231,90 L 271,60 L 311,75"
        stroke={ACCENT}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="400"
        strokeDashoffset="400"
      >
        <animate attributeName="stroke-dashoffset" values="400;0" dur="1.8s" begin="0.4s" repeatCount="1" fill="freeze" />
      </path>

      {/* Data points */}
      {[
        { x: 71, y: 140 },
        { x: 111, y: 110 },
        { x: 151, y: 125 },
        { x: 191, y: 80 },
        { x: 231, y: 90 },
        { x: 271, y: 60 },
        { x: 311, y: 75 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={ACCENT} strokeWidth="2">
            <animate
              attributeName="r"
              values="0;4;4"
              dur="0.4s"
              begin={`${1.8 + i * 0.1}s`}
              repeatCount="1"
              fill="freeze"
            />
          </circle>
        </g>
      ))}

      {/* Peak highlight */}
      <g transform="translate(271, 60)">
        <circle r="10" fill={ACCENT} opacity="0.3">
          <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Legend */}
      <g transform="translate(40, 36)">
        <rect width="80" height="20" rx="10" fill={DARK} fillOpacity="0.06" />
        <circle cx="11" cy="10" r="4" fill={BRAND} />
        <text x="22" y="14" fill={DARK} fontSize="10" fontWeight="700">Tamamlanan</text>
      </g>
      <g transform="translate(130, 36)">
        <rect width="70" height="20" rx="10" fill={DARK} fillOpacity="0.06" />
        <circle cx="11" cy="10" r="4" fill={ACCENT} />
        <text x="22" y="14" fill={DARK} fontSize="10" fontWeight="700">Trend</text>
      </g>
    </svg>
  );
}

/** Sertifikalar — Certificate with ribbon + QR code + award */
export function CertificatesIllustration({ className }: IllProps) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden>
      <defs>
        <linearGradient id="cert-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="100%" stopColor="#faecc6" />
        </linearGradient>
        <radialGradient id="cert-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.3" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="130" r="130" fill="url(#cert-glow)" />

      {/* Certificate back layer (tilted) */}
      <g transform="rotate(-8 200 135)">
        <rect x="75" y="55" width="250" height="160" rx="10" fill="white" opacity="0.6" />
      </g>

      {/* Certificate front */}
      <g transform="rotate(3 200 135)">
        <rect x="65" y="45" width="270" height="170" rx="12" fill="url(#cert-bg)" stroke={ACCENT} strokeOpacity="0.3" />

        {/* Inner frame */}
        <rect x="75" y="55" width="250" height="150" rx="6" fill="none" stroke={ACCENT} strokeOpacity="0.4" strokeWidth="1" />

        {/* Corner marks */}
        {[
          { cx: 85, cy: 65 },
          { cx: 315, cy: 65 },
          { cx: 85, cy: 195 },
          { cx: 315, cy: 195 },
        ].map((c, i) => (
          <rect key={i} x={c.cx - 8} y={c.cy - 8} width="16" height="16" rx="2" fill="none" stroke={ACCENT} opacity="0.5" />
        ))}

        {/* "SERTIFIKA" label */}
        <text x="200" y="88" textAnchor="middle" fill={BRAND} fontSize="9" fontWeight="900" letterSpacing="3">
          BAŞARI SERTİFİKASI
        </text>

        {/* Name */}
        <rect x="140" y="102" width="120" height="10" rx="5" fill={DARK} opacity="0.9" />

        {/* Subject lines */}
        <rect x="120" y="122" width="160" height="5" rx="2.5" fill={DARK} opacity="0.4" />
        <rect x="150" y="134" width="100" height="4" rx="2" fill={DARK} opacity="0.3" />

        {/* Signature line */}
        <line x1="100" y1="180" x2="160" y2="180" stroke={DARK} strokeOpacity="0.3" />
        <path d="M 105,178 Q 115,170 125,178 Q 135,172 145,178" stroke={DARK} fill="none" strokeWidth="1.5" strokeLinecap="round" />

        {/* QR code mock */}
        <g transform="translate(235, 160)">
          <rect x="0" y="0" width="50" height="50" rx="4" fill="white" stroke={DARK} strokeOpacity="0.15" />
          {Array.from({ length: 49 }).map((_, i) => {
            const row = Math.floor(i / 7);
            const col = i % 7;
            const seed = (i * 7 + i % 5) % 3;
            const isFinder = (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2);
            return (
              <rect
                key={i}
                x={4 + col * 6}
                y={4 + row * 6}
                width="5"
                height="5"
                fill={isFinder || seed === 0 ? DARK : "transparent"}
                rx="0.5"
              />
            );
          })}
        </g>
      </g>

      {/* Ribbon medal top-left */}
      <g transform="translate(85, 70)">
        <path d="M -10,-12 L 10,-12 L 14,22 L 0,14 L -14,22 Z" fill={ACCENT} opacity="0.9" />
        <circle cx="0" cy="-8" r="16" fill={ACCENT} stroke="white" strokeWidth="2" />
        <path d="M -7,-4 L -2,1 L 7,-8" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Floating sparkles */}
      {[
        { cx: 50, cy: 50, r: 4 },
        { cx: 355, cy: 90, r: 5 },
        { cx: 370, cy: 200, r: 3 },
        { cx: 30, cy: 180, r: 4 },
      ].map((s, i) => (
        <g key={i}>
          <circle cx={s.cx} cy={s.cy} r={s.r} fill={ACCENT}>
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  );
}

/** Bildirimler — Bell with ripple waves + floating notification chips */
export function NotificationsIllustration({ className }: IllProps) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden>
      <defs>
        <radialGradient id="not-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity="0.25" />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="not-bell" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={BRAND} />
          <stop offset="100%" stopColor={DARK} />
        </linearGradient>
      </defs>

      <circle cx="200" cy="130" r="140" fill="url(#not-glow)" />

      {/* Ripple waves behind bell */}
      {[50, 75, 100].map((r, i) => (
        <circle
          key={r}
          cx="200"
          cy="130"
          r={r}
          fill="none"
          stroke={BRAND_LIGHT}
          strokeOpacity="0.3"
          strokeWidth="1.5"
        >
          <animate
            attributeName="r"
            values={`${r};${r + 25};${r}`}
            dur="2.5s"
            begin={`${i * 0.3}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-opacity"
            values="0.3;0;0.3"
            dur="2.5s"
            begin={`${i * 0.3}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Bell body */}
      <g transform="translate(200, 130)">
        <path
          d="M -30,-20 C -30,-40 -18,-55 0,-55 C 18,-55 30,-40 30,-20 L 30,5 L 38,20 L -38,20 L -30,5 Z"
          fill="url(#not-bell)"
        />
        {/* Top knob */}
        <circle cx="0" cy="-58" r="5" fill={DARK} />
        {/* Clapper */}
        <circle cx="0" cy="28" r="7" fill={ACCENT} />

        {/* Shine */}
        <path
          d="M -18,-30 C -18,-40 -10,-48 0,-48"
          stroke="white"
          strokeOpacity="0.5"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Badge count */}
        <g transform="translate(24, -42)">
          <circle cx="0" cy="0" r="11" fill="#e11d48" />
          <text x="0" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="system-ui">
            5
          </text>
        </g>
      </g>

      {/* Floating notification chips */}
      <g transform="translate(60, 60)">
        <rect x="0" y="0" width="110" height="34" rx="17" fill="white" stroke={DARK} strokeOpacity="0.1" />
        <circle cx="17" cy="17" r="8" fill={BRAND} />
        <path d="M 14,17 L 16,19 L 21,14" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="30" y="11" width="60" height="4" rx="2" fill={DARK} opacity="0.7" />
        <rect x="30" y="20" width="40" height="3" rx="1.5" fill={DARK} opacity="0.35" />
      </g>

      <g transform="translate(260, 170)">
        <rect x="0" y="0" width="105" height="34" rx="17" fill="white" stroke={DARK} strokeOpacity="0.1" />
        <circle cx="17" cy="17" r="8" fill={ACCENT} />
        <text x="17" y="21" textAnchor="middle" fill={DARK} fontSize="11" fontWeight="900">!</text>
        <rect x="30" y="11" width="55" height="4" rx="2" fill={DARK} opacity="0.7" />
        <rect x="30" y="20" width="42" height="3" rx="1.5" fill={DARK} opacity="0.35" />
      </g>

      <g transform="translate(280, 45)">
        <rect x="0" y="0" width="95" height="30" rx="15" fill={DARK} />
        <circle cx="15" cy="15" r="6" fill={BRAND_LIGHT}>
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        </circle>
        <rect x="26" y="10" width="55" height="4" rx="2" fill="white" opacity="0.85" />
        <rect x="26" y="18" width="38" height="3" rx="1.5" fill="white" opacity="0.45" />
      </g>

      <g transform="translate(40, 180)">
        <rect x="0" y="0" width="90" height="30" rx="15" fill={DARK} fillOpacity="0.88" />
        <circle cx="15" cy="15" r="6" fill={ACCENT} />
        <rect x="26" y="10" width="50" height="4" rx="2" fill="white" opacity="0.85" />
        <rect x="26" y="18" width="32" height="3" rx="1.5" fill="white" opacity="0.45" />
      </g>
    </svg>
  );
}

/** Güvenlik — Shield with lock + scanning beams + keys */
export function SecurityIllustration({ className }: IllProps) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden>
      <defs>
        <linearGradient id="sec-shield" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={BRAND} />
          <stop offset="100%" stopColor={DARK} />
        </linearGradient>
        <radialGradient id="sec-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity="0.35" />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="130" r="120" fill="url(#sec-glow)" />

      {/* Radar scan sweep */}
      <g transform="translate(200, 130)">
        {[45, 70, 95].map((r, i) => (
          <circle
            key={r}
            cx="0"
            cy="0"
            r={r}
            fill="none"
            stroke={BRAND_LIGHT}
            strokeOpacity="0.2"
            strokeWidth="1"
            strokeDasharray={i % 2 === 0 ? "4 6" : ""}
          />
        ))}
        {/* Sweeping beam */}
        <path
          d="M 0,0 L 90,0 A 90,90 0 0 1 63.6,63.6 Z"
          fill={BRAND_LIGHT}
          opacity="0.15"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0;360"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* Shield body */}
      <g transform="translate(200, 135)">
        <path
          d="M 0,-65 L 55,-35 L 55,25 C 55,55 30,78 0,88 C -30,78 -55,55 -55,25 L -55,-35 Z"
          fill="url(#sec-shield)"
          stroke={BRAND_LIGHT}
          strokeOpacity="0.3"
        />

        {/* Shield shine */}
        <path
          d="M -25,-45 L -25,15"
          stroke="white"
          strokeOpacity="0.25"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Lock body */}
        <g transform="translate(0, 15)">
          <rect x="-18" y="-4" width="36" height="30" rx="4" fill={ACCENT} />
          {/* Lock shackle */}
          <path
            d="M -10,-4 L -10,-16 A 10,10 0 0 1 10,-16 L 10,-4"
            fill="none"
            stroke={ACCENT}
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Keyhole */}
          <circle cx="0" cy="8" r="3" fill={DARK} />
          <rect x="-1" y="8" width="2" height="8" fill={DARK} />
        </g>

        {/* KVKK badge center-top */}
        <g transform="translate(0, -30)">
          <rect x="-24" y="-8" width="48" height="16" rx="8" fill={ACCENT} fillOpacity="0.95" />
          <text x="0" y="4" textAnchor="middle" fill={DARK} fontSize="9" fontWeight="900" letterSpacing="1">
            KVKK
          </text>
        </g>
      </g>

      {/* Floating key */}
      <g transform="translate(90, 85) rotate(-25)">
        <circle cx="0" cy="0" r="11" fill="none" stroke={BRAND} strokeWidth="3" />
        <circle cx="0" cy="0" r="4" fill={BRAND} />
        <rect x="9" y="-2.5" width="28" height="5" fill={BRAND} />
        <rect x="27" y="2.5" width="4" height="7" fill={BRAND} />
        <rect x="33" y="2.5" width="4" height="5" fill={BRAND} />
      </g>

      {/* Floating key 2 */}
      <g transform="translate(310, 180) rotate(15)">
        <circle cx="0" cy="0" r="10" fill="none" stroke={DARK} strokeWidth="3" />
        <circle cx="0" cy="0" r="3" fill={DARK} />
        <rect x="8" y="-2" width="24" height="4" fill={DARK} />
        <rect x="24" y="2" width="3" height="6" fill={DARK} />
      </g>

      {/* Scanning dots */}
      {[
        { cx: 65, cy: 50 },
        { cx: 340, cy: 60 },
        { cx: 60, cy: 210 },
        { cx: 335, cy: 215 },
      ].map((d, i) => (
        <g key={i}>
          <circle cx={d.cx} cy={d.cy} r="3" fill={BRAND}>
            <animate attributeName="opacity" values="1;0.2;1" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  );
}
