import Link from "next/link";
import { StoreBadges } from "./store-badges";
import { BRAND } from "@/lib/brand";
import type { LandingLocale } from "./locale";

const FOOTER_COPY = {
  tr: {
    founded: "Kuruluş",
    links: [
      { href: "/hakkimizda", label: "Hakkımızda" },
      { href: "/privacy", label: "Gizlilik" },
      { href: "/kvkk", label: "KVKK" },
      { href: "/terms", label: "Kullanım Şartları" },
      { href: "/contact", label: "İletişim" },
    ],
  },
  en: {
    founded: "Founded",
    links: [
      { href: "/en#about", label: "About" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/en#contact", label: "Contact" },
    ],
  },
} as const;

/**
 * Landing-3d footer (marka + işletme künyesi + mobil rozetler + yasal/iletişim linkleri). Ana
 * landing (scroll-sections), /contact, /hakkimizda ve /en tarafından paylaşılır.
 * Stiller: landing-3d.css (.l3d-footer*). main DIŞINDA kullanılır (ScrollTrigger
 * end hesabını bozmaz). Künye vergi levhasıyla birebir — TC/VKN/adres YAZILMAZ.
 */
export function Footer({ locale = "tr" }: { locale?: LandingLocale }) {
  const copy = FOOTER_COPY[locale];
  const { legal, contact, founder } = BRAND;

  return (
    <footer className="l3d-footer">
      <div className="l3d-footer-brand-col">
        <span className="l3d-footer-brand">
          © {legal.copyrightYear} {BRAND.name} · {legal.businessName}
        </span>
        <span className="l3d-footer-meta">
          {contact.city} · {copy.founded}: {legal.foundedYear} ·{" "}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </span>
        <StoreBadges variant="compact" className="l3d-footer-stores" />
      </div>
      <nav className="l3d-footer-links">
        {copy.links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        {founder.linkedin && (
          <a href={founder.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
        )}
      </nav>
    </footer>
  );
}
