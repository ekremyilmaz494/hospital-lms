'use client';

import { memo, useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { NavGroup } from '@/components/layouts/sidebar/sidebar-config';

interface AdminSidebarProps {
  navGroups: NavGroup[];
  collapsed?: boolean;
  orgName?: string;
  orgCode?: string;
  orgLogoUrl?: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
}

const PRIMARY = '#0d9668';
const PRIMARY_LIGHT = '#d1fae5';
const SURFACE = '#ffffff';
const SURFACE_HOVER = '#f5f5f4';
const BORDER = '#e7e5e4';
const TEXT_PRIMARY = '#1c1917';
const TEXT_SECONDARY = '#44403c';
const TEXT_MUTED = '#78716c';

export const AdminSidebar = memo(function AdminSidebar({
  navGroups,
  collapsed = false,
  orgName = 'Klinova LMS',
  orgCode = 'Hastane Yönetici',
  orgLogoUrl,
  userName = 'Kullanıcı',
  userRole = 'Admin',
  userAvatar,
  userInitials = 'KL',
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = useCallback((href: string) => {
    setExpandedItems(prev =>
      prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href],
    );
  }, []);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/admin/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside
      aria-label="Admin navigasyon"
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col overflow-hidden border-r"
      style={{
        width: collapsed ? 72 : 252,
        background: SURFACE,
        borderColor: BORDER,
        fontFamily: 'var(--font-display, system-ui)',
        transition: 'width 320ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 border-b shrink-0"
        style={{
          padding: collapsed ? '18px 10px' : '18px 18px',
          height: 64,
          borderColor: BORDER,
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'padding 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-[10px] shrink-0 text-white font-bold"
          style={{
            width: 36,
            height: 36,
            fontSize: 15,
            background: PRIMARY,
            boxShadow: `0 2px 6px ${PRIMARY}50`,
          }}
        >
          {orgLogoUrl ? (
            <Image src={orgLogoUrl} alt="" width={36} height={36} className="rounded-[10px]" />
          ) : (
            <span>{(orgName[0] ?? 'K').toUpperCase()}</span>
          )}
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0 flex-1 leading-tight">
            <strong className="text-[13.5px] font-bold truncate" style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
              {orgName}
            </strong>
            <small className="text-[11px] font-medium" style={{ color: TEXT_MUTED }}>
              {orgCode}
            </small>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ padding: '14px 10px' }}
      >
        {navGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 14 }}>
            {group.label && !collapsed && (
              <div
                className="text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: TEXT_MUTED, padding: '8px 12px 6px' }}
              >
                {group.label}
              </div>
            )}
            <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
              {group.items.map(item => {
                const active = isActive(item.href);
                const hasChildren = !!item.children?.length;
                const isExpanded = expandedItems.includes(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      onClick={(e) => {
                        if (hasChildren && !collapsed) {
                          e.preventDefault();
                          toggleExpand(item.href);
                        }
                      }}
                      className="group flex items-center rounded-[10px] no-underline"
                      style={{
                        gap: 11,
                        padding: collapsed ? '10px' : '9px 12px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        fontSize: 13.5,
                        fontWeight: active ? 600 : 500,
                        color: active ? PRIMARY : TEXT_SECONDARY,
                        background: active ? PRIMARY_LIGHT : 'transparent',
                        transition: 'background 150ms ease, color 150ms ease, padding 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = SURFACE_HOVER;
                          e.currentTarget.style.color = TEXT_PRIMARY;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = TEXT_SECONDARY;
                        }
                      }}
                    >
                      <Icon
                        className="shrink-0"
                        size={18}
                        strokeWidth={1.75}
                        style={{ color: active ? PRIMARY : TEXT_MUTED }}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{item.title}</span>
                          {item.badge && (
                            <span
                              className="font-bold rounded-full text-center"
                              style={{
                                background: PRIMARY,
                                color: '#fff',
                                fontSize: 10,
                                padding: '2px 7px',
                                minWidth: 18,
                                lineHeight: 1.2,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                          {hasChildren && (
                            <ChevronDown
                              size={14}
                              strokeWidth={2}
                              style={{
                                color: TEXT_MUTED,
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                              }}
                            />
                          )}
                        </>
                      )}
                    </Link>

                    {hasChildren && !collapsed && isExpanded && (
                      <ul className="list-none m-0 flex flex-col gap-0.5" style={{ padding: '4px 0 4px 40px' }}>
                        {item.children!.map(child => {
                          const childActive = pathname === child.href;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className="block rounded-lg no-underline"
                                style={{
                                  padding: '7px 12px',
                                  fontSize: 12.5,
                                  fontWeight: childActive ? 600 : 400,
                                  color: childActive ? PRIMARY : TEXT_SECONDARY,
                                  background: childActive ? PRIMARY_LIGHT : 'transparent',
                                  transition: 'background 150ms ease, color 150ms ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!childActive) {
                                    e.currentTarget.style.background = SURFACE_HOVER;
                                    e.currentTarget.style.color = TEXT_PRIMARY;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!childActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = TEXT_SECONDARY;
                                  }
                                }}
                              >
                                {child.title}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="flex items-center border-t shrink-0"
        style={{
          padding: 14,
          gap: 10,
          borderColor: BORDER,
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'padding 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-full text-white font-bold shrink-0 overflow-hidden"
          style={{ width: 36, height: 36, fontSize: 12, background: PRIMARY }}
        >
          {userAvatar ? (
            <Image src={userAvatar} alt="" width={36} height={36} className="rounded-full" />
          ) : (
            <span>{userInitials}</span>
          )}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0 leading-tight flex flex-col">
            <strong className="text-[13px] font-bold truncate" style={{ color: TEXT_PRIMARY }}>
              {userName}
            </strong>
            <small className="text-[11px]" style={{ color: TEXT_MUTED }}>
              {userRole}
            </small>
          </div>
        )}
      </div>
    </aside>
  );
});
