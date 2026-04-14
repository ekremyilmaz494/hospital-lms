'use client';

import { useState, useCallback, memo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, HelpCircle, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAiGenerationStore, selectUnviewedCount, selectActiveCount } from '@/store/ai-generation-store';
import type { NavGroup } from './sidebar-config';

/** AI badge — kendi store subscription'ı ile izole, sidebar'ı re-render etmez */
function AiBadgeCount() {
  const aiActiveCount = useAiGenerationStore(selectActiveCount);
  const aiUnviewedCount = useAiGenerationStore(selectUnviewedCount);
  const count = aiActiveCount + aiUnviewedCount;
  if (count === 0) return null;
  return (
    <span
      className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{
        background: aiActiveCount > 0 ? 'var(--color-warning)' : 'var(--color-primary)',
        color: 'white',
        animation: aiActiveCount > 0 ? 'pulse 2s infinite' : 'none',
      }}
    >
      {aiActiveCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      {count}
    </span>
  );
}

/** pathname izolasyonu — sadece bu wrapper re-render olur, parent sidebar değil */
function NavItemActive({ href, childHrefs, render }: {
  href: string;
  childHrefs?: { href: string }[];
  render: (active: boolean) => React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  const groupActive = active || (childHrefs?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')) ?? false);
  return <>{render(groupActive)}</>;
}

/** Submenu child item — kendi pathname kontrolü */
function ChildNavLink({ href, title, onClick }: { href: string; title: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-md px-3 py-2 text-sm transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] active:scale-[0.98] active:duration-75"
      style={{
        background: active ? 'var(--color-primary-light)' : 'transparent',
        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {title}
    </Link>
  );
}

interface AppSidebarProps {
  navGroups: NavGroup[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  orgName?: string;
  orgCode?: string;
  orgLogoUrl?: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
}

export const AppSidebar = memo(function AppSidebar({
  navGroups,
  collapsed = false,
  onToggleCollapse,
  orgName = 'Devakent Hastanesi',
  orgCode,
  orgLogoUrl,
  userName = 'Kullanıcı',
  userRole = 'Admin',
  userAvatar,
  userInitials = 'KL',
}: AppSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toggleExpand = useCallback((href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setIsHovered(true), 400);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setIsHovered(false), 500);
  }, []);

  /** Nav link tıklandığında sidebar'ı hemen kapat */
  const closeSidebar = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setIsHovered(false);
  }, []);

  useEffect(() => {
    return () => { clearTimeout(hoverTimerRef.current); };
  }, []);

  /** Panel yalnızca hover ile kontrol edilir */
  const showExpanded = isHovered;

  /* ────────────────────────────────────────────
     Collapsed rail (72 px) — always visible
     Expanded panel (280 px) — slides over content
     Main content margin is always 72px.
     ──────────────────────────────────────────── */

  return (
    <>
      {/* ── Collapsed Rail (always visible, 72px) ── */}
      <aside
        className="fixed top-0 left-0 z-50 h-screen overflow-hidden flex flex-col items-center border-r"
        style={{
          width: 72,
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center shrink-0">
          {orgLogoUrl ? (
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden active:scale-90"
              style={{ transition: 'transform 100ms ease' }}
            >
              <Image src={orgLogoUrl} alt={orgName} width={40} height={40} className="object-contain" unoptimized />
            </button>
          ) : (
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
          )}
        </div>

        <div className="h-px w-10 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Icon nav */}
        <ScrollArea className="flex-1 min-h-0 py-3 w-full">
          <nav className="flex flex-col items-center gap-1 px-2">
            {navGroups.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              return (
                <NavItemActive key={item.href} href={item.href} childHrefs={item.children} render={(active) => (
                  <Tooltip>
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
                )} />
              );
            })}
          </nav>
        </ScrollArea>

        <div className="h-px w-10 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Help */}
        <div className="py-2 shrink-0">
          <Tooltip>
            <TooltipTrigger
              render={<Link href="/help" />}
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

      {/* ── Expanded Panel (slides from left, hover ile açılır) ── */}
      <div
        className="fixed top-0 left-0 z-[60] h-screen overflow-hidden flex flex-col border-r"
        style={{
          width: 280,
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: showExpanded ? '4px 0 25px rgba(0,0,0,0.08)' : 'none',
          transform: showExpanded ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 500ms ease',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="flex h-16 items-center gap-3 px-4 shrink-0">
          {orgLogoUrl ? (
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden"
            >
              <Image src={orgLogoUrl} alt={orgName} width={40} height={40} className="object-contain" unoptimized />
            </button>
          ) : (
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
          )}
          <div className="flex flex-1 items-center justify-between min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{orgName}</p>
              {orgCode && <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{orgCode}</p>}
            </div>
            <button
              onClick={closeSidebar}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg icon-btn"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-px mx-3 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Full navigation */}
        <ScrollArea className="flex-1 min-h-0 px-3 py-3">
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
                  const expanded = expandedItems.includes(item.href);
                  const hasChildren = item.children && item.children.length > 0;

                  return (
                    <NavItemActive key={item.href} href={item.href} childHrefs={item.children} render={(active) => (
                      <div>
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
                            onClick={closeSidebar}
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
                            {item.href === '/admin/ai-content-studio' ? (
                              <AiBadgeCount />
                            ) : item.badge ? (
                              <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--color-accent)', color: 'white' }}>
                                {item.badge}
                              </span>
                            ) : null}
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
                                {item.children!.map((child) => (
                                  <ChildNavLink key={child.href} href={child.href} title={child.title} onClick={closeSidebar} />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )} />
                  );
                })}
              </nav>
            </div>
          ))}
        </ScrollArea>

        <div className="h-px mx-3 shrink-0" style={{ background: 'var(--color-border)' }} />

        {/* Help */}
        <div className="px-3 py-1.5 shrink-0">
          <Link href="/help" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium nav-item" style={{ color: 'var(--color-text-secondary)' }}>
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
                try {
                  await fetch('/api/auth/logout', { method: 'POST' });
                } catch {
                  // Ignore errors — redirect to login regardless
                }
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
});
