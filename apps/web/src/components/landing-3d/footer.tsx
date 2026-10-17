import Link from "next/link";
import { StoreBadges } from "./store-badges";
import { BRAND } from "@/lib/brand";
import { LANDING_COPY, type LandingLocale } from "./locale";

interface FooterLink {
  href: string;
  label: string;
  /** Hedef sayfanın dili sayfa diliyle farklıysa (EN sayfada TR yasal metin). */
  hrefLang?: LandingLocale;
}

const FOOTER_COPY: Record<
  LandingLocale,
  { founded: string; links: FooterLink[]; legal: FooterLink[] }
> = {
  tr: {
    founded: "Kuruluş",
    links: [
      { href: "/hakkimizda", label: "Hakkımızda" },
      { href: "/demo", label: "Demo Talep Et" },
      { href: "/#sss", label: "SSS" },
      { href: "/contact", label: "İletişim" },
    ],
    legal: [
      { href: "/privacy", label: "Gizlilik" },
      { href: "/kvkk", label: "KVKK" },
      { href: "/cerez-politikasi", label: "Çerez Politikası" },
      { href: "/data-retention", label: "Veri Saklama" },
      { href: "/terms", label: "Kullanım Şartları" },
    ],
  },
  en: {
    founded: "Founded",
    links: [
      { href: "/en#about", label: "About" },
      { href: "/en#faq", label: "FAQ" },
      { href: "/en#contact", label: "Contact" },
    ],
    legal: [
      { href: "/privacy", label: "Privacy (Turkish)", hrefLang: "tr" },
      { href: "/kvkk", label: "KVKK (Turkish)", hrefLang: "tr" },
      { href: "/cerez-politikasi", label: "Cookie Policy (Turkish)", hrefLang: "tr" },
      { href: "/terms", label: "Terms (Turkish)", hrefLang: "tr" },
    ],
  },
};

/**
 * Landing-3d footer (marka + işletme künyesi + mobil rozetler + ürün linkleri + ayrı yasal nav). Ana
 * landing (scroll-sections), /contact, /hakkimizda ve /en tarafından paylaşılır.
 * Stiller: landing-3d.css (.l3d-footer*). main DIŞINDA kullanılır (ScrollTrigger
 * end hesabını bozmaz). Künye vergi levhasıyla birebir — TC/VKN/adres YAZILMAZ.
 */
export function Footer({ locale = "tr" }: { locale?: LandingLocale }) {
  const copy = FOOTER_COPY[locale];
  const labels = LANDING_COPY[locale];
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
        <StoreBadges variant="compact" className="l3d-footer-stores" locale={locale} />
      </div>
      <div className="l3d-footer-navs">
        <nav className="l3d-footer-links" aria-label={labels.footerNav}>
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
        <nav className="l3d-footer-links l3d-footer-legal" aria-label={labels.legalNav}>
          {copy.legal.map((link) => (
            <Link key={link.href} href={link.href} hrefLang={link.hrefLang}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
