'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { staffNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';
import { MobileBottomNav } from '@/components/layouts/mobile-bottom-nav';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('sidebar:staff:collapsed');
    return saved !== null ? saved === 'true' : true;
  });
  const [isMd, setIsMd] = useState(false);
  const { user, isLoading, fullName, initials } = useAuth();

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

  if (isLoading || !user) return null;

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        {/* Sidebar: sadece md ve üzerinde göster */}
        <div className="hidden md:block">
          <AppSidebar
            navGroups={staffNav}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            orgName={user?.department ?? ''}
            userName={fullName}
            userRole="Personel"
            userInitials={initials}
          />
        </div>
        {/* Ana içerik: masaüstünde sidebar durumuna göre kayar, mobilde sabit */}
        <main
          className="min-h-screen pb-16 md:pb-0"
          style={{
            marginLeft: isMd ? (sidebarCollapsed ? 72 : 280) : 0,
            transition: 'margin-left 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <ImpersonationBanner />
          <AppTopbar
            title=""
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
