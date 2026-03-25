'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, HelpCircle, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  onToggleCollapse,
  orgName = 'Hastane LMS',
  orgCode,
  userName = 'Kullanıcı',
  userRole = 'Admin',
  userAvatar,
  userInitials = 'KL',
}: AppSidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = useCallback((href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  }, []);

  const isActive = useCallback((href: string) => pathname === href || pathname.startsWith(href + '/'), [pathname]);
  const isGroupActive = useCallback((href: string, children?: { href: string }[]) => {
    if (isActive(href)) return true;
    return children?.some((child) => isActive(child.href)) ?? false;
  }, [isActive]);

  /* ────────────────────────────────────────────
     Collapsed rail (72 px) — always visible
     Expanded panel (280 px) — slides over content
     Main content margin is always 72px.
     ──────────────────────────────────────────── */

  return (
    <>
      {/* ── Collapsed Rail (always visible, 72px) ── */}
      <aside
        className="fixed top-0 left-0 z-50 h-screen flex flex-col items-center border-r"
        style={{
          width: 72,
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center shrink-0">
          <button
            onClick={onToggleCollapse}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white active:scale-90"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #0f4a35 100%)',
              boxShadow: '0 2px 8px rgba(13,150,104,0.3)',
              transition: 'transform 100ms ease',
            }}
          >
            H
          </button>
        </div>

        <div className="h-px w-10 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Icon nav */}
        <ScrollArea className="flex-1 py-3 w-full">
          <nav className="flex flex-col items-center gap-1 px-2">
            {navGroups.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              const active = isGroupActive(item.href, item.children);
              const hasChildren = item.children && item.children.length > 0;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    render={<Link href={hasChildren ? item.children![0].href : item.href} />}
                    className="flex h-10 w-10 items-center justify-center rounded-xl icon-btn"
                    style={{
                      background: active ? 'var(--color-primary-light)' : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="h-px w-10 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Help */}
        <div className="py-2 shrink-0">
          <Tooltip>
            <TooltipTrigger
              render={<Link href="#" />}
              className="flex h-10 w-10 items-center justify-center rounded-xl icon-btn"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <HelpCircle className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent side="right">Yardım & Destek</TooltipContent>
          </Tooltip>
        </div>

        <div className="h-px w-10 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* User avatar */}
        <div className="py-3 shrink-0">
          <Tooltip>
            <TooltipTrigger
              onClick={onToggleCollapse}
              className="cursor-pointer"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={userAvatar} />
                <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="right">{userName}</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* ── Expanded Panel (slides from left) ── */}
      {/* Backdrop */}
      <div
        onClick={onToggleCollapse}
        className="fixed inset-0 z-[55]"
        style={{
          background: 'rgba(0,0,0,0.15)',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: 'opacity 300ms ease',
          backdropFilter: collapsed ? 'none' : 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 left-0 z-[60] h-screen flex flex-col border-r"
        style={{
          width: 280,
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: collapsed ? 'none' : '4px 0 25px rgba(0,0,0,0.08)',
          transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 350ms ease',
        }}
      >
        {/* Header */}
        <div className="flex h-16 items-center gap-3 px-4 shrink-0">
          <button
            onClick={onToggleCollapse}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #0f4a35 100%)',
              boxShadow: '0 2px 8px rgba(13,150,104,0.3)',
            }}
          >
            H
          </button>
          <div className="flex flex-1 items-center justify-between min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{orgName}</p>
              {orgCode && <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{orgCode}</p>}
            </div>
            <button
              onClick={onToggleCollapse}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg icon-btn"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-px mx-3 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Full navigation */}
        <ScrollArea className="flex-1 px-3 py-3">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className={cn(groupIdx > 0 && 'mt-4')}>
              {group.label && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  {group.label}
                </p>
              )}
              <nav className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isGroupActive(item.href, item.children);
                  const expanded = expandedItems.includes(item.href);
                  const hasChildren = item.children && item.children.length > 0;

                  return (
                    <div key={item.href}>
                      {hasChildren ? (
                        <button
                          onClick={() => toggleExpand(item.href)}
                          className="nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium active:scale-[0.98] active:duration-75"
                          data-active={active}
                          style={{
                            background: active ? 'var(--color-primary-light)' : 'transparent',
                            color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-left truncate">{item.title}</span>
                          <ChevronDown
                            className="h-4 w-4 shrink-0"
                            style={{
                              transform: expanded ? 'rotate(0)' : 'rotate(-90deg)',
                              transition: 'transform 200ms ease',
                            }}
                          />
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={onToggleCollapse}
                          className="nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium active:scale-[0.98] active:duration-75"
                          data-active={active}
                          style={{
                            background: active ? 'var(--color-primary-light)' : 'transparent',
                            color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--color-accent)', color: 'white' }}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )}

                      {/* Submenu */}
                      {hasChildren && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateRows: expanded ? '1fr' : '0fr',
                            opacity: expanded ? 1 : 0,
                            transition: 'grid-template-rows 250ms ease, opacity 200ms ease',
                          }}
                        >
                          <div className="overflow-hidden">
                            <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l-2 pl-4" style={{ borderColor: 'var(--color-border)' }}>
                              {item.children!.map((child) => {
                                const childActive = isActive(child.href);
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    onClick={onToggleCollapse}
                                    className="rounded-md px-3 py-2 text-sm transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] active:scale-[0.98] active:duration-75"
                                    style={{
                                      background: childActive ? 'var(--color-primary-light)' : 'transparent',
                                      color: childActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                      fontWeight: childActive ? 600 : 400,
                                    }}
                                  >
                                    {child.title}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          ))}
        </ScrollArea>

        <div className="h-px mx-3 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Help */}
        <div className="px-3 py-1.5 shrink-0">
          <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium nav-item" style={{ color: 'var(--color-text-secondary)' }}>
            <HelpCircle className="h-5 w-5" />
            <span>Yardım & Destek</span>
          </Link>
        </div>

        <div className="h-px mx-3 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* User */}
        <div className="flex items-center gap-3 p-4 shrink-0">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={userAvatar} />
            <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{userRole}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/auth/login';
              }}
              className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium icon-btn"
              style={{ color: 'var(--color-danger, #ef4444)' }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
