'use client';

import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { staffNav } from '@/components/layouts/sidebar/sidebar-config';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <AppSidebar
          navGroups={staffNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          orgName="Devakent Hastanesi"
          userName="Elif Kaya"
          userRole="Personel"
          userInitials="EK"
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
            userName="Elif Kaya"
            userRole="Personel"
            userInitials="EK"
            unreadNotifications={2}
          />
          <div className="p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
