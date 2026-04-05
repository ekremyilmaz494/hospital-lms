'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { superAdminNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem('sidebar:super-admin:collapsed');
    if (saved === 'false') setSidebarCollapsed(false);
  }, []);
  const { fullName, initials, user, isLoading } = useAuth();

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:super-admin:collapsed', String(next));
  };
  const router = useRouter();

  // Second line of defense: redirect non-super_admin users even if middleware is bypassed
  useEffect(() => {
    if (!isLoading && user && user.role !== 'super_admin') {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <LayoutSkeleton variant="super-admin" />;
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <AppSidebar
          navGroups={superAdminNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          orgName="Hastane LMS"
          userName={fullName}
          userRole="Platform Yöneticisi"
          userInitials={initials}
        />
        <main
          className="min-h-screen"
          style={{ marginLeft: 72 }}
        >
          <AppTopbar
            title=""
            onToggleSidebar={toggleSidebar}
            userName={fullName}
            userRole="Platform Yöneticisi"
            userInitials={initials}
          />
          <div className="p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
