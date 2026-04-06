'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { staffNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { useLayoutBranding } from '@/hooks/use-layout-branding';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';
import { MobileBottomNav } from '@/components/layouts/mobile-bottom-nav';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem('sidebar:staff:collapsed');
    if (saved === 'false') setSidebarCollapsed(false);
  }, []);
  const [isMd, setIsMd] = useState(false);
  const { user, isLoading, fullName, initials } = useAuth();
  const branding = useLayoutBranding();

  useEffect(() => {
    const check = () => setIsMd(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:staff:collapsed', String(next));
  };
  const router = useRouter();

  // Auth guard: redirect non-staff users
  useEffect(() => {
    if (!isLoading && user && user.role !== 'staff') {
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
        {/* Ana içerik: masaüstünde sidebar durumuna göre kayar, mobilde sabit */}
        <main
          className="min-h-screen pb-16 md:pb-0"
          style={{ marginLeft: isMd ? 72 : 0 }}
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
        <MobileBottomNav />
      </div>
    </TooltipProvider>
  );
}
