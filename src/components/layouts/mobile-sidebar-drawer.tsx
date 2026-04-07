'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { NavGroup } from '@/components/layouts/sidebar/sidebar-config';

interface MobileSidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  orgName: string;
  orgLogoUrl?: string;
  userName: string;
  userRole: string;
  userInitials: string;
  onLogout: () => void;
}

/**
 * Slide-in drawer that shows the full staff navigation on mobile.
 * Uses the existing Sheet (base-ui Dialog) component — zero new dependencies.
 * Automatically closes when a nav link is tapped.
 */
export function MobileSidebarDrawer({
  open,
  onClose,
  navGroups,
  orgName,
  orgLogoUrl,
  userName,
  userRole,
  userInitials,
  onLogout,
}: MobileSidebarDrawerProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent
        side="left"
        showCloseButton
        className="flex flex-col p-0"
        style={{ maxWidth: '280px', width: '80vw' }}
      >
        {/* Header — org branding */}
        <SheetHeader className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt={orgName}
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                {orgName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <SheetTitle className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {orgName}
              </SheetTitle>
              <SheetDescription className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Personel Paneli
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {group.label && (
                <p
                  className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {group.label}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/staff/dashboard' && pathname.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                        style={{
                          background: isActive ? 'var(--color-primary-light)' : 'transparent',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          minHeight: '44px',
                        }}
                      >
                        <Icon
                          className="h-5 w-5 shrink-0"
                          style={{
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          }}
                        />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <span
                            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              background: 'var(--color-accent-light)',
                              color: 'var(--color-accent)',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer — user info + logout */}
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {userName}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {userRole}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--color-text-muted)', minWidth: '44px', minHeight: '44px' }}
              aria-label="Çıkış Yap"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
