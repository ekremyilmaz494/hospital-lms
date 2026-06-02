import Link from "next/link";

/** Fixed üst nav. pointer-events:none katman, linkler pointer-events:auto (CSS). */
export function Header() {
  return (
    <header className="l3d-header">
      <Link href="/landing-3d" className="l3d-logo">
        KlinoVax
      </Link>

      <nav className="l3d-nav">
        <Link href="/landing-3d#egitim">Eğitim</Link>
        <Link href="/landing-3d#kanit">Kanıt</Link>
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
