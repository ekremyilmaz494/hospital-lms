'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { adminNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';
import { AiGenerationPoller } from '@/components/providers/ai-generation-poller';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';

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
  useEffect(() => {
    const saved = localStorage.getItem('sidebar:admin:collapsed');
    if (saved === 'false') setSidebarCollapsed(false);
  }, []);
  const { user, isLoading, fullName, initials } = useAuth();

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:admin:collapsed', String(next));
  };
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <LayoutSkeleton variant="admin" />;
  }
  if (!user || user.role !== 'admin') {
    return null;
  }

  const displayRole = roleLabels[user.role] ?? user.role;

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <AppSidebar
          navGroups={adminNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
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
          <ImpersonationBanner />
          <AiGenerationPoller />
          <AppTopbar
            title=""
            onToggleSidebar={toggleSidebar}
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
