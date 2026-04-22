'use client';

/**
 * AppTopbar — "Clinical Editorial" redesign.
 * Cream masthead row + ink monospace meta + gold accents.
 * Arama · tema seçici · bildirim · kullanıcı menüsü (davranış aynı).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, Moon, Search, Sun, X, User, Bell, LogOut } from 'lucide-react';
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

/* ─── Editorial palette ─── */
/* Topbar is chrome — fixed hex, not themed. Stays solid cream always. */
const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';

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
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useAuthStore();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().setUser(null);
    router.push('/auth/login');
  };

  const profilePath = user?.role === 'admin'
    ? '/admin/settings'
    : user?.role === 'super_admin'
      ? '/super-admin/settings'
      : '/staff/profile';
  const notificationsPath = user?.role === 'staff' ? '/staff/notifications' : '/admin/notifications';

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 px-4 sm:px-6"
      style={{
        backgroundColor: '#faf7f2',
        borderBottom: '1px solid #0a1628',
        color: '#0a1628',
      }}
    >
      {/* ── Left: hamburger (mobile) + masthead meta ──
          Klasik Material/iOS navigation drawer pattern: top-left hamburger → drawer açılır.
          Mobile primary navigation kaynağı (md:hidden), desktop'ta sidebar vardır. */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Menüyü aç"
          className="inline-flex h-10 w-10 items-center justify-center md:hidden transition-colors"
          style={{ color: INK, background: 'transparent', borderRadius: '4px' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(10, 22, 40, 0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        {(orgName || title) && (
          <div className="flex items-center gap-2 min-w-0">
            {orgName && (
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.16em] truncate hidden sm:block"
                style={{
                  color: INK,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                }}
              >
                {orgName}
              </p>
            )}
            {orgName && title && (
              <span
                className="hidden sm:inline-block text-[12px]"
                style={{ color: GOLD }}
              >
                /
              </span>
            )}
            {title && (
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.14em] truncate"
                style={{
                  color: INK_SOFT,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
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
                style={{ color: INK_SOFT }}
              />
              <input
                placeholder="Ara..."
                autoFocus
                onBlur={() => setSearchOpen(false)}
                className="w-full pl-8 pr-8 h-9 text-[13px] focus:outline-none"
                style={{
                  backgroundColor: '#ffffff',
                  color: INK,
                  border: `1px solid ${INK}`,
                  borderRadius: '2px',
                  fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
                }}
              />
              <button
                className="absolute right-2"
                onClick={() => setSearchOpen(false)}
                aria-label="Aramayı kapat"
              >
                <X className="h-3.5 w-3.5" style={{ color: INK_SOFT }} />
              </button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center"
                style={{
                  color: INK_SOFT,
                  borderRadius: '2px',
                  backgroundColor: 'transparent',
                  transition: 'color 160ms ease, background-color 160ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = INK; e.currentTarget.style.backgroundColor = 'rgba(10, 22, 40, 0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = INK_SOFT; e.currentTarget.style.backgroundColor = 'transparent'; }}
                aria-label="Ara"
              >
                <Search className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>Ara (⌘K)</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Theme dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative inline-flex h-9 w-9 items-center justify-center"
            style={{
              color: INK_SOFT,
              borderRadius: '2px',
              backgroundColor: 'transparent',
              transition: 'color 160ms ease, background-color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = INK; e.currentTarget.style.backgroundColor = 'rgba(10, 22, 40, 0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = INK_SOFT; e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label="Tema ayarları"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" style={{ transition: 'transform 300ms ease' }} />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100" style={{ transition: 'transform 300ms ease' }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 p-0 overflow-hidden border-0"
            style={{
              backgroundColor: CREAM,
              background: CREAM,
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: `1px solid ${INK}`,
              borderRadius: '4px',
              boxShadow: '0 8px 24px rgba(6, 16, 33, 0.12)',
            }}
          >
            <div className="px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${RULE}` }}>
              <p
                className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                № Tema
              </p>
            </div>

            <DropdownMenuGroup>
              <EditorialMenuItem
                icon={Sun}
                label="Aydınlık"
                active={theme === 'light'}
                onClick={() => setTheme('light')}
              />
              <EditorialMenuItem
                icon={Moon}
                label="Karanlık"
                active={theme === 'dark'}
                onClick={() => setTheme('dark')}
              />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <NotificationBell unreadCount={unreadNotifications} />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2.5 px-2 py-1"
            style={{
              borderRadius: '2px',
              transition: 'background-color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(10, 22, 40, 0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Avatar className="h-8 w-8" style={{ border: `1.5px solid ${GOLD}` }}>
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
            <div className="hidden text-left md:block">
              <p
                className="text-[12px] font-semibold tracking-[-0.01em] leading-tight"
                style={{
                  color: INK,
                  fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                }}
              >
                {userName}
              </p>
              <p
                className="text-[9px] uppercase tracking-[0.18em] mt-0.5"
                style={{
                  color: GOLD,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                }}
              >
                {userRole}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 p-0 overflow-hidden border-0"
            style={{
              backgroundColor: CREAM,
              background: CREAM,
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: `1px solid ${INK}`,
              borderRadius: '4px',
              boxShadow: '0 8px 24px rgba(6, 16, 33, 0.12)',
            }}
          >
            {/* Header card */}
            <div
              className="px-4 pt-4 pb-4 flex items-center gap-3"
              style={{
                background: `linear-gradient(180deg, rgba(10, 22, 40, 0.03) 0%, transparent 100%)`,
                borderBottom: `1px solid ${RULE}`,
              }}
            >
              <Avatar className="h-12 w-12 shrink-0" style={{ border: `2px solid ${GOLD}` }}>
                <AvatarImage src={userAvatar} />
                <AvatarFallback
                  className="text-[15px] font-semibold"
                  style={{
                    backgroundColor: OLIVE,
                    color: CREAM,
                    fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                  }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                  style={{
                    color: INK_SOFT,
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  Oturum
                </p>
                <p
                  className="text-[15px] font-semibold tracking-[-0.01em] truncate"
                  style={{
                    color: INK,
                    fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                  }}
                >
                  {userName}
                </p>
                <p
                  className="text-[9px] uppercase tracking-[0.18em] mt-0.5"
                  style={{
                    color: GOLD,
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  {userRole}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="py-1">
              <EditorialMenuItem
                icon={User}
                label="Profilim"
                onClick={() => router.push(profilePath)}
              />
              <EditorialMenuItem
                icon={Bell}
                label="Bildirimler"
                onClick={() => router.push(notificationsPath)}
                badge={unreadNotifications > 0 ? unreadNotifications : undefined}
              />
            </div>

            <DropdownMenuSeparator style={{ backgroundColor: RULE }} />

            <div className="py-1">
              <DropdownMenuItem
                onClick={handleLogout}
                onSelect={e => e.preventDefault()}
                className="cursor-pointer relative group"
                style={{
                  borderRadius: 0,
                  color: '#b3261e',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
                  transition: 'background-color 160ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fdf5f2'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                <span>Çıkış Yap</span>
                <span
                  className="ml-auto text-[9px] uppercase tracking-[0.14em]"
                  style={{
                    color: '#b3261e',
                    opacity: 0.6,
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  →
                </span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function EditorialMenuItem({
  icon: Icon, label, active, onClick, badge,
}: {
  icon: typeof Sun;
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
        borderRadius: 0,
        padding: '10px 12px',
        fontSize: '13px',
        fontWeight: active ? 600 : 500,
        color: active ? INK : INK_SOFT,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        backgroundColor: active ? 'rgba(201, 169, 97, 0.08)' : 'transparent',
        transition: 'background-color 160ms ease, color 160ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = INK; e.currentTarget.style.backgroundColor = 'rgba(201, 169, 97, 0.06)'; }}
      onMouseLeave={e => {
        e.currentTarget.style.color = active ? INK : INK_SOFT;
        e.currentTarget.style.backgroundColor = active ? 'rgba(201, 169, 97, 0.08)' : 'transparent';
      }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{ width: 3, height: 16, backgroundColor: GOLD, borderRadius: '1px' }}
        />
      )}
      <Icon className="h-3.5 w-3.5 mr-2" style={{ color: active ? GOLD : INK_SOFT }} />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none"
          style={{
            color: INK,
            backgroundColor: GOLD,
            borderRadius: '2px',
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          }}
        >
          {badge}
        </span>
      )}
      {active && !badge && (
        <span
          className="ml-auto text-[11px] font-semibold"
          style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          ●
        </span>
      )}
    </DropdownMenuItem>
  );
}
