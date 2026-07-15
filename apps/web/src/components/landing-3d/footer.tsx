import Link from "next/link";
import { StoreBadges } from "./store-badges";

/**
 * Landing-3d footer (marka + mobil rozetler + yasal/iletişim linkleri). Hem ana landing
 * (scroll-sections) hem /contact tarafından paylaşılır. Stiller: landing-3d.css
 * (.l3d-footer*). main DIŞINDA kullanılır (ScrollTrigger end hesabını bozmaz).
 */
export function Footer() {
  return (
    <footer className="l3d-footer">
      <div className="l3d-footer-brand-col">
        <span className="l3d-footer-brand">© KlinoVax · Eğitim Platformu</span>
        <StoreBadges variant="compact" className="l3d-footer-stores" />
      </div>
      <nav className="l3d-footer-links">
        <Link href="/privacy">Gizlilik</Link>
        <Link href="/kvkk">KVKK</Link>
        <Link href="/terms">Kullanım Şartları</Link>
        <Link href="/contact">İletişim</Link>
      </nav>
    </footer>
  );
}
