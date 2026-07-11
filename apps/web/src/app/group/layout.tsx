'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminSidebar } from '@/components/layouts/admin/admin-sidebar';
import { AdminTopbar } from '@/components/layouts/admin/admin-topbar';
import { MobileSidebarDrawer } from '@/components/layouts/mobile-sidebar-drawer';
import { MobileBottomNav, type MobileBottomNavItem } from '@/components/layouts/mobile-bottom-nav';
import { groupNav } from '@/components/layouts/sidebar/sidebar-config';
import { LayoutDashboard, Building2, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useMobile } from '@/hooks/use-mobile';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';
import { performLogout } from '@/lib/auth/logout';
import { hasGroupAuthority } from '@/lib/auth/group-authority';

const groupBottomNavItems: readonly MobileBottomNavItem[] = [
  { href: '/group/dashboard', label: 'Genel Bakış', icon: LayoutDashboard, rootHref: '/group/dashboard' },
  { href: '/group/organizations', label: 'Hastaneler', icon: Building2 },
  { href: '/group/reports', label: 'Raporlar', icon: BarChart3 },
];

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useMobile();
  useEffect(() => {
    const saved = localStorage.getItem('sidebar:group:collapsed');
    if (saved === 'true') setSidebarCollapsed(true);
  }, []);
  const { user, isLoading, fullName, initials } = useAuth();
  const router = useRouter();

  const isGroupOwner = !!user && hasGroupAuthority({ groupOwner: user.groupOwner, groupId: user.groupId });

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileDrawerOpen(true);
      return;
    }
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:group:collapsed', String(next));
  };

  const handleLogout = () => {
    void performLogout();
  };

  useEffect(() => {
    if (!isLoading && !isGroupOwner) {
      router.replace('/auth/login');
    }
  }, [isGroupOwner, isLoading, router]);

  if (isLoading) return <LayoutSkeleton variant="admin" />;
  if (!isGroupOwner) return null;

  const sidebarWidth = sidebarCollapsed ? 72 : 252;

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--k-bg, #fafaf9)' }}>
        <div className="hidden md:block">
          <AdminSidebar
            navGroups={groupNav}
            collapsed={sidebarCollapsed}
            orgName="Grup Paneli"
            orgCode="Çok-hastaneli yönetim"
            isDemo={false}
            userName={fullName}
            userRole="Grup Yöneticisi"
            userInitials={initials}
            isOwner
          />
        </div>

        <MobileSidebarDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          navGroups={groupNav}
          orgName="Grup Paneli"
          isDemo={false}
          userName={fullName}
          userRole="Grup Yöneticisi"
          userInitials={initials}
          onLogout={handleLogout}
          isOwner
        />

        <main
          className="min-h-screen flex flex-col"
          style={{
            paddingLeft: isMobile ? 0 : sidebarWidth,
            transition: 'padding-left 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <AdminTopbar
            onToggleSidebar={toggleSidebar}
            userName={fullName}
            userRole="Grup Yöneticisi"
            userInitials={initials}
          />
          <div className="p-4 pb-20 md:p-8 md:pb-8 flex-1">{children}</div>
        </main>
        <MobileBottomNav items={groupBottomNavItems} onMorePress={() => setMobileDrawerOpen(true)} />
      </div>
    </TooltipProvider>
  );
}
