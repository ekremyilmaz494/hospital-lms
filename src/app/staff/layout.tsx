'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { staffNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { useLayoutBranding } from '@/hooks/use-layout-branding';
import { useMobile } from '@/hooks/use-mobile';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';
import { MobileBottomNav } from '@/components/layouts/mobile-bottom-nav';
import { MobileSidebarDrawer } from '@/components/layouts/mobile-sidebar-drawer';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useMobile();
  const { user, isLoading, fullName, initials } = useAuth();
  const branding = useLayoutBranding();
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('sidebar:staff:collapsed');
    if (saved === 'false') setSidebarCollapsed(false);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileDrawerOpen(true);
      return;
    }
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:staff:collapsed', String(next));
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().setUser(null);
    router.push('/auth/login');
  };

  // Auth guard: staff paneline sadece staff, admin ve super_admin erişebilir.
  // Admin ve super_admin da staff sayfalarını görebilir (middleware ile uyumlu).
  useEffect(() => {
    if (!isLoading && user && !['staff', 'admin', 'super_admin'].includes(user.role)) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <LayoutSkeleton variant="staff" />;
  if (!user) return null;

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        {/* Sidebar: sadece md ve üzerinde göster */}
        <div className="hidden md:block">
          <AppSidebar
            navGroups={staffNav}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            orgName={branding?.orgName || user?.department || ''}
            orgCode={branding?.orgCode || ''}
            orgLogoUrl={branding?.orgLogoUrl ?? undefined}
            userName={fullName}
            userRole="Personel"
            userInitials={initials}
          />
        </div>

        {/* Mobil sidebar drawer */}
        <MobileSidebarDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          navGroups={staffNav}
          orgName={branding?.orgName || user?.department || ''}
          orgLogoUrl={branding?.orgLogoUrl ?? undefined}
          userName={fullName}
          userRole="Personel"
          userInitials={initials}
          onLogout={handleLogout}
        />

        {/* Ana içerik: masaüstünde sidebar durumuna göre kayar, mobilde sabit */}
        <main
          className="min-h-screen pb-16 md:pb-0"
          style={{ marginLeft: isMobile ? 0 : 72 }}
        >
          <ImpersonationBanner />
          <AppTopbar
            title=""
            orgName={branding?.orgName}
            onToggleSidebar={toggleSidebar}
            userName={fullName}
            userRole="Personel"
            userInitials={initials}
          />
          <div className="p-4 md:p-8">{children}</div>
        </main>

        {/* Mobil alt navigasyon */}
        <MobileBottomNav onMorePress={() => setMobileDrawerOpen(true)} />
      </div>
    </TooltipProvider>
  );
}
