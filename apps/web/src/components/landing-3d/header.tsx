import Link from "next/link";

/** Fixed üst nav. pointer-events:none katman, linkler pointer-events:auto (CSS). */
export function Header() {
  return (
    <header className="l3d-header">
      <Link href="/" className="l3d-logo">
        KlinoVax
      </Link>

      <nav className="l3d-nav">
        <a href="#egitim">Eğitim</a>
        <a href="#kanit">Kanıt</a>
        <Link href="/pricing">Fiyatlandırma</Link>
        <Link href="/contact">İletişim</Link>
      </nav>

      <Link href="/login" className="l3d-login">
        Giriş Yap
      </Link>

      <Link href="/login" className="l3d-hamburger" aria-label="Menüyü aç">
        <span />
        <span />
      </Link>
    </header>
  );
}
