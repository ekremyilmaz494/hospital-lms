'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layouts/sidebar/app-sidebar';
import { AppTopbar } from '@/components/layouts/topbar/app-topbar';
import { staffNav, filterNavBySector } from '@/components/layouts/sidebar/sidebar-config';
import { useAuth } from '@/hooks/use-auth';
import { useLayoutBranding } from '@/hooks/use-layout-branding';
import { useMobile } from '@/hooks/use-mobile';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';
import { MobileSidebarDrawer } from '@/components/layouts/mobile-sidebar-drawer';
import { LayoutSkeleton } from '@/components/shared/layout-skeleton';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { OfflineQueueProvider } from '@/components/providers/offline-queue-provider';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useMobile();
  const { user, isLoading, fullName, initials } = useAuth();
  const branding = useLayoutBranding();
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('sidebar:staff:collapsed');
    if (saved === 'false') setSidebarCollapsed(false);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileDrawerOpen(true);
      return;
    }
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebar:staff:collapsed', String(next));
  };

  const handleLogout = async () => {
    // Çıkışı önce sunucu rotasından yap: SSR cookie handler oturum çerezlerini KESİN temizler.
    // (Client signOut'un global-scope network hatasında çerezi temizlemeden çıkma sorununu aşar —
    // aksi halde /auth/login'e gidince middleware hâlâ oturumu görüp panele geri atıyordu.)
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* yine de devam et */ }
    try { await createClient().auth.signOut(); } catch { /* yerel oturum durumunu da temizle */ }
    useAuthStore.getState().setUser(null);
    // Full reload — middleware temizlenmiş çerezle yeniden değerlendirsin (router.push race'i yok).
    window.location.href = '/auth/login';
  };

  // Auth guard: staff paneline sadece staff, admin ve super_admin erişebilir.
  // Admin ve super_admin da staff sayfalarını görebilir (middleware ile uyumlu).
  useEffect(() => {
    if (!isLoading && user && !['staff', 'admin', 'super_admin'].includes(user.role)) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <LayoutSkeleton variant="staff" />;
  if (!user) return null;

  // Sektör-filtreli nav: branding yüklenmediyse tüm staffNav fallback.
  // (Devakent staff'ı zaten SMG Puanlarım'ı görür → flicker yok)
  const filteredStaffNav = branding ? filterNavBySector(staffNav, branding.sector) : staffNav;

  // Editorial sistemde staff zemini cream paper. Diğer paneller (admin/super-admin)
  // kendi layout'larında stone neutrals kullanıyor — buradaki değişiklik onları etkilemez.
  return (
    <OfflineQueueProvider>
    <TooltipProvider>
      <div
        className="min-h-dvh"
        style={{ background: 'var(--ed-cream, #f4ead5)' }}
        data-surface="editorial"
      >
        {/* Sidebar: sadece md ve üzerinde göster */}
        <div className="hidden md:block">
          <AppSidebar
            navGroups={filteredStaffNav}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            orgName={branding?.orgName || user?.department || ''}
            orgCode={branding?.orgCode || ''}
            orgLogoUrl={branding?.orgLogoUrl ?? undefined}
            userName={fullName}
            userRole="Personel"
            userInitials={initials}
          />
        </div>

        {/* Mobil sidebar drawer */}
        <MobileSidebarDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          navGroups={staffNav}
          orgName={branding?.orgName || user?.department || ''}
          orgLogoUrl={branding?.orgLogoUrl ?? undefined}
          userName={fullName}
          userRole="Personel"
          userInitials={initials}
          onLogout={handleLogout}
        />

        {/* Ana içerik: masaüstünde 72px sabit rail, mobilde tam genişlik.
            Margin'i CSS media query ile veriyoruz (Tailwind md:ml-[72px]) —
            isMobile JS state'i ile vermek mobilde hydration sonrasına dek
            72px boşluk gösterip layout shift yaratıyor.
            Safe-area padding tüm viewport'larda güvenli (desktop'ta env değeri 0). */}
        <main
          className="min-h-dvh md:ml-[72px] pb-[env(safe-area-inset-bottom)]"
          style={{
            background: 'var(--ed-cream, #f4ead5)',
          }}
        >
          <ImpersonationBanner />
          <AppTopbar
            title=""
            orgName={branding?.orgName}
            onToggleSidebar={toggleSidebar}
            userName={fullName}
            userRole="Personel"
            userInitials={initials}
          />
          <div className="p-4 md:p-8">{children}</div>
        </main>

      </div>
    </TooltipProvider>
    </OfflineQueueProvider>
  );
}
