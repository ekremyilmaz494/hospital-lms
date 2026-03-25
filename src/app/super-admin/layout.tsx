'use client';

import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { superAdminNav } from '@/components/layouts/sidebar/sidebar-config';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <AppSidebar
          navGroups={superAdminNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          orgName="Hastane LMS"
          userName="Süper Admin"
          userRole="Platform Yöneticisi"
          userInitials="SA"
        />
        <main
          className="min-h-screen"
          style={{
            marginLeft: sidebarCollapsed ? '72px' : '280px',
            transition: 'margin-left 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <AppTopbar
            title=""
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            userName="Süper Admin"
            userRole="Platform Yöneticisi"
            userInitials="SA"
            unreadNotifications={3}
          />
          <div className="p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
