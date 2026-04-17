/**
 * Minimal hospital staff at a laptop — taking an online training.
 * Line-art style, transparent background. Animated: eye blinks,
 * hand subtle movement on trackpad, breathing, head sway.
 */

const BRAND = "#0d9668";
const BRAND_LIGHT = "#6dba92";
const BRAND_200 = "#a7f3d0";
const DARK = "#0d2010";
const ACCENT = "#f59e0b";
const CREAM = "#f5f0e6";
const INK = "#f5f0e6"; // main line color on dark bg
const INK_SOFT = "#a7f3d0";

type Props = { className?: string };

export function LearnerIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 420 360"
      className={className}
      role="img"
      aria-label="Bilgisayar başında eğitim gören sağlık personeli"
    >
      <defs>
        <linearGradient id="lrn-screen-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a3a28" />
          <stop offset="100%" stopColor="#052010" />
        </linearGradient>
        <radialGradient id="lrn-screen-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity="0.45" />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Screen glow illuminates the figure */}
      <ellipse cx="210" cy="220" rx="190" ry="50" fill="url(#lrn-screen-glow)" />

      {/* ────────── FIGURE (breathing) ────────── */}
      <g>
        {/* subtle vertical breathing of entire torso+head (every 4s) */}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 0,-1.5; 0,0"
          dur="4s"
          repeatCount="indefinite"
        />

        {/* Torso — simple line scrubs */}
        <path
          d="M 160,230
             C 158,210 165,198 180,196
             L 240,196
             C 255,198 262,210 260,230
             L 268,310
             L 152,310 Z"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Scrub V-neck */}
        <path
          d="M 200,196 L 210,214 L 220,196"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Shoulder accent stripe (minimal brand detail) */}
        <path
          d="M 168,208 L 180,204"
          stroke={BRAND_LIGHT}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Small badge on chest */}
        <rect x="244" y="220" width="10" height="10" rx="2" fill={ACCENT} />
        <path d="M 248,223 L 248,227 M 246,225 L 250,225" stroke={DARK} strokeWidth="1.4" strokeLinecap="round" />

        {/* ── LEFT ARM (static, resting on desk) ── */}
        <path
          d="M 160,230
             C 142,250 140,275 155,293
             L 168,290"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Left hand */}
        <circle cx="170" cy="293" r="7" fill="none" stroke={INK} strokeWidth="2" />

        {/* ── RIGHT ARM (with subtle hand movement) ── */}
        <g>
          {/* small x-wobble for the hand on trackpad */}
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 3,0; -2,0; 1,0; 0,0"
            dur="3.4s"
            repeatCount="indefinite"
          />
          <path
            d="M 260,230
               C 278,250 280,275 265,293
               L 252,290"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right hand — on trackpad */}
          <circle cx="250" cy="293" r="7" fill="none" stroke={INK} strokeWidth="2" />
          {/* tiny finger tap dot */}
          <circle cx="250" cy="293" r="1.5" fill={ACCENT}>
            <animate
              attributeName="opacity"
              values="0;0;1;0;0"
              keyTimes="0;0.4;0.5;0.6;1"
              dur="3.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Neck */}
        <path d="M 203,196 L 203,180 L 217,180 L 217,196" fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />

        {/* ── HEAD ── */}
        <g>
          {/* very subtle head sway (yaw) */}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 210 150; 1 210 150; -1.2 210 150; 0.5 210 150; 0 210 150"
            dur="6s"
            repeatCount="indefinite"
          />

          {/* Head shape */}
          <ellipse cx="210" cy="150" rx="28" ry="34" fill="none" stroke={INK} strokeWidth="2.2" />

          {/* Hair — short top */}
          <path
            d="M 184,145
               C 184,120 200,108 210,108
               C 220,108 236,120 236,145
               C 233,135 225,130 210,130
               C 195,130 187,135 184,145 Z"
            fill={INK}
            opacity="0.85"
          />

          {/* Ponytail small */}
          <path
            d="M 236,142
               C 244,150 244,162 238,172
               L 234,170
               C 238,160 234,150 233,146 Z"
            fill={INK}
            opacity="0.85"
          />

          {/* Ear */}
          <ellipse cx="182" cy="153" rx="3" ry="5" fill="none" stroke={INK} strokeWidth="1.5" />

          {/* ── EYES with blink ── */}
          <g>
            {/* left eye */}
            <ellipse cx="201" cy="151" rx="2.3" ry="2.6" fill={INK}>
              <animate
                attributeName="ry"
                values="2.6;2.6;0.3;2.6;2.6;2.6;0.3;2.6"
                keyTimes="0;0.30;0.32;0.34;0.70;0.72;0.74;1"
                dur="5s"
                repeatCount="indefinite"
              />
            </ellipse>
            {/* right eye */}
            <ellipse cx="219" cy="151" rx="2.3" ry="2.6" fill={INK}>
              <animate
                attributeName="ry"
                values="2.6;2.6;0.3;2.6;2.6;2.6;0.3;2.6"
                keyTimes="0;0.30;0.32;0.34;0.70;0.72;0.74;1"
                dur="5s"
                repeatCount="indefinite"
              />
            </ellipse>
          </g>

          {/* Small eyebrows (concentrated) */}
          <path d="M 197,144 L 205,143" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 215,143 L 223,144" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />

          {/* Subtle smile */}
          <path
            d="M 205,165 Q 210,168 215,165"
            stroke={INK}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Headphones — minimal line */}
          <path
            d="M 183,140 C 180,120 205,110 210,110 C 215,110 240,120 237,140"
            stroke={INK}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          {/* ear cups */}
          <ellipse cx="181" cy="152" rx="4.5" ry="8" fill={INK} />
          <ellipse cx="239" cy="152" rx="4.5" ry="8" fill={INK} />
          {/* brand pulse dot on left cup */}
          <circle cx="181" cy="152" r="1.8" fill={BRAND_LIGHT}>
            <animate
              attributeName="opacity"
              values="1;0.3;1"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </g>

      {/* ────────── LAPTOP ────────── */}
      {/* Laptop base */}
      <path
        d="M 100,320 L 320,320 L 345,340 L 75,340 Z"
        fill="none"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Trackpad line */}
      <rect x="190" y="328" width="40" height="3" rx="1.5" fill={INK_SOFT} opacity="0.4" />

      {/* Laptop screen frame */}
      <rect
        x="112"
        y="218"
        width="196"
        height="104"
        rx="6"
        fill="url(#lrn-screen-grad)"
        stroke={INK}
        strokeWidth="2.2"
      />

      {/* Screen camera dot */}
      <circle cx="210" cy="224" r="1.2" fill={INK_SOFT} opacity="0.5" />

      {/* ────────── SCREEN CONTENT (video playing) ────────── */}
      {/* Video scene background */}
      <rect x="118" y="230" width="184" height="84" rx="3" fill={DARK} />

      {/* Abstract "hospital scene" in video */}
      <ellipse cx="210" cy="268" rx="70" ry="22" fill={BRAND} opacity="0.18" />

      {/* Play button — softly pulsing */}
      <g>
        <circle cx="210" cy="275" r="14" fill={BRAND_LIGHT} opacity="0.25">
          <animate attributeName="r" values="14;18;14" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0.05;0.25" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="210" cy="275" r="10" fill="white" opacity="0.95" />
        <path d="M 207,270 L 207,280 L 215,275 Z" fill={DARK} />
      </g>

      {/* Progress bar */}
      <rect x="128" y="302" width="164" height="3" rx="1.5" fill="rgba(255,255,255,0.12)" />
      <rect x="128" y="302" width="95" height="3" rx="1.5" fill={BRAND_LIGHT}>
        <animate attributeName="width" values="60;95;120;95;60" dur="8s" repeatCount="indefinite" />
      </rect>
      <circle cx="223" cy="303.5" r="3" fill={BRAND_LIGHT}>
        <animate attributeName="cx" values="188;223;248;223;188" dur="8s" repeatCount="indefinite" />
      </circle>

      {/* Top-left mini dots (window chrome) */}
      <circle cx="128" cy="240" r="1.5" fill="#e11d48" opacity="0.6" />
      <circle cx="134" cy="240" r="1.5" fill={ACCENT} opacity="0.6" />
      <circle cx="140" cy="240" r="1.5" fill={BRAND_LIGHT} opacity="0.6" />

      {/* Timestamp */}
      <text
        x="292"
        y="243"
        textAnchor="end"
        fill={BRAND_200}
        fontSize="6"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        02:14 / 05:30
      </text>

      {/* Subtle desk line */}
      <line
        x1="50"
        y1="340"
        x2="390"
        y2="340"
        stroke={INK_SOFT}
        strokeOpacity="0.25"
        strokeWidth="1"
        strokeDasharray="4 8"
      />

      {/* Steam/focus dots above head (subtle "thinking") */}
      <g opacity="0.7">
        <circle cx="250" cy="100" r="2.5" fill={BRAND_LIGHT}>
          <animate attributeName="cy" values="100;92;100" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0.2;0.7" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="258" cy="90" r="2" fill={ACCENT}>
          <animate
            attributeName="cy"
            values="90;82;90"
            dur="3s"
            begin="0.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.2;0.7"
            dur="3s"
            begin="0.6s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="265" cy="78" r="1.5" fill={BRAND_LIGHT}>
          <animate
            attributeName="cy"
            values="78;70;78"
            dur="3s"
            begin="1.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.2;0.7"
            dur="3s"
            begin="1.2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}
