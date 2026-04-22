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
import type { NavGroup } from '@/components/layouts/sidebar/sidebar-config';

/* ─── Editorial palette ───
 * Drawer is a fixed design element (mobile equivalent of desktop dark masthead).
 * Stays in editorial-light always, not themed by dark mode toggle. */
const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';

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
 * Mobile drawer — "Clinical Editorial" dili.
 * Cream zemin, ink ikon, gold accent indicator, mono caps label, serif org name.
 * Sheet base-ui Dialog wrapper'ını kullanıyor (dependency değişmedi).
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
        className="flex flex-col p-0 border-0"
        style={{
          maxWidth: '300px',
          width: '82vw',
          background: CREAM,
          borderRight: `1px solid ${INK}`,
          fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        }}
      >
        {/* Header — editorial masthead */}
        <SheetHeader
          className="px-5 pt-5 pb-4 gap-0"
          style={{ borderBottom: `1px solid ${INK}` }}
        >
          <p
            className="text-[9px] font-semibold uppercase tracking-[0.28em] mb-2"
            style={{
              color: GOLD,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            № 00 · Menü
          </p>
          <div className="flex items-center gap-3">
            {orgLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={orgLogoUrl}
                alt={orgName}
                className="h-10 w-10 object-cover"
                style={{ border: `1px solid ${INK}`, borderRadius: '2px' }}
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center text-[13px] font-semibold"
                style={{
                  background: INK,
                  color: GOLD,
                  borderRadius: '2px',
                  fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                }}
              >
                {orgName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1 text-left">
              <SheetTitle
                className="truncate leading-tight tracking-tight"
                style={{
                  color: INK,
                  fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                {orgName}
              </SheetTitle>
              <SheetDescription
                className="mt-0.5 text-[10px] tracking-[0.18em] uppercase"
                style={{
                  color: INK_SOFT,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                }}
              >
                Personel Paneli
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-3 pt-3' : ''} style={gi > 0 ? { borderTop: `1px solid ${RULE}` } : undefined}>
              {group.label && (
                <p
                  className="px-5 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.28em]"
                  style={{
                    color: INK_SOFT,
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  {group.label}
                </p>
              )}
              <ul className="list-none p-0 m-0">
                {group.items.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/staff/dashboard' && pathname.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? 'page' : undefined}
                        className="relative flex items-center gap-3 px-5 py-3 transition-colors"
                        style={{
                          color: isActive ? INK : INK_SOFT,
                          background: isActive ? 'rgba(201, 169, 97, 0.08)' : 'transparent',
                          minHeight: '48px',
                          fontSize: '14px',
                          fontWeight: isActive ? 600 : 500,
                          paddingLeft: idx > 0 || group.label ? undefined : '20px',
                        }}
                      >
                        {/* Gold active indicator — left rail */}
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-2 bottom-2"
                            style={{ width: '3px', background: GOLD }}
                          />
                        )}
                        <Icon
                          className="h-[18px] w-[18px] shrink-0"
                          strokeWidth={isActive ? 2.2 : 1.75}
                          style={{ color: isActive ? INK : INK_SOFT }}
                        />
                        <span className="truncate tracking-tight">{item.title}</span>
                        {item.badge && (
                          <span
                            className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none"
                            style={{
                              color: INK,
                              background: GOLD,
                              borderRadius: '2px',
                              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
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

        {/* Footer — user + logout */}
        <div
          className="px-5 py-4"
          style={{ borderTop: `1px solid ${INK}`, background: 'rgba(10, 22, 40, 0.02)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center shrink-0"
              style={{
                background: OLIVE,
                color: CREAM,
                borderRadius: '2px',
                border: `1.5px solid ${GOLD}`,
                fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate leading-tight"
                style={{
                  color: INK,
                  fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                  fontSize: '13.5px',
                  fontWeight: 600,
                }}
              >
                {userName}
              </p>
              <p
                className="mt-0.5 text-[10px] uppercase tracking-[0.22em]"
                style={{
                  color: GOLD,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  fontWeight: 700,
                }}
              >
                {userRole}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center justify-center transition-colors"
              style={{
                width: 44,
                height: 44,
                color: '#b3261e',
                background: 'transparent',
                border: `1px solid ${RULE}`,
                borderRadius: '2px',
              }}
              aria-label="Çıkış Yap"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
