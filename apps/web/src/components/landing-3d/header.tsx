import Link from 'next/link';

/** Fixed üst nav. pointer-events:none katman, linkler pointer-events:auto (CSS). */
export function Header() {
  return (
    <header className="l3d-header">
      <Link href="/" className="l3d-logo">
        KlinoVax
      </Link>

      <nav className="l3d-nav">
        <Link href="/#egitim">Eğitim</Link>
        <Link href="/#kanit">Kanıt</Link>
        <Link href="/contact">İletişim</Link>
      </nav>

      <Link href="/auth/login" className="l3d-login">
        Giriş Yap
      </Link>

      <Link href="/auth/login" className="l3d-hamburger" aria-label="Menüyü aç">
        <span />
        <span />
      </Link>
    </header>
  );
}
