'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { staffNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';

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
  const { user, isLoading, fullName, initials } = useAuth();

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
        <AppSidebar
          navGroups={staffNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          orgName={user?.department ?? ''}
          userName={fullName}
          userRole="Personel"
          userInitials={initials}
        />
        <main
          className="min-h-screen"
          style={{ marginLeft: 72 }}
        >
          <ImpersonationBanner />
          <AppTopbar
            title=""
            onToggleSidebar={toggleSidebar}
            userName={fullName}
            userRole="Personel"
            userInitials={initials}
          />
          <div className="p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
