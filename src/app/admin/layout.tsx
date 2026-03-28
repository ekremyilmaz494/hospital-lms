'use client';

import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { adminNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, fullName, initials } = useAuth();

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
          userRole="Hastane Admin"
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
            userRole="Hastane Admin"
            userInitials={initials}
          />
          <div className="p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
