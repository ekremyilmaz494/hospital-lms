'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { staffNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, isLoading, fullName, initials } = useAuth();
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
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          orgName={user?.department ?? ''}
          userName={fullName}
          userRole="Personel"
          userInitials={initials}
        />
        <main
          className="min-h-screen"
          style={{ marginLeft: 72 }}
        >
          <AppTopbar
            title="Personel Paneli"
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
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
