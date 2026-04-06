'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { adminNav } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { useLayoutBranding } from '@/hooks/use-layout-branding';
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
  const branding = useLayoutBranding();
  const router = useRouter();
  const pathname = usePathname();
  const [setupChecked, setSetupChecked] = useState(false);
  const isSetupPage = pathname?.startsWith('/admin/setup');

  // Setup wizard guard: admin henüz kurulumu tamamlamadıysa /admin/setup'a yönlendir
  useEffect(() => {
    // Setup sayfasında veya henüz auth yüklenmemişse kontrol gereksiz
    if (isLoading || !user || user.role !== 'admin' || isSetupPage) {
      // requestAnimationFrame ile cascade render'ı önle
      const raf = requestAnimationFrame(() => setSetupChecked(true));
      return () => cancelAnimationFrame(raf);
    }

    let cancelled = false;
    fetch('/api/admin/setup')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.setupCompleted === false) {
          router.replace('/admin/setup');
        }
        setSetupChecked(true);
      })
      .catch(() => {
        if (!cancelled) setSetupChecked(true);
      });

    return () => { cancelled = true; };
  }, [isLoading, user, isSetupPage, router]);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:admin:collapsed', String(next));
  };

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !setupChecked) {
    return <LayoutSkeleton variant="admin" />;
  }
  if (!user || user.role !== 'admin') {
    return null;
  }

  // Setup sayfasında sidebar gösterme — setup layout kendi wrapper'ını kullanır
  if (isSetupPage) {
    return <>{children}</>;
  }

  const displayRole = roleLabels[user.role] ?? user.role;

  return (
    <TooltipProvider>
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <AppSidebar
          navGroups={adminNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          orgName={branding?.orgName || user?.department || ''}
          orgCode={branding?.orgCode || ''}
          orgLogoUrl={branding?.orgLogoUrl ?? undefined}
          userName={fullName}
          userRole={displayRole}
          userInitials={initials}
        />
        <main
          className="min-h-screen"
          style={{ marginLeft: 72 }}
        >
          <ImpersonationBanner />
          <AiGenerationPoller />
          <AppTopbar
            title=""
            orgName={branding?.orgName}
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
