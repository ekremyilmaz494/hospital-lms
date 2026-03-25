'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, Copy, HelpCircle, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavGroup } from './sidebar-config';

interface AppSidebarProps {
  navGroups: NavGroup[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  orgName?: string;
  orgCode?: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
}

export function AppSidebar({
  navGroups,
  collapsed = false,
  orgName = 'Hastane LMS',
  orgCode,
  userName = 'Kullanıcı',
  userRole = 'Admin',
  userAvatar,
  userInitials = 'KL',
}: AppSidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isGroupActive = (href: string, children?: { href: string }[]) => {
    if (isActive(href)) return true;
    return children?.some((child) => isActive(child.href)) ?? false;
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-50 flex h-screen flex-col border-r',
        'bg-[var(--color-surface)] border-[var(--color-border)]',
        'transition-[width] duration-250',
        collapsed ? 'w-[72px]' : 'w-[280px]'
      )}
      style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
    >
      {/* Logo & Org Name */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #0f4a35 100%)',
            fontFamily: 'var(--font-display)',
            boxShadow: '0 4px 12px rgba(26, 107, 78, 0.3)',
          }}
        >
          H
        </div>
        {!collapsed && (
          <div className="flex flex-1 items-center justify-between">
            <span
              className="text-base font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              {orgName}
            </span>
            <button
              className="rounded p-1 hover:bg-[var(--color-surface-hover)]"
              style={{ transition: 'background var(--transition-fast)' }}
            >
              <Copy className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>
        )}
      </div>

      {/* Org Selector (if orgCode exists) */}
      {orgCode && !collapsed && (
        <div className="mx-4 mb-3">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
            style={{
              background: 'var(--color-primary-light)',
              transition: 'background var(--transition-fast)',
            }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ background: 'var(--color-accent)' }}
            >
              {orgName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {orgName}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {orgCode}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>
      )}

      <Separator className="bg-[var(--color-border)]" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-3">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className={cn(groupIdx > 0 && 'mt-5')}>
            {group.label && !collapsed && (
              <p
                className="mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {group.label}
              </p>
            )}
            {group.label && collapsed && (
              <Separator className="my-2 bg-[var(--color-border)]" />
            )}
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isGroupActive(item.href, item.children);
                const expanded = expandedItems.includes(item.href);
                const hasChildren = item.children && item.children.length > 0;

                return (
                  <div key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={<Link href={hasChildren ? item.children![0].href : item.href} />}
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg mx-auto',
                            'transition-colors duration-150'
                          )}
                          style={{
                            background: active ? 'var(--color-primary-light)' : 'transparent',
                            color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            transition: 'background var(--transition-fast), color var(--transition-fast)',
                          }}
                        >
                          <Icon className="h-5 w-5" />
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        {hasChildren ? (
                          <button
                            onClick={() => toggleExpand(item.href)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                            )}
                            style={{
                              background: active ? 'var(--color-primary-light)' : 'transparent',
                              color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                              fontWeight: active ? 600 : 500,
                              borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                              transition: 'background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
                            }}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="flex-1 text-left">{item.title}</span>
                            {expanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )}
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                            )}
                            style={{
                              background: active ? 'var(--color-primary-light)' : 'transparent',
                              color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                              fontWeight: active ? 600 : 500,
                              borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                              transition: 'background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
                            }}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{item.title}</span>
                            {item.badge && (
                              <span
                                className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={{ background: 'var(--color-accent)', color: 'white' }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        )}

                        {/* Children */}
                        {hasChildren && expanded && (
                          <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l-2 pl-4 border-[var(--color-border)]">
                            {item.children!.map((child) => {
                              const childActive = isActive(child.href);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className="rounded-md px-3 py-2 text-sm"
                                  style={{
                                    background: childActive ? 'var(--color-primary-light)' : 'transparent',
                                    color: childActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    fontWeight: childActive ? 600 : 500,
                                    transition: 'background var(--transition-fast), color var(--transition-fast)',
                                  }}
                                >
                                  {child.title}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}
      </ScrollArea>

      <Separator className="bg-[var(--color-border)]" />

      {/* Bottom: Settings + Help */}
      {!collapsed && (
        <div className="px-3 py-2">
          <Link
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)', transition: 'color var(--transition-fast)' }}
          >
            <Settings className="h-5 w-5" />
            <span>Ayarlar</span>
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)', transition: 'color var(--transition-fast)' }}
          >
            <HelpCircle className="h-5 w-5" />
            <span>Yardım & Destek</span>
          </Link>
        </div>
      )}

      <Separator className="bg-[var(--color-border)]" />

      {/* User Info */}
      <div className={cn('flex items-center gap-3 p-4', collapsed && 'justify-center px-2')}>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={userAvatar} />
          <AvatarFallback
            className="text-xs font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {userInitials}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {userName}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {userRole}
            </p>
          </div>
        )}
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger
              className="rounded-md p-1.5 hover:bg-[var(--color-surface-hover)]"
              style={{ transition: 'background var(--transition-fast)' }}
            >
              <LogOut className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            </TooltipTrigger>
            <TooltipContent>Çıkış Yap</TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
