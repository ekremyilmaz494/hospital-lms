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
  { href: '/staff/dashboard',    label: 'Ana Sayfa',   icon: LayoutDashboard, rootHref: '/staff/dashboard' },
  { href: '/staff/my-trainings', label: 'Eğitimlerim', icon: BookOpen },
  { href: '/staff/certificates', label: 'Sertifikalar', icon: Award },
] as const

interface MobileBottomNavProps {
  onMorePress?: () => void;
  items?: readonly MobileBottomNavItem[];
}

/**
 * Mobil görünümde sayfanın alt kısmında sabit duran navigasyon çubuğu.
 * md breakpoint üzerinde gizlenir.
 * 4. item "Daha Fazla" — sidebar drawer'ı açar (iOS tab bar convention).
 */
export function MobileBottomNav({ onMorePress, items = DEFAULT_STAFF_ITEMS }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center border-t md:hidden"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        height: '64px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map(({ href, label, icon: Icon, rootHref }) => {
        const root = rootHref ?? href
        const isActive = pathname === href || (pathname !== root && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
            style={{ minHeight: 60 }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
              style={{
                background: isActive ? 'var(--color-primary-light)' : 'transparent',
              }}
            >
              <Icon
                className="h-5 w-5 transition-colors"
                style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
              />
            </div>
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
            >
              {label}
            </span>
          </Link>
        )
      })}

      {/* "Daha Fazla" butonu — drawer açar */}
      <button
        type="button"
        onClick={onMorePress}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
        style={{ minHeight: 60 }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
          style={{ background: 'transparent' }}
        >
          <MoreHorizontal
            className="h-5 w-5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          />
        </div>
        <span
          className="text-[10px] font-semibold leading-none"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Daha Fazla
        </span>
      </button>
    </nav>
  )
}
