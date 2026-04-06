'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, Moon, Search, Sun, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { NotificationBell } from '@/components/shared/notification-bell';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  subtitle,
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

  const profilePath = user?.role === 'admin' ? '/admin/settings' : user?.role === 'super_admin' ? '/super-admin/settings' : '/staff/profile';
  const notificationsPath = user?.role === 'staff' ? '/staff/notifications' : '/admin/notifications';

  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b px-6"
      style={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'rgba(var(--color-bg-rgb), 0.85)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Left side: Menu toggle */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="lg:hidden"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {(orgName || title) && (
          <div className="flex items-center gap-2">
            {orgName && (
              <>
                <p
                  className="text-sm font-semibold hidden sm:block"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--brand-primary, var(--color-text-primary))',
                  }}
                >
                  {orgName}
                </p>
                {title && (
                  <span className="hidden sm:block text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
                )}
              </>
            )}
            {title && (
              <p
                className="text-xs font-medium"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {title}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right side: Search + Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className={cn('relative', searchOpen ? 'w-64' : 'w-auto')}>
          {searchOpen ? (
            <div className="flex items-center">
              <Search
                className="absolute left-3 h-4 w-4"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <Input
                placeholder="Ara..."
                className="pl-9 pr-8 h-9 text-sm"
                autoFocus
                onBlur={() => setSearchOpen(false)}
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  fontFamily: 'var(--font-body)',
                }}
              />
              <button
                className="absolute right-2"
                onClick={() => setSearchOpen(false)}
              >
                <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
          ) : (
            <Tooltip >
              <TooltipTrigger
                render={<Button variant="ghost" size="icon" className="h-9 w-9" />}
                onClick={() => setSearchOpen(true)}
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Search className="h-4.5 w-4.5" />
              </TooltipTrigger>
              <TooltipContent>Ara (⌘K)</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Theme Toggle */}
        <Tooltip >
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" className="h-9 w-9" />}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Sun className="h-4.5 w-4.5 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" style={{ transition: 'transform var(--transition-base)' }} />
            <Moon className="absolute h-4.5 w-4.5 rotate-90 scale-0 dark:rotate-0 dark:scale-100" style={{ transition: 'transform var(--transition-base)' }} />
            <span className="sr-only">Tema değiştir</span>
          </TooltipTrigger>
          <TooltipContent>
            {theme === 'dark' ? 'Aydınlık Tema' : 'Karanlık Tema'}
          </TooltipContent>
        </Tooltip>

        {/* Notifications */}
        <NotificationBell unreadCount={unreadNotifications} />

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
            style={{ transition: 'background var(--transition-fast)' }}
          >
              <Avatar className="h-8 w-8">
                <AvatarImage src={userAvatar} />
                <AvatarFallback
                  className="text-xs font-semibold text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p
                  className="text-sm font-semibold leading-tight"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {userName}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {userRole}
                </p>
              </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="text-sm font-semibold">{userName}</p>
                <p className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
                  {userRole}
                </p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(profilePath)}>Profilim</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(notificationsPath)}>Bildirimler</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-500" onClick={handleLogout}>Çıkış Yap</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
