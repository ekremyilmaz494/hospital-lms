'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminSidebar } from '@/components/layouts/admin/admin-sidebar';
import { AdminTopbar } from '@/components/layouts/admin/admin-topbar';
import { MobileSidebarDrawer } from '@/components/layouts/mobile-sidebar-drawer';
import { MobileBottomNav, type MobileBottomNavItem } from '@/components/layouts/mobile-bottom-nav';
import { adminNav } from '@/components/layouts/sidebar/sidebar-config';
import { LayoutDashboard, Users as UsersIcon, GraduationCap, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLayoutBranding } from '@/hooks/use-layout-branding';
import { useMobile } from '@/hooks/use-mobile';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

const roleLabels: Record<string, string> = {
  admin: 'Hastane Admin',
  super_admin: 'Süper Admin',
  staff: 'Personel',
};

const adminBottomNavItems: readonly MobileBottomNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, rootHref: '/admin/dashboard' },
  { href: '/admin/staff',     label: 'Personel',  icon: UsersIcon },
  { href: '/admin/trainings', label: 'Eğitim',    icon: GraduationCap },
  { href: '/admin/reports',   label: 'Rapor',     icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useMobile();
  useEffect(() => {
    const saved = localStorage.getItem('sidebar:admin:collapsed');
    if (saved === 'true') setSidebarCollapsed(true);
  }, []);
  const { user, isLoading, fullName, initials } = useAuth();
  const branding = useLayoutBranding();
  const router = useRouter();
  const pathname = usePathname();
  const [setupChecked, setSetupChecked] = useState(false);
  const isSetupPage = pathname?.startsWith('/admin/setup');

  // Setup wizard guard: admin henüz kurulumu tamamlamadıysa /admin/setup'a yönlendir
  useEffect(() => {
    // Setup sayfasında veya henüz auth yüklenmemişse kontrol gereksiz
    if (isLoading || !user || user.role !== 'admin' || isSetupPage) {
      // requestAnimationFrame ile cascade render'ı önle
      const raf = requestAnimationFrame(() => setSetupChecked(true));
      return () => cancelAnimationFrame(raf);
    }

    let cancelled = false;
    fetch('/api/admin/setup')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.setupCompleted === false) {
          router.replace('/admin/setup');
        }
        setSetupChecked(true);
      })
      .catch(() => {
        if (!cancelled) setSetupChecked(true);
      });

    return () => { cancelled = true; };
  }, [isLoading, user, isSetupPage, router]);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileDrawerOpen(true);
      return;
    }
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:admin:collapsed', String(next));
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().setUser(null);
    router.push('/auth/login');
  };

  useEffect(() => {
    if (!isLoading && (!user || !['admin', 'super_admin'].includes(user.role))) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !setupChecked) {
    return <LayoutSkeleton variant="admin" />;
  }
  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return null;
  }

  // Setup sayfasında sidebar gösterme — setup layout kendi wrapper'ını kullanır
  if (isSetupPage) {
    return <>{children}</>;
  }

  const displayRole = roleLabels[user.role] ?? user.role;

  const sidebarWidth = sidebarCollapsed ? 72 : 252;

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--k-bg, #fafaf9)' }}>

        {/* Sidebar: sadece md ve üzerinde göster */}
        <div className="hidden md:block">
          <AdminSidebar
            navGroups={adminNav}
            collapsed={sidebarCollapsed}
            orgName={branding?.orgName || user?.department || 'Klinova LMS'}
            orgCode={branding?.orgCode || 'Hastane Yönetici'}
            orgLogoUrl={branding?.orgLogoUrl ?? undefined}
            userName={fullName}
            userRole={displayRole}
            userInitials={initials}
          />
        </div>

        {/* Mobil sidebar drawer */}
        <MobileSidebarDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          navGroups={adminNav}
          orgName={branding?.orgName || user?.department || ''}
          orgLogoUrl={branding?.orgLogoUrl ?? undefined}
          userName={fullName}
          userRole={displayRole}
          userInitials={initials}
          onLogout={handleLogout}
        />

        <main
          className="min-h-screen flex flex-col"
          style={{
            paddingLeft: isMobile ? 0 : sidebarWidth,
            transition: 'padding-left 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <ImpersonationBanner />
          <AdminTopbar
            onToggleSidebar={toggleSidebar}
            userName={fullName}
            userRole={displayRole}
            userInitials={initials}
          />
          <div className="p-4 pb-20 md:p-8 md:pb-8 flex-1">{children}</div>
        </main>
        <MobileBottomNav
          items={adminBottomNavItems}
          onMorePress={() => setMobileDrawerOpen(true)}
        />
      </div>
    </TooltipProvider>
  );
}
