/**
 * Hospital-themed abstract illustrations for training cards.
 * Hand-crafted SVG — not stock, not emoji. Each tuned to its training topic
 * and brand palette (emerald / dark forest / amber).
 */

type IllustrationProps = {
  className?: string;
  accent?: string; // override accent tone per card
};

const BRAND = "#0d9668";
const BRAND_LIGHT = "#6dba92";
const BRAND_200 = "#a7f3d0";
const DARK = "#1a3a28";
const ACCENT = "#f59e0b";

/** Hygiene — flowing water droplets + hand silhouette + soap bubble */
export function HygieneIllustration({ className, accent = ACCENT }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      role="img"
      aria-label="Hijyen ve enfeksiyon kontrolü illüstrasyonu"
    >
      <defs>
        <radialGradient id="hyg-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity="0.35" />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hyg-hand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdf8eb" />
          <stop offset="100%" stopColor={BRAND_200} />
        </linearGradient>
        <linearGradient id="hyg-drop" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor={BRAND} />
        </linearGradient>
      </defs>

      {/* Soft radial glow */}
      <circle cx="200" cy="140" r="150" fill="url(#hyg-glow)" />

      {/* Floating orbital ring */}
      <ellipse
        cx="200"
        cy="150"
        rx="140"
        ry="48"
        fill="none"
        stroke={BRAND_LIGHT}
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="3 6"
      />

      {/* Hand abstracted as organic blob with finger-like curves */}
      <path
        d="M 140,180
           Q 120,150 135,120
           Q 145,90 175,95
           Q 185,70 210,85
           Q 235,75 245,105
           Q 265,105 270,135
           Q 285,155 275,185
           Q 260,215 220,218
           Q 180,222 150,200
           Z"
        fill="url(#hyg-hand)"
        stroke={DARK}
        strokeOpacity="0.1"
        strokeWidth="1"
      />

      {/* Palm highlight */}
      <ellipse cx="205" cy="150" rx="35" ry="25" fill="white" fillOpacity="0.35" />

      {/* Water droplets cascading */}
      {[
        { cx: 140, cy: 80, r: 8, delay: 0 },
        { cx: 170, cy: 55, r: 6, delay: 0.3 },
        { cx: 230, cy: 50, r: 10, delay: 0.6 },
        { cx: 265, cy: 75, r: 7, delay: 0.9 },
        { cx: 295, cy: 130, r: 9, delay: 1.2 },
      ].map((d, i) => (
        <g key={i}>
          <path
            d={`M ${d.cx},${d.cy - d.r} Q ${d.cx + d.r * 0.7},${d.cy - d.r * 0.2} ${d.cx},${d.cy + d.r} Q ${d.cx - d.r * 0.7},${d.cy - d.r * 0.2} ${d.cx},${d.cy - d.r} Z`}
            fill="url(#hyg-drop)"
            opacity="0.85"
          >
            <animate
              attributeName="opacity"
              values="0.85;0.4;0.85"
              dur={`${2 + d.delay}s`}
              repeatCount="indefinite"
              begin={`${d.delay}s`}
            />
          </path>
          <circle cx={d.cx - d.r * 0.3} cy={d.cy - d.r * 0.3} r={d.r * 0.3} fill="white" fillOpacity="0.6" />
        </g>
      ))}

      {/* Soap bubble */}
      <circle cx="290" cy="200" r="22" fill="none" stroke={BRAND_LIGHT} strokeWidth="1.5" />
      <circle cx="285" cy="194" r="6" fill="white" fillOpacity="0.4" />
      <circle cx="295" cy="205" r="3" fill="white" fillOpacity="0.3" />

      {/* Accent pulse dot */}
      <circle cx="115" cy="220" r="5" fill={accent} />
      <circle cx="115" cy="220" r="5" fill={accent} opacity="0.4">
        <animate attributeName="r" values="5;18;5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/** CPR — ECG pulse wave + heart + emergency cross */
export function CprIllustration({ className, accent = ACCENT }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      role="img"
      aria-label="CPR ve acil müdahale illüstrasyonu"
    >
      <defs>
        <linearGradient id="cpr-heart" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="cpr-pulse" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={BRAND} stopOpacity="0" />
          <stop offset="30%" stopColor={BRAND} stopOpacity="0.8" />
          <stop offset="70%" stopColor={BRAND_LIGHT} stopOpacity="1" />
          <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cpr-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow behind heart */}
      <circle cx="200" cy="150" r="120" fill="url(#cpr-glow)" />

      {/* Background grid — monitor screen feel */}
      <g stroke={BRAND_LIGHT} strokeOpacity="0.15" strokeWidth="0.5">
        {[40, 80, 120, 160, 200, 240].map((y) => (
          <line key={`h-${y}`} x1="40" y1={y} x2="360" y2={y} />
        ))}
        {[40, 80, 120, 160, 200, 240, 280, 320].map((x) => (
          <line key={`v-${x}`} x1={x} y1="40" x2={x} y2="260" />
        ))}
      </g>

      {/* ECG pulse line (repeating heartbeat pattern) */}
      <path
        d="M 40,150
           L 80,150  L 90,150  L 100,120 L 110,180 L 120,100 L 130,150
           L 170,150 L 180,150 L 190,120 L 200,180 L 210,100 L 220,150
           L 260,150 L 270,150 L 280,120 L 290,180 L 300,100 L 310,150
           L 360,150"
        fill="none"
        stroke="url(#cpr-pulse)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Scan head — bright vertical line that moves */}
      <line x1="200" y1="60" x2="200" y2="240" stroke={BRAND_LIGHT} strokeWidth="2" opacity="0.5">
        <animate attributeName="x1" values="40;360;40" dur="4s" repeatCount="indefinite" />
        <animate attributeName="x2" values="40;360;40" dur="4s" repeatCount="indefinite" />
      </line>

      {/* Central heart */}
      <g transform="translate(200, 150)">
        <path
          d="M 0,20
             C -24,-4 -40,-16 -28,-36
             C -18,-50 -4,-40 0,-24
             C 4,-40 18,-50 28,-36
             C 40,-16 24,-4 0,20 Z"
          fill="url(#cpr-heart)"
          opacity="0.95"
        >
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.08;1;1.08;1"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </path>

        {/* Shine on heart */}
        <ellipse cx="-10" cy="-20" rx="8" ry="6" fill="white" fillOpacity="0.45" />
      </g>

      {/* Medical cross badge — top-right */}
      <g transform="translate(310, 65)">
        <circle cx="0" cy="0" r="22" fill={accent} />
        <rect x="-10" y="-3" width="20" height="6" fill={DARK} rx="1" />
        <rect x="-3" y="-10" width="6" height="20" fill={DARK} rx="1" />
      </g>

      {/* BPM readout bottom-left */}
      <g transform="translate(55, 245)">
        <rect x="-6" y="-14" width="90" height="22" rx="11" fill={DARK} fillOpacity="0.08" />
        <circle cx="4" cy="-3" r="3" fill="#e11d48">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
        </circle>
        <text x="14" y="0" fill={DARK} fontSize="11" fontWeight="900" fontFamily="ui-monospace,monospace">
          72 BPM
        </text>
      </g>
    </svg>
  );
}

/** Patient Safety — layered abstract figures with protective ring */
export function PatientSafetyIllustration({ className, accent = ACCENT }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      role="img"
      aria-label="Hasta güvenliği illüstrasyonu"
    >
      <defs>
        <linearGradient id="ps-shield" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity="0.25" />
          <stop offset="100%" stopColor={BRAND} stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="ps-center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity="0.4" />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Multiple concentric rings — protective zones */}
      {[140, 115, 90, 65].map((r, i) => (
        <circle
          key={r}
          cx="200"
          cy="150"
          r={r}
          fill="none"
          stroke={BRAND_LIGHT}
          strokeOpacity={0.1 + i * 0.06}
          strokeWidth="1"
          strokeDasharray={i % 2 === 0 ? "4 8" : ""}
        />
      ))}

      {/* Outer rotating arc */}
      <g transform="translate(200,150)">
        <path
          d="M -140,0 A 140,140 0 0 1 140,0"
          fill="none"
          stroke={BRAND}
          strokeOpacity="0.5"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0;360"
            dur="12s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* Shield fill underneath */}
      <path
        d="M 200,70 L 258,100 L 258,160 C 258,190 230,214 200,225 C 170,214 142,190 142,160 L 142,100 Z"
        fill="url(#ps-shield)"
        stroke={BRAND}
        strokeOpacity="0.25"
        strokeWidth="1"
      />

      {/* Center glow */}
      <circle cx="200" cy="150" r="55" fill="url(#ps-center-glow)" />

      {/* Two abstract human figures — carer & patient */}
      {/* Carer (left, taller) */}
      <g transform="translate(180, 150)">
        <circle cx="0" cy="-30" r="14" fill={DARK} />
        <path
          d="M -18,-8 Q -18,-10 -14,-12 L 14,-12 Q 18,-10 18,-8 L 18,26 Q 18,32 12,32 L -12,32 Q -18,32 -18,26 Z"
          fill={DARK}
        />
        {/* Stethoscope */}
        <path
          d="M -6,-10 Q -10,-2 -10,6 L -10,12"
          fill="none"
          stroke={accent}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="-10" cy="14" r="3" fill={accent} />
      </g>

      {/* Patient (right, seated) */}
      <g transform="translate(220, 155)">
        <circle cx="0" cy="-24" r="12" fill={BRAND} />
        <path
          d="M -16,-6 Q -16,-8 -12,-10 L 12,-10 Q 16,-8 16,-6 L 16,22 Q 16,28 10,28 L -10,28 Q -16,28 -16,22 Z"
          fill={BRAND}
          opacity="0.9"
        />
      </g>

      {/* Safety dots — quadrant markers */}
      {[
        { x: 200, y: 20, color: accent },
        { x: 380, y: 150, color: BRAND },
        { x: 200, y: 280, color: BRAND },
        { x: 20, y: 150, color: accent },
      ].map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r="5" fill={d.color} />
          <circle cx={d.x} cy={d.y} r="5" fill={d.color} opacity="0.4">
            <animate
              attributeName="r"
              values="5;14;5"
              dur="3s"
              begin={`${i * 0.4}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.4;0;0.4"
              dur="3s"
              begin={`${i * 0.4}s`}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}

      {/* Checkmark top-center */}
      <g transform="translate(200, 60)">
        <circle cx="0" cy="0" r="16" fill={BRAND} />
        <path
          d="M -7,0 L -2,5 L 8,-5"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
