'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminSidebar } from '@/components/layouts/admin/admin-sidebar';
import { AdminTopbar } from '@/components/layouts/admin/admin-topbar';
import { MobileSidebarDrawer } from '@/components/layouts/mobile-sidebar-drawer';
import { MobileBottomNav, type MobileBottomNavItem } from '@/components/layouts/mobile-bottom-nav';
import { adminNav, filterNavBySector, filterNavByFeatures } from '@/components/layouts/sidebar/sidebar-config';
import { LayoutDashboard, Users as UsersIcon, GraduationCap, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLayoutBranding } from '@/hooks/use-layout-branding';
import { useMobile } from '@/hooks/use-mobile';
import { ActingOrgBanner } from '@/components/shared/acting-org-banner';
import { GroupActingBanner } from '@/components/shared/group-acting-banner';
import { LicenseBanner } from '@/components/shared/license-banner';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';
import { performLogout } from '@/lib/auth/logout';
import { hasAdminAuthority } from '@/lib/auth/admin-authority';
import { hasGroupAuthority } from '@/lib/auth/group-authority';
import { UploadManagerProvider } from '@/components/admin/upload-manager';
import { UploadManagerWidget } from '@/components/admin/upload-manager-widget';

const roleLabels: Record<string, string> = {
  admin: 'Organizasyon Admin',
  super_admin: 'Süper Admin',
  staff: 'Personel',
};

const adminBottomNavItems: readonly MobileBottomNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, rootHref: '/admin/dashboard' },
  { href: '/admin/staff',     label: 'Personel',  icon: UsersIcon },
  { href: '/admin/trainings', label: 'Eğitim',    icon: GraduationCap },
  { href: '/admin/reports',   label: 'Rapor',     icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useMobile();
  useEffect(() => {
    const saved = localStorage.getItem('sidebar:admin:collapsed');
    if (saved === 'true') setSidebarCollapsed(true);
  }, []);
  const { user, isLoading, fullName, initials } = useAuth();
  const branding = useLayoutBranding();
  const router = useRouter();

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileDrawerOpen(true);
      return;
    }
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:admin:collapsed', String(next));
  };

  const handleLogout = () => {
    void performLogout();
  };

  useEffect(() => {
    if (!isLoading && (!user || !hasAdminAuthority({ role: user.role, adminAccess: user.adminAccessGranted }))) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <LayoutSkeleton variant="admin" />;
  }
  if (!user || !hasAdminAuthority({ role: user.role, adminAccess: user.adminAccessGranted })) {
    return null;
  }

  const displayRole = roleLabels[user.role] ?? user.role;
  // Esas Yönetici (org owner) flag'i — branding endpoint'inden gelir.
  // super_admin için her zaman true (impersonation ve testing için tüm menüler görünür).
  const isOrgOwner = user.role === 'super_admin'
    ? true
    : !!(branding?.ownerUserId && branding.ownerUserId === user.id);
  // Grup yöneticisi (esas yönetici) bir hastaneye drill-in ile girdiğinde /admin panelini
  // görür; düzenleme banner'ı + "grup paneline dön" için ayrı bayrak (org-owner'dan farklı).
  const isGroupOwner = hasGroupAuthority({ groupOwner: user.groupOwner, groupId: user.groupId });

  const sidebarWidth = sidebarCollapsed ? 72 : 252;

  // Sektör-filtreli nav: branding henüz yüklenmediyse tüm adminNav fallback
  // (Devakent gibi healthcare org'lar zaten tüm öğeleri görür → flicker yok).
  const filteredAdminNav = branding
    ? filterNavByFeatures(filterNavBySector(adminNav, branding.sector), {
        scormSupport: branding.hasScormSupport,
      })
    : adminNav;

  return (
    <TooltipProvider>
      <UploadManagerProvider>
      <div className="min-h-screen" style={{ background: 'var(--k-bg, #fafaf9)' }}>

        {/* Sidebar: sadece md ve üzerinde göster */}
        <div className="hidden md:block">
          <AdminSidebar
            navGroups={filteredAdminNav}
            collapsed={sidebarCollapsed}
            orgName={branding?.orgName || user?.department || 'KlinoVax LMS'}
            orgCode={branding?.orgCode || 'Organizasyon Yöneticisi'}
            orgLogoUrl={branding?.orgLogoUrl ?? undefined}
            isDemo={branding?.isDemo === true}
            userName={fullName}
            userRole={displayRole}
            userInitials={initials}
            isOwner={isOrgOwner}
          />
        </div>

        {/* Mobil sidebar drawer */}
        <MobileSidebarDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          navGroups={filteredAdminNav}
          orgName={branding?.orgName || user?.department || ''}
          orgLogoUrl={branding?.orgLogoUrl ?? undefined}
          isDemo={branding?.isDemo === true}
          userName={fullName}
          userRole={displayRole}
          userInitials={initials}
          onLogout={handleLogout}
          isOwner={isOrgOwner}
        />

        <main
          className="min-h-screen flex flex-col"
          style={{
            paddingLeft: isMobile ? 0 : sidebarWidth,
            transition: 'padding-left 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {isOrgOwner && <ActingOrgBanner />}
          {isGroupOwner && <GroupActingBanner />}
          <AdminTopbar
            onToggleSidebar={toggleSidebar}
            userName={fullName}
            userRole={displayRole}
            userInitials={initials}
          />
          <div className="p-4 pb-20 md:p-8 md:pb-8 flex-1">
            <LicenseBanner />
            {children}
          </div>
        </main>
        <MobileBottomNav
          items={adminBottomNavItems}
          onMorePress={() => setMobileDrawerOpen(true)}
        />
        <UploadManagerWidget />
      </div>
      </UploadManagerProvider>
    </TooltipProvider>
  );
}
