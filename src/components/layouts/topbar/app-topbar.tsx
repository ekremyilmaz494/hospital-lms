'use client';

/**
 * AppTopbar — Klinova emerald chrome.
 * Minimalist white surface, emerald accents, professional SaaS feel.
 * Behavior unchanged: search · theme · notifications · user menu dropdowns.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, X, User, Bell, LogOut, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { NotificationBell } from '@/components/shared/notification-bell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getRolePath } from '@/lib/route-helpers';

/* ─── Klinova palette (chrome — fixed hex, not themed) ─── */
const K = {
  PRIMARY: '#0d9668',
  PRIMARY_HOVER: '#087a54',
  PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff',
  SURFACE_HOVER: '#f5f5f4',
  BG: '#fafaf9',
  BORDER: '#c9c4be',
  BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  ERROR: '#ef4444',
  ERROR_TEXT: '#b91c1c',
  ERROR_BG: '#fee2e2',
  SHADOW_CARD: '0 8px 24px rgba(15, 23, 42, 0.08)',
  FONT_DISPLAY: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", system-ui, sans-serif',
};

interface AppTopbarProps {
  title: string;
  subtitle?: string;
  orgName?: string;
  onToggleSidebar?: () => void;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
  unreadNotifications?: number;
}

export function AppTopbar({
  title,
  orgName,
  onToggleSidebar,
  userName = 'Kullanıcı',
  userRole = 'Admin',
  userAvatar,
  userInitials = 'KL',
  unreadNotifications = 0,
}: AppTopbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useAuthStore();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().setUser(null);
    router.push('/auth/login');
  };

  const profilePath = getRolePath(user?.role, 'settings');
  const notificationsPath = getRolePath(user?.role, 'notifications');

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 px-4 sm:px-6"
      style={{
        backgroundColor: K.SURFACE,
        borderBottom: `1px solid ${K.BORDER_LIGHT}`,
        color: K.TEXT_PRIMARY,
      }}
    >
      {/* ── Left: hamburger (mobile) + masthead meta ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Menüyü aç"
          className="inline-flex h-10 w-10 items-center justify-center md:hidden transition-colors"
          style={{ color: K.TEXT_SECONDARY, background: 'transparent', borderRadius: '8px' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = K.SURFACE_HOVER; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        {(orgName || title) && (
          <div className="flex items-center gap-2 min-w-0">
            {orgName && (
              <p
                className="text-[13px] font-semibold truncate hidden sm:block"
                style={{
                  color: K.TEXT_PRIMARY,
                  fontFamily: K.FONT_DISPLAY,
                }}
              >
                {orgName}
              </p>
            )}
            {orgName && title && (
              <span
                className="hidden sm:inline-block text-[13px]"
                style={{ color: K.TEXT_MUTED }}
              >
                /
              </span>
            )}
            {title && (
              <p
                className="text-[13px] font-medium truncate"
                style={{
                  color: K.TEXT_MUTED,
                  fontFamily: K.FONT_DISPLAY,
                }}
              >
                {title}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        <div className={searchOpen ? 'relative w-56 sm:w-64' : 'relative'}>
          {searchOpen ? (
            <div className="flex items-center">
              <Search
                className="absolute left-2.5 h-3.5 w-3.5"
                style={{ color: K.TEXT_MUTED }}
              />
              <input
                placeholder="Ara..."
                autoFocus
                onBlur={() => setSearchOpen(false)}
                className="w-full pl-8 pr-8 h-9 text-[13px] focus:outline-none"
                style={{
                  backgroundColor: K.BG,
                  color: K.TEXT_PRIMARY,
                  border: `1px solid ${K.BORDER_LIGHT}`,
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
                }}
              />
              <button
                className="absolute right-2"
                onClick={() => setSearchOpen(false)}
                aria-label="Aramayı kapat"
              >
                <X className="h-3.5 w-3.5" style={{ color: K.TEXT_MUTED }} />
              </button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center"
                style={{
                  color: K.TEXT_MUTED,
                  borderRadius: '9999px',
                  backgroundColor: 'transparent',
                  transition: 'color 160ms ease, background-color 160ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = K.TEXT_SECONDARY; e.currentTarget.style.backgroundColor = K.SURFACE_HOVER; }}
                onMouseLeave={e => { e.currentTarget.style.color = K.TEXT_MUTED; e.currentTarget.style.backgroundColor = 'transparent'; }}
                aria-label="Ara"
              >
                <Search className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>Ara (⌘K)</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Notifications */}
        <NotificationBell unreadCount={unreadNotifications} />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              height: 40,
              padding: '0 10px',
              borderRadius: 9999,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = K.SURFACE_HOVER; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Avatar className="h-9 w-9 shrink-0" style={{ border: `1.5px solid ${K.PRIMARY_LIGHT}` }}>
              <AvatarImage src={userAvatar} />
              <AvatarFallback
                className="text-[12px] font-semibold"
                style={{
                  backgroundColor: K.PRIMARY_LIGHT,
                  color: K.PRIMARY,
                  fontFamily: K.FONT_DISPLAY,
                }}
              >
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <span
              className="hidden md:flex"
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                lineHeight: 1.15,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: K.TEXT_PRIMARY,
                  fontFamily: K.FONT_DISPLAY,
                }}
              >
                {userName}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: K.TEXT_MUTED,
                  fontFamily: K.FONT_DISPLAY,
                  marginTop: 2,
                }}
              >
                {userRole}
              </span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 p-0 overflow-hidden border-0"
            style={{
              backgroundColor: K.SURFACE,
              background: K.SURFACE,
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: `1px solid ${K.BORDER_LIGHT}`,
              borderRadius: '12px',
              boxShadow: K.SHADOW_CARD,
            }}
          >
            {/* Header card */}
            <div
              className="px-4 pt-4 pb-4 flex items-center gap-3"
              style={{
                backgroundColor: K.BG,
                borderBottom: `1px solid ${K.BORDER_LIGHT}`,
              }}
            >
              <Avatar className="h-11 w-11 shrink-0" style={{ border: `1.5px solid ${K.PRIMARY_LIGHT}` }}>
                <AvatarImage src={userAvatar} />
                <AvatarFallback
                  className="text-[14px] font-semibold"
                  style={{
                    backgroundColor: K.PRIMARY_LIGHT,
                    color: K.PRIMARY,
                    fontFamily: K.FONT_DISPLAY,
                  }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[14px] font-bold truncate"
                  style={{
                    color: K.TEXT_PRIMARY,
                    fontFamily: K.FONT_DISPLAY,
                  }}
                >
                  {userName}
                </p>
                <p
                  className="text-[12px] font-medium mt-0.5"
                  style={{
                    color: K.TEXT_MUTED,
                    fontFamily: K.FONT_DISPLAY,
                  }}
                >
                  {userRole}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="py-1">
              <KlinovaMenuItem
                icon={User}
                label="Profilim"
                onClick={() => router.push(profilePath)}
              />
              <KlinovaMenuItem
                icon={Bell}
                label="Bildirimler"
                onClick={() => router.push(notificationsPath)}
                badge={unreadNotifications > 0 ? unreadNotifications : undefined}
              />
            </div>

            <DropdownMenuSeparator style={{ backgroundColor: K.BORDER_LIGHT }} />

            <div className="py-1">
              <DropdownMenuItem
                onClick={handleLogout}
                onSelect={e => e.preventDefault()}
                className="cursor-pointer relative"
                style={{
                  borderRadius: '8px',
                  margin: '0 4px',
                  color: K.ERROR_TEXT,
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
                  transition: 'background-color 160ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = K.ERROR_BG; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                <span>Çıkış Yap</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function KlinovaMenuItem({
  icon: Icon, label, active, onClick, badge,
}: {
  icon: typeof User;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      onSelect={e => e.preventDefault()}
      className="cursor-pointer relative"
      style={{
        borderRadius: '8px',
        margin: '0 4px',
        padding: '10px 12px',
        fontSize: '13px',
        fontWeight: active ? 600 : 500,
        color: active ? K.TEXT_PRIMARY : K.TEXT_SECONDARY,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        backgroundColor: 'transparent',
        transition: 'background-color 160ms ease, color 160ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = K.SURFACE_HOVER; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <Icon className="h-3.5 w-3.5 mr-2" style={{ color: active ? K.PRIMARY : K.TEXT_SECONDARY }} />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none"
          style={{
            color: K.PRIMARY,
            backgroundColor: K.PRIMARY_LIGHT,
            borderRadius: '9999px',
            fontFamily: K.FONT_DISPLAY,
          }}
        >
          {badge}
        </span>
      )}
      {active && !badge && (
        <Check className="ml-auto h-3.5 w-3.5" style={{ color: K.PRIMARY }} />
      )}
    </DropdownMenuItem>
  );
}
