'use client';

import React, { useState, useEffect, useRef, useContext, createContext } from 'react';

// ── Palette (matches existing login K palette) ──────────────────────────
const LP = {
  heroInk:    '#1c1917',
  heroMid:    '#292524',
  emerald:    '#0d9668',
  emeraldH:   '#087a54',
  emeraldLt:  '#10b981',
  emeraldPale:'#34d399',
  mint:       '#6ee7b7',
  mintPale:   '#a7f3d0',
  display:    "var(--font-display, 'Plus Jakarta Sans', system-ui)",
  editorial:  "var(--font-editorial, Georgia, serif)",
  mono:       "var(--font-jetbrains-mono, ui-monospace, monospace)",
};

// ── Easing helpers ──────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Easing = {
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeOutBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

// ── Timeline Context ────────────────────────────────────────────────────
const PanelTimeCtx = createContext(0);
const usePanelTime = () => useContext(PanelTimeCtx);

function PanelTimeline({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      setT((prev) => {
        const next = prev + dt;
        return next >= 13 ? 13 + (next - 13) : next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <PanelTimeCtx.Provider value={t}>{children}</PanelTimeCtx.Provider>;
}

// ── Aurora Blobs ────────────────────────────────────────────────────────
function AuroraBlobs() {
  return (
    <>
      <style>{`
        @keyframes klx-aurora-1 {
          0% { transform: translate(-10%, -10%) rotate(0deg); }
          50% { transform: translate(10%, 5%) rotate(180deg); }
          100% { transform: translate(-10%, -10%) rotate(360deg); }
        }
        @keyframes klx-aurora-2 {
          0% { transform: translate(10%, 10%) rotate(0deg); }
          50% { transform: translate(-10%, -5%) rotate(-180deg); }
          100% { transform: translate(10%, 10%) rotate(-360deg); }
        }
        @keyframes klx-aurora-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
      <div style={{
        position: 'absolute', top: '-20%', left: '-20%',
        width: '80%', height: '80%', borderRadius: '9999px',
        background: `radial-gradient(circle, ${LP.emerald} 0%, transparent 65%)`,
        filter: 'blur(60px)',
        animation: 'klx-aurora-1 28s ease-in-out infinite, klx-aurora-pulse 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-25%', right: '-20%',
        width: '85%', height: '85%', borderRadius: '9999px',
        background: `radial-gradient(circle, ${LP.emeraldH} 0%, transparent 65%)`,
        filter: 'blur(70px)',
        animation: 'klx-aurora-2 32s ease-in-out infinite, klx-aurora-pulse 10s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '30%', left: '30%',
        width: '50%', height: '50%', borderRadius: '9999px',
        background: `radial-gradient(circle, ${LP.emeraldLt}44 0%, transparent 70%)`,
        filter: 'blur(50px)',
        animation: 'klx-aurora-1 22s ease-in-out infinite reverse',
      }} />
    </>
  );
}

// ── Soft Stars ──────────────────────────────────────────────────────────
function SoftStars() {
  const t = usePanelTime();
  const rnd = (s: number) => {
    const x = Math.sin(s * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {Array.from({ length: 35 }).map((_, i) => {
        const seed = i + 1;
        const x = rnd(seed) * 100;
        const y = rnd(seed * 2) * 100;
        const flicker = 0.5 + 0.5 * Math.sin(t * 1.2 + seed * 3);
        const sz = 1 + rnd(seed * 3) * 2;
        const isGreen = rnd(seed * 4) > 0.6;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${x}%`, top: `${y}%`,
            width: sz, height: sz, borderRadius: '50%',
            background: isGreen ? LP.mint : 'rgba(255,255,255,0.9)',
            opacity: 0.25 * flicker,
            boxShadow: isGreen ? `0 0 ${sz * 4}px ${LP.mint}66` : 'none',
          }} />
        );
      })}
    </div>
  );
}

// ── Emerald Rings ───────────────────────────────────────────────────────
function EmeraldRings({ cx, cy }: { cx: number; cy: number }) {
  const t = usePanelTime();
  const entryProg = clamp(t / 2, 0, 1);
  const scale = 0.6 + Easing.easeOutCubic(entryProg) * 0.4;
  const fadeOut = t < 5 ? 1 - clamp((t - 5) / 1.5, 0, 1) : 0;
  const settledRings = clamp((t - 13) / 1, 0, 1);
  const finalOpa = fadeOut > 0 ? fadeOut : settledRings * 0.85;
  if (finalOpa <= 0 && t < 13) return null;

  const rings = [
    { sz: 320, rot: t * 12, dash: 24, color: LP.mint, opa: 0.35, sw: 1 },
    { sz: 240, rot: -t * 20, dash: 14, color: LP.emeraldPale, opa: 0.55, sw: 1.2 },
  ];

  return (
    <div style={{ opacity: finalOpa }}>
      {rings.map((r, i) => {
        const dashLen = (Math.PI * r.sz) / r.dash - 3;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: cx - r.sz / 2, top: cy - r.sz / 2,
            width: r.sz, height: r.sz,
            transform: `rotate(${r.rot}deg) scale(${scale})`,
            transformOrigin: 'center',
            opacity: entryProg * r.opa,
          }}>
            <svg viewBox={`0 0 ${r.sz} ${r.sz}`} width={r.sz} height={r.sz}>
              <circle cx={r.sz / 2} cy={r.sz / 2} r={r.sz / 2 - 2}
                fill="none" stroke={r.color}
                strokeWidth={r.sw}
                strokeDasharray={`3 ${dashLen}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
      })}
      {(() => {
        const angle = (t * 12 * Math.PI) / 180;
        const sx = cx + Math.cos(angle) * 160 * scale;
        const sy = cy + Math.sin(angle) * 160 * scale;
        return (
          <div style={{
            position: 'absolute',
            left: sx - 3, top: sy - 3,
            width: 6, height: 6, borderRadius: '50%',
            background: LP.mint,
            boxShadow: `0 0 12px ${LP.mint}, 0 0 28px ${LP.emeraldPale}`,
            opacity: entryProg * finalOpa,
          }} />
        );
      })()}
    </div>
  );
}

// ── Emerald K Monogram ──────────────────────────────────────────────────
function EmeraldMark({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const t = usePanelTime();
  const local = clamp((t - 0.8) / 1.0, 0, 1);
  const eased = Easing.easeOutCubic(local);
  const splitProg = Easing.easeOutCubic(clamp((t - 1.0) / 0.8, 0, 1));
  const xLocal = clamp((t - 1.5) / 0.6, 0, 1);
  const xEase = Easing.easeOutBack(xLocal);
  const xSettle = clamp((t - 2.1) / 0.4, 0, 1);
  const xPulse = 1 + Math.sin((t - 2.1) * 1.6) * 0.03 * xSettle;
  const ringLocal = clamp((t - 1.9) / 0.7, 0, 1);

  return (
    <div style={{
      position: 'absolute', left: cx, top: cy,
      transform: 'translate(-50%, -50%)',
      width: size, height: size, opacity: eased,
    }}>
      <div style={{
        position: 'absolute', inset: -size * 0.4,
        background: `radial-gradient(circle, ${LP.emeraldLt}33 0%, transparent 55%)`,
        filter: 'blur(30px)',
      }} />
      {ringLocal > 0 && ringLocal < 1 && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: ringLocal * size * 2, height: ringLocal * size * 2,
          marginLeft: -ringLocal * size, marginTop: -ringLocal * size,
          borderRadius: '50%',
          border: `${2 + (1 - ringLocal) * 2}px solid ${LP.emeraldPale}`,
          opacity: (1 - ringLocal) * 0.5,
        }} />
      )}
      <svg viewBox="0 0 280 280" width={size} height={size}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id="emKGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={LP.mintPale} />
          </linearGradient>
          <linearGradient id="emXGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={LP.mint} />
            <stop offset="50%" stopColor={LP.emeraldPale} />
            <stop offset="100%" stopColor={LP.emeraldLt} />
          </linearGradient>
          <filter id="emGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g opacity={eased * 0.6}>
          {([[40,40,0],[240,40,90],[40,240,-90],[240,240,180]] as const).map(([x, y, rot], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${rot}) scale(${clamp((t - 0.8 - i * 0.04) / 0.4, 0, 1)})`}>
              <path d="M 0 -20 L 0 0 L 20 0" stroke={LP.emeraldPale} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </g>
          ))}
        </g>
        <g transform="translate(140 140)" opacity={splitProg}>
          <rect x={-46} y={-78} width={20} height={156 * splitProg} fill="url(#emKGrad)" rx={2} />
          <path d={`M -26 0 L ${-26 + 70 * splitProg} ${-70 * splitProg}`} stroke="url(#emKGrad)" strokeWidth="20" strokeLinecap="round" fill="none" />
          <path d={`M -26 0 L ${-26 + 70 * splitProg} ${70 * splitProg}`} stroke="url(#emKGrad)" strokeWidth="20" strokeLinecap="round" fill="none" />
          {splitProg > 0.7 && (
            <g opacity={(splitProg - 0.7) / 0.3}>
              <rect x={-58} y={-82} width={44} height={6} fill="#fff" rx={1} />
              <rect x={-58} y={76} width={44} height={6} fill="#fff" rx={1} />
            </g>
          )}
        </g>
        {xLocal > 0 && (
          <g
            transform={`translate(180 180) translate(${(1 - xEase) * 30}, ${(1 - xEase) * -80}) rotate(${(1 - xEase) * 60}) scale(${xEase * xPulse})`}
            opacity={xLocal} filter="url(#emGlow)">
            <path d="M -22 -22 L 22 22 M 22 -22 L -22 22" stroke="url(#emXGrad)" strokeWidth="10" strokeLinecap="round" fill="none" />
            <circle cx="0" cy="0" r="4.5" fill={LP.mint} />
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Sparkles ────────────────────────────────────────────────────────────
function EmeraldSparkles() {
  const t = usePanelTime();
  if (t < 1) return null;
  const local = t - 1;
  const rnd = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 18 }).map((_, i) => {
        const seed = i + 5;
        const startX = rnd(seed) * 100;
        const driftX = (rnd(seed * 2) - 0.5) * 6;
        const phase = rnd(seed * 4) * 6;
        const cycle = (local + phase) % 6;
        const lifeT = cycle / 6;
        const y = 100 - lifeT * 110;
        const opacity = Math.sin(lifeT * Math.PI) * (0.25 + rnd(seed * 5) * 0.35);
        const sz = 1.5 + rnd(seed * 6) * 2;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${startX + driftX * lifeT}%`, top: `${y}%`,
            width: sz, height: sz, borderRadius: '50%',
            background: rnd(seed * 7) > 0.5 ? LP.mint : LP.emeraldPale,
            opacity: opacity * clamp(local / 0.5, 0, 1),
            boxShadow: `0 0 ${sz * 3}px ${LP.emeraldPale}88`,
          }} />
        );
      })}
    </div>
  );
}

// ── Wordmark ────────────────────────────────────────────────────────────
function EmeraldWordmark({ cx, cy }: { cx: number; cy: number }) {
  const t = usePanelTime();
  const start = 5.5;
  if (t < start) return null;

  const word = 'Klinova';
  const stagger = 0.05;
  const perDur = 0.5;
  const xStart = start + word.length * stagger + 0.2;
  const xLocal = clamp((t - xStart) / 0.65, 0, 1);
  const xEase = Easing.easeOutBack(xLocal);
  const pulseT = Math.max(0, t - xStart - 0.65);
  const xGlow = 0.5 + Math.sin(pulseT * 1.5) * 0.3;

  return (
    <div style={{
      position: 'absolute', left: cx, top: cy,
      transform: 'translate(-50%, -50%)',
      display: 'flex', alignItems: 'baseline',
      fontFamily: LP.editorial, fontSize: 64,
      fontWeight: 500, lineHeight: 1,
      letterSpacing: '-0.035em',
      color: '#ffffff', whiteSpace: 'nowrap',
    }}>
      {word.split('').map((ch, i) => {
        const ls = start + i * stagger;
        const lc = clamp((t - ls) / perDur, 0, 1);
        const eased = Easing.easeOutCubic(lc);
        return (
          <span key={i} style={{
            display: 'inline-block',
            transform: `translateY(${(1 - eased) * 18}px)`,
            opacity: lc,
            filter: `blur(${(1 - eased) * 4}px)`,
            fontWeight: i === 0 ? 600 : 500,
          }}>{ch}</span>
        );
      })}
      <span style={{
        display: 'inline-block', opacity: xLocal,
        transform: `translateY(${(1 - xEase) * 24}px) scale(${0.6 + xEase * 0.4})`,
        fontStyle: 'italic', fontWeight: 700,
        background: `linear-gradient(135deg, ${LP.mint}, ${LP.emeraldPale})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        filter: xLocal > 0 ? `drop-shadow(0 0 ${18 * xGlow}px ${LP.emeraldPale}88)` : 'none',
        marginLeft: 2,
      }}>x</span>
    </div>
  );
}

// ── Tagline ─────────────────────────────────────────────────────────────
function EmeraldTagline({ cx, cy }: { cx: number; cy: number }) {
  const t = usePanelTime();
  const start = 7;
  if (t < start) return null;
  const local = clamp((t - start) / 1.0, 0, 1);
  const eased = Easing.easeOutCubic(local);
  const lineW = 140 * eased;

  return (
    <div style={{
      position: 'absolute', left: cx, top: cy,
      transform: 'translate(-50%, 0)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 14, opacity: local,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: lineW, height: 1, background: `linear-gradient(90deg, transparent, ${LP.emeraldPale})` }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: LP.emeraldPale, boxShadow: `0 0 10px ${LP.emeraldPale}` }} />
        <div style={{ width: lineW, height: 1, background: `linear-gradient(90deg, ${LP.emeraldPale}, transparent)` }} />
      </div>
      <div style={{
        fontFamily: LP.display, fontSize: 11, fontWeight: 500,
        letterSpacing: '0.38em', textTransform: 'uppercase' as const,
        color: `rgba(167,243,208,${0.85 * eased})`,
        whiteSpace: 'nowrap',
      }}>Yeni Nesil · Klinik · Akademi</div>
      <div style={{
        fontFamily: LP.editorial, fontSize: 11, fontStyle: 'italic',
        letterSpacing: '0.06em',
        color: `rgba(110,231,183,${0.7 * eased})`,
      }}>— Klinik Eğitim Sistemi —</div>
    </div>
  );
}

// ── Feature Cards ───────────────────────────────────────────────────────
function FeatureCards({ t }: { t: number }) {
  const start = 8.5;
  const stagger = 0.25;

  const features = [
    { title: 'AI İçerik Üretimi', desc: 'Yapay zeka ile eğitim materyali otomatik oluşturma',
      iconPath: 'M12 6V2 M16 10l4-4 M8 10L4 6 M12 22c4.97 0 9-2.69 9-6v-2c0-3.31-4.03-6-9-6s-9 2.69-9 6v2c0 3.31 4.03 6 9 6z' },
    { title: 'Akıllı Soru Bankası', desc: 'Sınavlar ve sorular AI ile otomatik üretilir',
      iconPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' },
    { title: 'Akıllı Raporlama', desc: 'Performans analizi ve uyum takibi otomatik raporlar',
      iconPath: 'M3 3v18h18 M19 9l-5 5-4-4-3 3' },
    { title: 'Sertifikasyon', desc: 'SKS uyumlu, JCI hazır otomatik sertifika sistemi',
      iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3' },
  ];

  return (
    <div style={{
      position: 'absolute', left: 28, right: 28, bottom: 110,
      display: 'flex', flexDirection: 'column', gap: 10, zIndex: 5,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        alignSelf: 'flex-start', marginBottom: 2,
        opacity: clamp((t - start) / 0.6, 0, 1),
        transform: `translateY(${(1 - clamp((t - start) / 0.6, 0, 1)) * 10}px)`,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 9999,
          background: LP.emeraldPale, boxShadow: `0 0 10px ${LP.emeraldPale}`,
        }} />
        <span style={{
          fontFamily: LP.display, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.22em', textTransform: 'uppercase' as const,
          background: `linear-gradient(90deg, ${LP.mint}, ${LP.mintPale})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>Farkımız Ne?</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {features.map((f, i) => {
          const itemStart = start + 0.3 + i * stagger;
          const itemProg = clamp((t - itemStart) / 0.5, 0, 1);
          const itemEased = Easing.easeOutCubic(itemProg);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              backdropFilter: 'blur(10px)',
              opacity: itemProg,
              transform: `translateY(${(1 - itemEased) * 14}px)`,
            }}>
              <div style={{
                width: 32, height: 32, minWidth: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${LP.emeraldLt}, ${LP.emeraldH})`,
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={LP.mint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={f.iconPath} />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: LP.display, fontSize: 11.5, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 2 }}>
                  {f.title}
                </div>
                <div style={{ fontFamily: LP.display, fontSize: 10, fontWeight: 400, color: 'rgba(241,245,249,0.6)', lineHeight: 1.35 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(() => {
        const statStart = start + 0.3 + features.length * stagger + 0.3;
        const statProg = clamp((t - statStart) / 0.6, 0, 1);
        const statEased = Easing.easeOutCubic(statProg);
        return (
          <div style={{
            display: 'flex', alignItems: 'stretch',
            background: `linear-gradient(90deg, ${LP.emeraldLt}22, ${LP.emerald}22)`,
            borderRadius: 12, padding: 1, marginTop: 2,
            opacity: statProg,
            transform: `translateY(${(1 - statEased) * 10}px)`,
          }}>
            <div style={{
              display: 'flex', width: '100%',
              background: 'rgba(15,23,42,0.5)',
              backdropFilter: 'blur(10px)', borderRadius: 11,
            }}>
              {[
                { value: '120+', label: 'HASTANE' },
                { value: '50K+', label: 'PERSONEL' },
                { value: '99.9%', label: 'UPTIME' },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <span style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />}
                  <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px' }}>
                    <span style={{
                      fontFamily: LP.display, fontSize: 20, fontWeight: 800,
                      background: `linear-gradient(135deg, ${LP.emeraldPale}, #fff)`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text', letterSpacing: '-0.02em', lineHeight: 1.1,
                    }}>{s.value}</span>
                    <span style={{
                      fontFamily: LP.display, fontSize: 8, fontWeight: 600,
                      letterSpacing: '0.22em', color: 'rgba(241,245,249,0.55)', marginTop: 4,
                    }}>{s.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — Drop-in replacement for <aside> content in login page
// ═══════════════════════════════════════════════════════════════════════════
export default function LoginHeroAnimation() {
  const [dims, setDims] = useState({ w: 960, h: 1080 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => {
      if (ref.current) setDims({ w: ref.current.clientWidth, h: ref.current.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <PanelTimeline>
      <LoginHeroContent ref={ref} dims={dims} />
    </PanelTimeline>
  );
}

const LoginHeroContent = React.forwardRef<HTMLDivElement, { dims: { w: number; h: number } }>(
  function LoginHeroContent({ dims }, ref) {
    const t = usePanelTime();

    const lockProg = Easing.easeInOutCubic(clamp((t - 4.5) / 1.0, 0, 1));
    const pCx = dims.w / 2;
    const introCy = dims.h * 0.42;
    const lockCy = dims.h * 0.22;
    const pCy = introCy + (lockCy - introCy) * lockProg;
    const introSize = Math.min(dims.w * 0.32, 180);
    const lockSize = Math.min(dims.w * 0.2, 110);
    const markSize = introSize + (lockSize - introSize) * lockProg;

    return (
      <div ref={ref} style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        background: `linear-gradient(150deg, ${LP.heroInk} 0%, ${LP.heroMid} 55%, ${LP.heroInk} 100%)`,
      }}>
        <AuroraBlobs />
        <SoftStars />
        <EmeraldSparkles />
        <EmeraldRings cx={pCx} cy={pCy} />
        <EmeraldMark cx={pCx} cy={pCy} size={markSize} />
        <EmeraldWordmark cx={pCx} cy={pCy + markSize / 2 + 45} />
        <EmeraldTagline cx={pCx} cy={pCy + markSize / 2 + 90} />

        {t >= 8.5 && <FeatureCards t={t} />}

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Top brand mark */}
        {t >= 8.5 && (
          <div style={{
            position: 'absolute', left: 28, top: 28,
            display: 'flex', alignItems: 'center', gap: 10,
            opacity: clamp((t - 8.5) / 0.8, 0, 1),
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${LP.emeraldLt}, ${LP.emeraldH})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}>
              <span style={{
                fontFamily: LP.editorial, fontStyle: 'italic', fontWeight: 700,
                fontSize: 20, color: '#fff', lineHeight: 1,
              }}>K</span>
            </div>
            <div>
              <div style={{
                fontFamily: LP.editorial, fontStyle: 'italic', fontWeight: 500,
                fontSize: 20, color: '#fff', lineHeight: 1,
              }}>Klinovax</div>
              <div style={{
                fontFamily: LP.display, fontSize: 8, fontWeight: 600,
                letterSpacing: '0.28em', textTransform: 'uppercase' as const,
                background: `linear-gradient(90deg, ${LP.mint}, ${LP.mintPale})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', marginTop: 2,
              }}>Hospital Suite</div>
            </div>
          </div>
        )}

        {/* Bottom KVKK + footer */}
        {t >= 9 && (
          <>
            <div style={{
              position: 'absolute', left: 28, bottom: 56,
              opacity: clamp((t - 9) / 0.5, 0, 1),
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 9999,
                background: `${LP.emeraldPale}1a`,
                border: `1px solid ${LP.emeraldPale}55`,
                backdropFilter: 'blur(8px)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={LP.mint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
                </svg>
                <span style={{ fontFamily: LP.display, fontSize: 10, fontWeight: 600, color: LP.mintPale }}>
                  KVKK Uyumlu · ISO 27001
                </span>
              </div>
            </div>
            <div style={{
              position: 'absolute', left: 28, right: 28, bottom: 24,
              display: 'flex', justifyContent: 'space-between',
              fontFamily: LP.display, fontSize: 10, fontWeight: 500,
              letterSpacing: '0.2em', textTransform: 'uppercase' as const,
              color: 'rgba(241,245,249,0.4)',
              opacity: clamp((t - 9.2) / 0.5, 0, 1),
            }}>
              <span>© 2026 Klinovax</span>
              <span style={{
                background: `linear-gradient(90deg, ${LP.mint}, ${LP.mintPale})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Hospital LMS · v2.0</span>
            </div>
          </>
        )}
      </div>
    );
  }
);
