'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { adminNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';

const roleLabels: Record<string, string> = {
  admin: 'Hastane Admin',
  super_admin: 'Süper Admin',
  staff: 'Personel',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, isLoading, fullName, initials } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'admin') {
    return null;
  }

  const displayRole = roleLabels[user.role] ?? user.role;

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <AppSidebar
          navGroups={adminNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          orgName={user?.department ?? ''}
          orgCode=""
          userName={fullName}
          userRole={displayRole}
          userInitials={initials}
        />
        <main
          className="min-h-screen"
          style={{
            marginLeft: sidebarCollapsed ? 72 : 280,
            transition: 'margin-left 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <AppTopbar
            title=""
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            userName={fullName}
            userRole={displayRole}
            userInitials={initials}
          />
          <div className="p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
