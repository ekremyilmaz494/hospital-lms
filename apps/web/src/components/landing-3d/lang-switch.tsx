import Link from 'next/link';
import { LANDING_COPY, LANDING_HOME, type LandingLocale } from './locale';

interface LangSwitchProps {
  locale: LandingLocale;
  /** Diğer dildeki karşılık sayfa. Verilmezse o dilin ana sayfası. */
  alternateHref?: string;
  className?: string;
  onNavigate?: () => void;
}

/** TR / EN seçici — aktif dil vurgulu span, diğeri karşılık sayfaya link. */
export function LangSwitch({ locale, alternateHref, className, onNavigate }: LangSwitchProps) {
  const other: LandingLocale = locale === 'tr' ? 'en' : 'tr';
  const otherHref = alternateHref ?? LANDING_HOME[other];

  const item = (code: LandingLocale) =>
    code === locale ? (
      <span key={code} className="is-active" aria-current="true">
        {code.toUpperCase()}
      </span>
    ) : (
      <Link key={code} href={otherHref} hrefLang={code} lang={code} onClick={onNavigate}>
        {code.toUpperCase()}
      </Link>
    );

  return (
    <div
      className={`l3d-lang-switch${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={LANDING_COPY[locale].langLabel}
    >
      {item('tr')}
      <span className="l3d-lang-sep" aria-hidden="true">
        /
      </span>
      {item('en')}
    </div>
  );
}
