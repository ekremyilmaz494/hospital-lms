'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, User, LogOut } from 'lucide-react';
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
import { getRolePath } from '@/lib/route-helpers';

interface AdminTopbarProps {
  title?: string;
  orgName?: string;
  onToggleSidebar?: () => void;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
}

export function AdminTopbar({
  onToggleSidebar,
  userName = 'Kullanıcı',
  userRole = 'Admin',
  userAvatar,
  userInitials = 'KL',
}: AdminTopbarProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchValue, setSearchValue] = useState('');

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().setUser(null);
    router.push('/auth/login');
  };

  return (
    <header className="k-topbar" role="banner">
      <button
        type="button"
        className="k-topbar-menu"
        onClick={onToggleSidebar}
        aria-label="Menüyü aç"
      >
        <Menu size={18} />
      </button>

      <div className="k-topbar-search">
        <Search size={15} aria-hidden />
        <input
          type="search"
          placeholder="Eğitim, personel veya sayfa ara…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          aria-label="Arama"
        />
        <kbd aria-hidden>⌘K</kbd>
      </div>

      <div className="k-topbar-actions">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Kullanıcı menüsü"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 12px 4px 4px',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 9999,
              cursor: 'pointer',
              transition: 'background 160ms ease, border-color 160ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--k-surface-hover)'; e.currentTarget.style.borderColor = 'var(--k-border)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <Avatar style={{ width: 32, height: 32, flexShrink: 0 }}>
              {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
              <AvatarFallback style={{ background: 'var(--k-primary)', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <span
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                lineHeight: 1.2,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--k-text-primary)' }}>
                {userName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--k-text-muted)', marginTop: 1 }}>
                {userRole}
              </span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => router.push(getRolePath(user?.role ?? 'admin', 'profile'))}
              >
                <User className="h-4 w-4" />
                <span>Profilim</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-red-600"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Çıkış Yap</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <style jsx>{`
        .k-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 14px;
          height: var(--k-topbar-h);
          padding: 0 20px;
          background: color-mix(in srgb, var(--k-surface) 88%, transparent);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--k-border);
        }

        .k-topbar-menu {
          width: 36px;
          height: 36px;
          border-radius: var(--k-radius-ctrl);
          background: transparent;
          border: none;
          color: var(--k-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease;
        }
        .k-topbar-menu:hover {
          background: var(--k-surface-hover);
          color: var(--k-text-primary);
        }
        /* Hamburger her viewport'ta gösterilir — mobilde drawer aç, desktop'ta collapse toggle */

        .k-topbar-search {
          position: relative;
          flex: 1;
          max-width: 420px;
          display: flex;
          align-items: center;
          gap: 10px;
          height: 38px;
          padding: 0 14px;
          background: var(--k-bg);
          border: 1px solid var(--k-border);
          border-radius: var(--k-radius-ctrl);
          color: var(--k-text-muted);
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .k-topbar-search:focus-within {
          border-color: var(--k-primary);
          background: var(--k-surface);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--k-primary) 14%, transparent);
        }
        .k-topbar-search input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 13px;
          color: var(--k-text-primary);
          font-family: inherit;
        }
        .k-topbar-search input::placeholder {
          color: var(--k-text-muted);
        }
        .k-topbar-search kbd {
          font-family: var(--font-mono, monospace);
          font-size: 10.5px;
          padding: 3px 6px;
          border-radius: 5px;
          background: var(--k-surface-hover);
          color: var(--k-text-muted);
          border: 1px solid var(--k-border);
        }
        @media (max-width: 640px) {
          .k-topbar-search {
            display: none;
          }
        }

        .k-topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .k-topbar-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--k-radius-ctrl);
          background: transparent;
          border: 1px solid transparent;
          color: var(--k-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .k-topbar-icon-btn:hover {
          background: var(--k-surface-hover);
          border-color: var(--k-border);
          color: var(--k-text-primary);
        }

        .k-topbar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 10px 4px 4px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--k-radius-pill);
          cursor: pointer;
          transition: background 160ms ease, border-color 160ms ease;
        }
        .k-topbar-user:hover {
          background: var(--k-surface-hover);
          border-color: var(--k-border);
        }
        :global(.k-topbar-avatar) {
          width: 30px !important;
          height: 30px !important;
        }
        :global(.k-topbar-avatar [data-slot='avatar-fallback']) {
          font-size: 11px;
          background: var(--k-primary);
          color: #fff;
        }
        .k-topbar-user-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.2;
        }
        .k-topbar-user-name {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--k-text-primary);
        }
        .k-topbar-user-role {
          font-size: 11px;
          color: var(--k-text-muted);
        }
        @media (max-width: 640px) {
          .k-topbar-user-meta {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
