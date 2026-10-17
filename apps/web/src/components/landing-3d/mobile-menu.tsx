'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  Users,
  Mail,
  LogIn,
  ArrowRight,
  X,
  ChevronRight,
  Workflow,
  LockKeyhole,
  CircleHelp,
} from 'lucide-react';
import { LangSwitch } from './lang-switch';
import { getTrapTarget } from './focus-trap';
import {
  LANDING_COPY,
  LANDING_HOME,
  LANDING_NAV,
  type LandingLocale,
  type LandingNavItem,
} from './locale';

/** Nav satır ikonları — metinler locale.ts'te. */
const NAV_ICONS: Record<LandingNavItem['icon'], typeof Mail> = {
  training: GraduationCap,
  proof: ShieldCheck,
  about: Users,
  contact: Mail,
  flow: Workflow,
  security: LockKeyhole,
  faq: CircleHelp,
};

/** Drawer içinde Tab ile gezilebilen öğeler. */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])';

const ANIM_MS = 420;

/**
 * Mobil/tablet navigasyon — hamburger butonu + kayan drawer.
 * Masaüstünde gizli (.l3d-menu-btn yalnız ≤1024px'te görünür).
 *
 * Drawer YALNIZCA açıkken DOM'a girer: kapalı drawer `translateX(100%)` ile
 * ekran dışına taşıp masaüstünde yatay scroll yaratırdı (position:fixed öğe
 * .l3d-page overflow-x'ten kaçar). Mount + rAF ile slide-in, unmount gecikmeli.
 *
 * Erişilebilirlik: drawer `role="dialog" aria-modal`; açılışta odak kapat butonuna
 * gider, Tab drawer içinde döner (`getTrapTarget`), Esc / X / overlay ile kapanınca
 * odak hamburgere döner. Link tıklamasıyla kapanışta odak geri verilmez (sayfa
 * zaten hedefe gidiyor).
 */
export function MobileMenu({
  locale = 'tr',
  alternateHref,
}: {
  locale?: LandingLocale;
  alternateHref?: string;
}) {
  const copy = LANDING_COPY[locale];
  const [open, setOpen] = useState(false); // butonun mantıksal durumu
  const [mounted, setMounted] = useState(false); // drawer DOM'da mı
  const [shown, setShown] = useState(false); // is-open class (geçiş)
  const closeTimer = useRef<number | undefined>(undefined);
  const drawerId = useId();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
    setMounted(true);
    requestAnimationFrame(() => setShown(true));
  }, []);

  /** @param restoreFocus  true: odağı hamburgere geri ver (Esc / X / overlay). */
  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setShown(false);
    closeTimer.current = window.setTimeout(() => setMounted(false), ANIM_MS);
    if (restoreFocus) menuBtnRef.current?.focus({ preventScroll: true });
  }, []);

  // Link tıklamasıyla kapanış: odak geri verilmez.
  const closeAfterNavigate = useCallback(() => closeMenu(false), [closeMenu]);

  // Açılışta odağı kapat butonuna taşı
  useEffect(() => {
    if (mounted) closeBtnRef.current?.focus({ preventScroll: true });
  }, [mounted]);

  // Açıkken arka plan scroll kilidi + Esc ile kapat + Tab odak tuzağı
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu(true);
        return;
      }
      if (e.key !== 'Tab') return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const target = getTrapTarget(
        items.indexOf(document.activeElement as HTMLElement),
        items.length,
        e.shiftKey,
      );
      if (target !== null) {
        e.preventDefault();
        items[target]?.focus();
      }
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
        ref={menuBtnRef}
        type="button"
        className="l3d-menu-btn"
        aria-label={open ? copy.closeMenu : copy.openMenu}
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => (open ? closeMenu(true) : openMenu())}
      >
        <span />
        <span />
        <span />
      </button>

      {mounted && (
        <>
          <div
            className={`l3d-drawer-overlay${shown ? ' is-open' : ''}`}
            onClick={() => closeMenu(true)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            id={drawerId}
            className={`l3d-drawer${shown ? ' is-open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={copy.mobileMenu}
          >
            <div className="l3d-drawer-head">
              <Link
                href={LANDING_HOME[locale]}
                className="l3d-drawer-logo"
                onClick={closeAfterNavigate}
              >
                KlinoVax
              </Link>
              <button
                ref={closeBtnRef}
                type="button"
                className="l3d-drawer-close"
                aria-label={copy.closeMenu}
                onClick={() => closeMenu(true)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="l3d-drawer-meta">
              <span className="l3d-drawer-eyebrow">{copy.menu}</span>
              <LangSwitch
                locale={locale}
                alternateHref={alternateHref}
                onNavigate={closeAfterNavigate}
              />
            </div>

            <nav aria-label={copy.mainNav}>
              <ul className="l3d-drawer-list">
                {LANDING_NAV[locale].map(({ href, label, desc, icon }) => {
                  const Icon = NAV_ICONS[icon];
                  return (
                    <li key={href}>
                      <Link href={href} onClick={closeAfterNavigate}>
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
                  );
                })}
              </ul>
            </nav>

            <div className="l3d-drawer-actions">
              <Link href="/auth/login" className="l3d-drawer-login" onClick={closeAfterNavigate}>
                <LogIn size={17} aria-hidden="true" />
                {copy.login}
              </Link>
              <Link href={copy.demoHref} className="l3d-drawer-cta" onClick={closeAfterNavigate}>
                {copy.demo}
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

            <p className="l3d-drawer-foot">{copy.drawerFoot}</p>
          </div>
        </>
      )}
    </>
  );
}
