/**
 * Login sağ panel — landing-3d/contact tasarım diliyle flat dekoratif motifler.
 * Kartın etrafındaki boş alanı (lg+) profesyonelce doldurur: güvenlik + marka
 * temalı küçük şekiller (kalkan, parıltı, rozet, sertifika), emerald/amber dolgu +
 * dark-forest ink kontur. Konumlar INLINE % (chunk-bağımsız), yalnız lg+ görünür.
 */

const INK = '#1a3a28';
const EMERALD = '#0d9668';
const AMBER = '#f59e0b';
const CREAM = '#f4f1e1';

const ShieldCheck = () => (
  <svg viewBox="0 0 40 46" fill="none" className="h-full w-full">
    <path d="M20 2 36 8 V22 C36 33 28 41 20 44 12 41 4 33 4 22 V8 Z" fill={EMERALD} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M13 22 l5 5 9-11" fill="none" stroke={CREAM} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Sparkle = () => (
  <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
    <path d="M16 2 19 13 30 16 19 19 16 30 13 19 2 16 13 13Z" fill={AMBER} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const PlusBadge = () => (
  <svg viewBox="0 0 40 40" fill="none" className="h-full w-full">
    <circle cx="20" cy="20" r="17" fill={EMERALD} stroke={INK} strokeWidth="2.4" />
    <path d="M20 11v18M11 20h18" stroke={CREAM} strokeWidth="4" strokeLinecap="round" />
  </svg>
);
const Award = () => (
  <svg viewBox="0 0 36 46" fill="none" className="h-full w-full">
    <path d="M11 24 7 44 18 37 29 44 25 24" fill={AMBER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <circle cx="18" cy="15" r="13" fill={AMBER} stroke={INK} strokeWidth="2.4" />
    <circle cx="18" cy="15" r="5.5" fill={CREAM} />
  </svg>
);
const Doc = () => (
  <svg viewBox="0 0 36 44" fill="none" className="h-full w-full">
    <path d="M6 4h16l8 8v28a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M22 4v8h8" fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M11 24h14M11 31h10" stroke={EMERALD} strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
const Trail = () => (
  <svg viewBox="0 0 90 48" fill="none" className="h-full w-full">
    <path d="M4 42Q34 2 86 14" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 11" />
  </svg>
);

type Spot = { node: React.ReactNode; style: React.CSSProperties };

const SPOTS: Spot[] = [
  // Üst bant
  { node: <ShieldCheck />, style: { top: '13%', left: '7%', width: '48px', transform: 'rotate(-8deg)' } },
  { node: <Sparkle />, style: { top: '8%', left: '21%', width: '24px' } },
  { node: <Sparkle />, style: { top: '12%', right: '9%', width: '22px' } },
  { node: <Doc />, style: { top: '24%', right: '6%', width: '38px', transform: 'rotate(7deg)', opacity: 0.92 } },
  // Orta yanlar
  { node: <PlusBadge />, style: { top: '47%', left: '5%', width: '34px' } },
  // Alt bant
  { node: <Award />, style: { bottom: '14%', left: '8%', width: '42px', transform: 'rotate(-6deg)' } },
  { node: <Trail />, style: { bottom: '11%', left: '14%', width: '78px', opacity: 0.45 } },
  { node: <Sparkle />, style: { bottom: '20%', right: '7%', width: '24px' } },
  { node: <PlusBadge />, style: { bottom: '15%', right: '11%', width: '28px', opacity: 0.9 } },
];

export default function LoginFormDecorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden lg:block">
      {SPOTS.map((s, i) => (
        <span key={i} className="absolute" style={s.style}>
          {s.node}
        </span>
      ))}
    </div>
  );
}
