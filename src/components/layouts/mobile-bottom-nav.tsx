'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, Award, MoreHorizontal, type LucideIcon } from 'lucide-react'

export interface MobileBottomNavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Optional: href that identifies the root of this section for active-state matching */
  rootHref?: string
}

const DEFAULT_STAFF_ITEMS: readonly MobileBottomNavItem[] = [
  { href: '/staff/dashboard',    label: 'Panel',       icon: LayoutDashboard, rootHref: '/staff/dashboard' },
  { href: '/staff/my-trainings', label: 'Eğitimler',   icon: BookOpen },
  { href: '/staff/certificates', label: 'Sertifika',   icon: Award },
] as const

/* ─── Editorial palette ─── */
const INK = '#0a1628'
const INK_SOFT = '#5b6478'
const CREAM = '#f4ead5'
const RULE = '#e0d7c0'
const GOLD = '#c9a961'

interface MobileBottomNavProps {
  onMorePress?: () => void;
  items?: readonly MobileBottomNavItem[];
}

/**
 * Mobile alt navigasyon — "Clinical Editorial" dili.
 * Cream zemin, ink ikon/metin, gold active underline. Rounded-xl emerald
 * tasarım kaldırıldı; diğer staff sayfalarındaki dil ile hizalandı.
 * md breakpoint üzerinde gizlenir (desktop sidebar devreye girer).
 */
export function MobileBottomNav({ onMorePress, items = DEFAULT_STAFF_ITEMS }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch md:hidden"
      style={{
        background: CREAM,
        borderTop: `1px solid ${INK}`,
        height: '64px',
        paddingBottom: 'env(safe-area-inset-bottom)',
        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
      }}
    >
      {items.map(({ href, label, icon: Icon, rootHref }) => {
        const root = rootHref ?? href
        const isActive = pathname === href || (pathname !== root && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex flex-1 flex-col items-center justify-center gap-1"
            style={{ minHeight: 60, color: isActive ? INK : INK_SOFT }}
          >
            {/* Gold active indicator — top underline, editorial rule */}
            {isActive && (
              <span
                aria-hidden
                className="absolute top-0 left-[25%] right-[25%]"
                style={{ height: '2px', background: GOLD }}
              />
            )}
            <Icon
              className="h-[18px] w-[18px]"
              strokeWidth={isActive ? 2.2 : 1.75}
              style={{ color: isActive ? INK : INK_SOFT }}
            />
            <span
              className="text-[9px] font-semibold tracking-[0.18em] uppercase leading-none"
              style={{ color: isActive ? INK : INK_SOFT }}
            >
              {label}
            </span>
          </Link>
        )
      })}

      {/* Vertical divider before More — editorial hairline */}
      <span aria-hidden className="self-stretch my-3" style={{ width: '1px', background: RULE }} />

      {/* "Daha Fazla" — drawer açar */}
      <button
        type="button"
        onClick={onMorePress}
        aria-label="Daha fazla menü aç"
        className="relative flex flex-1 flex-col items-center justify-center gap-1"
        style={{ minHeight: 60, color: INK_SOFT, background: 'transparent' }}
      >
        <MoreHorizontal
          className="h-[18px] w-[18px]"
          strokeWidth={1.75}
          style={{ color: INK_SOFT }}
        />
        <span
          className="text-[9px] font-semibold tracking-[0.18em] uppercase leading-none"
          style={{ color: INK_SOFT }}
        >
          Menü
        </span>
      </button>
    </nav>
  )
}
