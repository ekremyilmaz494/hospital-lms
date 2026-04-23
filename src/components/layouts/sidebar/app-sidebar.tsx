'use client';

/**
 * AppSidebar — "Clinical Editorial" redesign.
 * Dark INK masthead column (gazete mast'ı hissi) + gold aktif rail + cream metin.
 * Davranış aynı: 72px collapsed rail + hover'da açılan 280px panel + submenu expand.
 */

import { useState, useCallback, memo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, HelpCircle, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavGroup } from './sidebar-config';

/* ─── Editorial palette ───
 * Desktop sidebar is intentionally a fixed dark "masthead" (gazete mast başlığı),
 * not themed by light/dark toggle. These stay hex, unlike the rest of staff panel. */
const INK = '#0a1628';
const INK_DEEP = '#061021';
const CREAM = '#f4ead5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';
const HAIRLINE = 'rgba(244, 234, 213, 0.08)';
const TEXT_DIM = 'rgba(250, 247, 242, 0.58)';
const TEXT_BASE = 'rgba(250, 247, 242, 0.82)';
const HOVER_BG = 'rgba(250, 247, 242, 0.04)';
const ACTIVE_BG = 'rgba(201, 169, 97, 0.08)';

/** pathname izolasyonu — sadece bu wrapper re-render olur */
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

/** Submenu child item */
function ChildNavLink({ href, title, onClick }: { href: string; title: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      onClick={onClick}
      className="relative group block px-3 py-1.5 text-[12px]"
      style={{
        color: active ? CREAM : TEXT_DIM,
        fontWeight: active ? 600 : 400,
        borderRadius: '2px',
        transition: 'color 160ms ease, background-color 160ms ease',
        backgroundColor: active ? ACTIVE_BG : 'transparent',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = CREAM; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = TEXT_DIM; }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{ width: 3, height: 14, backgroundColor: GOLD, borderRadius: '1px' }}
        />
      )}
      <span className="ml-1">{title}</span>
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
    setExpandedItems(prev =>
      prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href],
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

  const closeSidebar = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setIsHovered(false);
  }, []);

  useEffect(() => {
    return () => { clearTimeout(hoverTimerRef.current); };
  }, []);

  const showExpanded = isHovered;

  const darkBg = `linear-gradient(180deg, ${INK_DEEP} 0%, ${INK} 100%)`;

  return (
    <>
      {/* ═══════ Collapsed Rail (72px) ═══════ */}
      <aside
        className="fixed top-0 left-0 z-50 h-screen overflow-hidden flex flex-col items-center"
        style={{
          width: 72,
          background: darkBg,
          borderRight: `1px solid ${HAIRLINE}`,
          color: CREAM,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Logo tile */}
        <div className="flex h-16 w-full items-center justify-center shrink-0" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          {orgLogoUrl ? (
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-10 items-center justify-center overflow-hidden"
              style={{
                backgroundColor: CREAM,
                borderRadius: '2px',
                border: `1px solid ${GOLD}`,
                transition: 'transform 120ms ease',
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              aria-label="Paneli genişlet"
            >
              <Image src={orgLogoUrl} alt={orgName} width={36} height={36} className="object-contain" unoptimized />
            </button>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-10 items-center justify-center text-[18px] font-semibold"
              style={{
                backgroundColor: GOLD,
                color: INK,
                borderRadius: '2px',
                fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                transition: 'transform 120ms ease',
              }}
              aria-label="Paneli genişlet"
            >
              H
            </button>
          )}
        </div>

        {/* Icon nav */}
        <ScrollArea className="flex-1 min-h-0 py-3 w-full">
          <nav className="flex flex-col items-center gap-0.5 px-2">
            {navGroups.flatMap(g => g.items).map(item => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              return (
                <NavItemActive key={item.href} href={item.href} childHrefs={item.children} render={active => (
                  <Tooltip>
                    <TooltipTrigger
                      render={<Link href={hasChildren ? item.children![0].href : item.href} />}
                      className="relative flex h-10 w-10 items-center justify-center"
                      style={{
                        color: active ? CREAM : TEXT_DIM,
                        backgroundColor: active ? ACTIVE_BG : 'transparent',
                        borderRadius: '2px',
                        transition: 'color 160ms ease, background-color 160ms ease',
                      }}
                      onMouseEnter={e => {
                        if (!active) { e.currentTarget.style.color = CREAM; e.currentTarget.style.backgroundColor = HOVER_BG; }
                      }}
                      onMouseLeave={e => {
                        if (!active) { e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.backgroundColor = 'transparent'; }
                      }}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 -translate-y-1/2"
                          style={{ width: 3, height: 16, backgroundColor: GOLD, borderRadius: '1px' }}
                        />
                      )}
                      <Icon className="h-[18px] w-[18px]" />
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                )} />
              );
            })}
          </nav>
        </ScrollArea>

        {/* Help + Avatar */}
        <div className="w-full shrink-0" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <div className="flex justify-center py-2">
            <Tooltip>
              <TooltipTrigger
                render={<Link href="/help" />}
                className="flex h-10 w-10 items-center justify-center"
                style={{ color: TEXT_DIM, borderRadius: '2px', transition: 'color 160ms ease, background-color 160ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = CREAM; e.currentTarget.style.backgroundColor = HOVER_BG; }}
                onMouseLeave={e => { e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <HelpCircle className="h-[18px] w-[18px]" />
              </TooltipTrigger>
              <TooltipContent side="right">Yardım & Destek</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex justify-center py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <Tooltip>
              <TooltipTrigger onClick={onToggleCollapse} className="cursor-pointer">
                <Avatar className="h-9 w-9" style={{ border: `1.5px solid ${GOLD}` }}>
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback
                    className="text-[11px] font-semibold"
                    style={{
                      backgroundColor: OLIVE,
                      color: CREAM,
                      fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                    }}
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">{userName}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>

      {/* ═══════ Expanded Panel (280px) ═══════ */}
      <div
        className="fixed top-0 left-0 z-[60] h-screen overflow-hidden flex flex-col"
        style={{
          width: 280,
          background: darkBg,
          borderRight: `1px solid ${HAIRLINE}`,
          color: CREAM,
          boxShadow: showExpanded ? '8px 0 40px rgba(6, 16, 33, 0.35)' : 'none',
          transform: showExpanded ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 420ms cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 420ms ease',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Header: Masthead ── */}
        <div
          className="flex h-16 items-center gap-3 px-4 shrink-0"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          {orgLogoUrl ? (
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden"
              style={{ backgroundColor: CREAM, borderRadius: '2px', border: `1px solid ${GOLD}` }}
            >
              <Image src={orgLogoUrl} alt={orgName} width={36} height={36} className="object-contain" unoptimized />
            </button>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-[18px] font-semibold"
              style={{
                backgroundColor: GOLD,
                color: INK,
                borderRadius: '2px',
                fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
              }}
            >
              H
            </button>
          )}
          <div className="flex flex-1 items-center justify-between min-w-0 gap-2">
            <div className="min-w-0">
              <p
                className="text-[13px] font-semibold tracking-[-0.01em] truncate"
                style={{ color: CREAM, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                {orgName}
              </p>
              {orgCode && (
                <p
                  className="text-[9px] uppercase tracking-[0.18em] mt-0.5"
                  style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  № {orgCode}
                </p>
              )}
            </div>
            <button
              onClick={closeSidebar}
              className="shrink-0 flex h-8 w-8 items-center justify-center"
              style={{
                color: TEXT_DIM,
                borderRadius: '2px',
                transition: 'color 160ms ease, background-color 160ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = CREAM; e.currentTarget.style.backgroundColor = HOVER_BG; }}
              onMouseLeave={e => { e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.backgroundColor = 'transparent'; }}
              aria-label="Paneli kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <ScrollArea className="flex-1 min-h-0 py-4">
          <div className="px-3">
            {navGroups.map((group, groupIdx) => (
              <div key={groupIdx} className={cn(groupIdx > 0 && 'mt-6')}>
                {group.label && (
                  <div
                    className="flex items-center gap-2 px-2 mb-2"
                    style={{ color: GOLD }}
                  >
                    <span
                      className="inline-block"
                      style={{ width: 16, height: 1, backgroundColor: GOLD }}
                    />
                    <p
                      className="text-[9px] font-semibold tracking-[0.22em] uppercase"
                      style={{ fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      {group.label}
                    </p>
                  </div>
                )}
                <nav className="flex flex-col gap-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const expanded = expandedItems.includes(item.href);
                    const hasChildren = item.children && item.children.length > 0;

                    return (
                      <NavItemActive key={item.href} href={item.href} childHrefs={item.children} render={active => (
                        <div>
                          {hasChildren ? (
                            <button
                              onClick={() => toggleExpand(item.href)}
                              className="relative flex w-full items-center gap-3 px-3 py-2.5 text-[13px]"
                              style={{
                                color: active ? CREAM : TEXT_BASE,
                                backgroundColor: active ? ACTIVE_BG : 'transparent',
                                fontWeight: active ? 600 : 500,
                                borderRadius: '2px',
                                transition: 'color 160ms ease, background-color 160ms ease, padding 160ms ease',
                              }}
                              onMouseEnter={e => {
                                if (!active) { e.currentTarget.style.color = CREAM; e.currentTarget.style.backgroundColor = HOVER_BG; }
                                e.currentTarget.style.paddingLeft = '14px';
                              }}
                              onMouseLeave={e => {
                                if (!active) { e.currentTarget.style.color = TEXT_BASE; e.currentTarget.style.backgroundColor = 'transparent'; }
                                e.currentTarget.style.paddingLeft = '12px';
                              }}
                            >
                              {active && (
                                <span
                                  aria-hidden
                                  className="absolute left-0 top-1/2 -translate-y-1/2"
                                  style={{ width: 3, height: 20, backgroundColor: GOLD, borderRadius: '1px' }}
                                />
                              )}
                              <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: active ? GOLD : 'inherit' }} />
                              <span className="flex-1 text-left truncate">{item.title}</span>
                              <ChevronDown
                                className="h-3.5 w-3.5 shrink-0"
                                style={{
                                  color: TEXT_DIM,
                                  transform: expanded ? 'rotate(0)' : 'rotate(-90deg)',
                                  transition: 'transform 220ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                                }}
                              />
                            </button>
                          ) : (
                            <Link
                              href={item.href}
                              onClick={closeSidebar}
                              className="relative flex items-center gap-3 px-3 py-2.5 text-[13px]"
                              style={{
                                color: active ? CREAM : TEXT_BASE,
                                backgroundColor: active ? ACTIVE_BG : 'transparent',
                                fontWeight: active ? 600 : 500,
                                borderRadius: '2px',
                                transition: 'color 160ms ease, background-color 160ms ease, padding 160ms ease',
                              }}
                              onMouseEnter={e => {
                                if (!active) { e.currentTarget.style.color = CREAM; e.currentTarget.style.backgroundColor = HOVER_BG; }
                                e.currentTarget.style.paddingLeft = '14px';
                              }}
                              onMouseLeave={e => {
                                if (!active) { e.currentTarget.style.color = TEXT_BASE; e.currentTarget.style.backgroundColor = 'transparent'; }
                                e.currentTarget.style.paddingLeft = '12px';
                              }}
                            >
                              {active && (
                                <span
                                  aria-hidden
                                  className="absolute left-0 top-1/2 -translate-y-1/2"
                                  style={{ width: 3, height: 20, backgroundColor: GOLD, borderRadius: '1px' }}
                                />
                              )}
                              <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: active ? GOLD : 'inherit' }} />
                              <span className="flex-1 truncate">{item.title}</span>
                              {item.badge ? (
                                <span
                                  className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                                  style={{
                                    color: INK,
                                    backgroundColor: GOLD,
                                    borderRadius: '2px',
                                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                                  }}
                                >
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
                                transition: 'grid-template-rows 280ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 200ms ease',
                              }}
                            >
                              <div className="overflow-hidden">
                                <div
                                  className="ml-6 mt-1 flex flex-col gap-0.5 pl-4"
                                  style={{ borderLeft: `1px solid ${HAIRLINE}` }}
                                >
                                  {item.children!.map(child => (
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
          </div>
        </ScrollArea>

        {/* ── Footer: Help ── */}
        <div className="px-3 py-2 shrink-0" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <Link
            href="/help"
            className="flex items-center gap-3 px-3 py-2 text-[13px]"
            style={{
              color: TEXT_BASE,
              fontWeight: 500,
              borderRadius: '2px',
              transition: 'color 160ms ease, background-color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = CREAM; e.currentTarget.style.backgroundColor = HOVER_BG; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT_BASE; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <HelpCircle className="h-[18px] w-[18px]" />
            <span>Yardım & Destek</span>
          </Link>
        </div>

        {/* ── User card ── */}
        <div
          className="flex items-center gap-3 p-3 shrink-0"
          style={{ borderTop: `1px solid ${HAIRLINE}`, backgroundColor: 'rgba(250, 247, 242, 0.02)' }}
        >
          <Avatar className="h-10 w-10 shrink-0" style={{ border: `1.5px solid ${GOLD}` }}>
            <AvatarImage src={userAvatar} />
            <AvatarFallback
              className="text-[12px] font-semibold"
              style={{
                backgroundColor: OLIVE,
                color: CREAM,
                fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
              }}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <p
                className="truncate text-[13px] font-semibold tracking-[-0.01em]"
                style={{ color: CREAM, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                {userName}
              </p>
              <p
                className="text-[9px] uppercase tracking-[0.18em] mt-0.5"
                style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                {userRole}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST' });
                } catch {
                  // Ignore — redirect regardless
                }
                window.location.href = '/auth/login';
              }}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: '#f4a9a1',
                border: `1px solid rgba(244, 169, 161, 0.3)`,
                borderRadius: '2px',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = CREAM;
                e.currentTarget.style.backgroundColor = '#b3261e';
                e.currentTarget.style.borderColor = '#b3261e';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#f4a9a1';
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(244, 169, 161, 0.3)';
              }}
            >
              <LogOut className="h-3 w-3" />
              Çıkış
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
