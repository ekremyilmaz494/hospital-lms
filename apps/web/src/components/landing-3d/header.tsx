import Link from 'next/link';
import { MobileMenu } from './mobile-menu';
import { LangSwitch } from './lang-switch';
import { LANDING_COPY, LANDING_HOME, LANDING_NAV, type LandingLocale } from './locale';

interface HeaderProps {
  locale?: LandingLocale;
  /** TR/EN seçicinin götüreceği karşılık sayfa (ör. /hakkimizda → /en#about). */
  alternateHref?: string;
}

/** Fixed üst nav. pointer-events:none katman, linkler pointer-events:auto (CSS). */
export function Header({ locale = 'tr', alternateHref }: HeaderProps) {
  const copy = LANDING_COPY[locale];

  return (
    <header className="l3d-header">
      <Link href={LANDING_HOME[locale]} className="l3d-logo">
        KlinoVax
      </Link>

      <nav className="l3d-nav">
        {LANDING_NAV[locale].map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="l3d-header-actions">
        <LangSwitch locale={locale} alternateHref={alternateHref} />
        <Link href="/auth/login" className="l3d-login">
          {copy.login}
        </Link>
      </div>

      {/* Mobil/tablet: hamburger → kayan drawer menü (≤1024px) */}
      <MobileMenu locale={locale} alternateHref={alternateHref} />
    </header>
  );
}
