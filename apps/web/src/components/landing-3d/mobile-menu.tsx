'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const LINKS = [
  { href: '/#egitim', label: 'Eğitim' },
  { href: '/#kanit', label: 'Kanıt' },
  { href: '/contact', label: 'İletişim' },
  { href: '/demo', label: 'Demo' },
];

const ANIM_MS = 340;

/**
 * Mobil/tablet navigasyon — hamburger butonu + kayan drawer.
 * Masaüstünde gizli (.l3d-menu-btn yalnız ≤1024px'te görünür).
 *
 * Drawer YALNIZCA açıkken DOM'a girer: kapalı drawer `translateX(100%)` ile
 * ekran dışına taşıp masaüstünde yatay scroll yaratırdı (position:fixed öğe
 * .l3d-page overflow-x'ten kaçar). Mount + rAF ile slide-in, unmount gecikmeli.
 *
 * Önceden hamburger doğrudan /auth/login'e gidiyordu → nav linkleri mobilde erişilemezdi.
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
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={closeMenu}>
                {l.label}
              </Link>
            ))}
            <Link href="/auth/login" className="l3d-drawer-cta" onClick={closeMenu}>
              Giriş Yap
            </Link>
          </nav>
        </>
      )}
    </>
  );
}
