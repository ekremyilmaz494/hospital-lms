'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, ShieldCheck, Mail, LogIn, ArrowRight, X, ChevronRight } from 'lucide-react';

/** Nav bölümleri — ikon + kısa açıklama ile zengin satırlar. */
const NAV = [
  { href: '/#egitim', label: 'Eğitim', desc: 'Eğitim & sınav yönetimi', Icon: GraduationCap },
  { href: '/#kanit', label: 'Kanıt', desc: 'Sertifika & denetim raporu', Icon: ShieldCheck },
  { href: '/contact', label: 'İletişim', desc: 'Bize ulaşın', Icon: Mail },
];

const ANIM_MS = 420;

/**
 * Mobil/tablet navigasyon — hamburger butonu + kayan drawer.
 * Masaüstünde gizli (.l3d-menu-btn yalnız ≤1024px'te görünür).
 *
 * Drawer YALNIZCA açıkken DOM'a girer: kapalı drawer `translateX(100%)` ile
 * ekran dışına taşıp masaüstünde yatay scroll yaratırdı (position:fixed öğe
 * .l3d-page overflow-x'ten kaçar). Mount + rAF ile slide-in, unmount gecikmeli.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false); // butonun mantıksal durumu
  const [mounted, setMounted] = useState(false); // drawer DOM'da mı
  const [shown, setShown] = useState(false); // is-open class (geçiş)
  const closeTimer = useRef<number | undefined>(undefined);

  const openMenu = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
    setMounted(true);
    requestAnimationFrame(() => setShown(true));
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setShown(false);
    closeTimer.current = window.setTimeout(() => setMounted(false), ANIM_MS);
  }, []);

  // Açıkken arka plan scroll kilidi + Esc ile kapat
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeMenu]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        type="button"
        className="l3d-menu-btn"
        aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
        aria-expanded={open}
        onClick={() => (open ? closeMenu() : openMenu())}
      >
        <span />
        <span />
        <span />
      </button>

      {mounted && (
        <>
          <div
            className={`l3d-drawer-overlay${shown ? ' is-open' : ''}`}
            onClick={closeMenu}
            aria-hidden="true"
          />
          <nav className={`l3d-drawer${shown ? ' is-open' : ''}`} aria-label="Mobil menü">
            <div className="l3d-drawer-head">
              <Link href="/" className="l3d-drawer-logo" onClick={closeMenu}>
                KlinoVax
              </Link>
              <button
                type="button"
                className="l3d-drawer-close"
                aria-label="Menüyü kapat"
                onClick={closeMenu}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <span className="l3d-drawer-eyebrow">MENÜ</span>

            <ul className="l3d-drawer-list">
              {NAV.map(({ href, label, desc, Icon }) => (
                <li key={href}>
                  <Link href={href} onClick={closeMenu}>
                    <span className="l3d-drawer-ico" aria-hidden="true">
                      <Icon size={19} />
                    </span>
                    <span className="l3d-drawer-txt">
                      <span className="l3d-drawer-label">{label}</span>
                      <span className="l3d-drawer-desc">{desc}</span>
                    </span>
                    <ChevronRight size={18} className="l3d-drawer-chev" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="l3d-drawer-actions">
              <Link href="/auth/login" className="l3d-drawer-login" onClick={closeMenu}>
                <LogIn size={17} aria-hidden="true" />
                Giriş Yap
              </Link>
              <Link href="/demo" className="l3d-drawer-cta" onClick={closeMenu}>
                Demo Talep Et
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>

            {/* Dekoratif illüstrasyon — landing diliyle (büyüme barları + yükseliş +
                amber güneş), boş alt alanı doldurur. aria-hidden, amber-ağırlıklı. */}
            <div className="l3d-drawer-art" aria-hidden="true">
              <svg viewBox="0 0 280 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="214" cy="50" r="30" fill="#f59e0b" fillOpacity="0.16" />
                <circle cx="214" cy="50" r="20" fill="#f59e0b" />
                <path d="M36 132 H244" stroke="#1a3a28" strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />
                <rect x="70" y="98" width="30" height="34" rx="9" fill="#0d9668" />
                <rect x="110" y="74" width="30" height="58" rx="9" fill="#f59e0b" />
                <rect x="150" y="54" width="30" height="78" rx="9" fill="#0d9668" />
                <path d="M66 104 C96 92 132 72 166 56" stroke="#1a3a28" strokeWidth="3" strokeLinecap="round" />
                <path d="M153 53 L167 56 L164 70" stroke="#1a3a28" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M44 72l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f59e0b" />
                <circle cx="234" cy="102" r="3.5" fill="#0d9668" />
              </svg>
            </div>

            <p className="l3d-drawer-foot">Hastaneler için eğitim &amp; sınav platformu</p>
          </nav>
        </>
      )}
    </>
  );
}
