'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, Award, UserCircle } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/staff/dashboard',    label: 'Ana Sayfa',   icon: LayoutDashboard },
  { href: '/staff/my-trainings', label: 'Eğitimlerim', icon: BookOpen },
  { href: '/staff/certificates', label: 'Sertifikalar', icon: Award },
  { href: '/staff/profile',      label: 'Profil',      icon: UserCircle },
] as const

/**
 * Mobil görünümde sayfanın alt kısmında sabit duran navigasyon çubuğu.
 * md breakpoint üzerinde gizlenir (hidden md:flex class'ı layout'ta uygulanır).
 */
export function MobileBottomNav() {
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
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/staff/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
            style={{ minHeight: 60 }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
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
    </nav>
  )
}
