import { AuthProvider } from "@/components/providers/auth-provider";
import { SessionTimeoutManager } from "@/components/providers/session-timeout-provider";
import { createClient } from "@/lib/supabase/server";
import { extractAdminAccess } from "@/lib/auth/admin-authority";
import type { User } from "@/types/database";

// Oturumlu paneller (admin, staff, super-admin, group, exam) + auth akışı.
// Session okuması (cookies()) KÖK layout'ta değil burada: kök layout request-time API
// çağırınca pazarlama sayfaları dahil TÜM site istek-başı render ediliyordu. URL'ler
// değişmez — (app) bir route group'tur.

// Supabase session → User shape. Client'taki AuthProvider'ın `setUser` ile ürettiği objeyle
// birebir aynı şema — SSR hydration'da uyumsuzluk olmaması için paralel tutuldu.
async function getInitialUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user;
    if (!u) return null;
    return {
      id: u.id,
      email: u.email ?? '',
      firstName: u.user_metadata?.first_name ?? '',
      lastName: u.user_metadata?.last_name ?? '',
      role: u.app_metadata?.role ?? u.user_metadata?.role ?? 'staff',
      adminAccessGranted: extractAdminAccess(u.app_metadata),
      organizationId: u.app_metadata?.organization_id ?? u.user_metadata?.organization_id ?? null,
      phone: u.user_metadata?.phone ?? null,
      departmentId: u.user_metadata?.department_id ?? null,
      department: u.user_metadata?.department ?? null,
      title: u.user_metadata?.title ?? null,
      avatarUrl: u.user_metadata?.avatar_url ?? null,
      isActive: u.user_metadata?.is_active !== false,
      kvkkNoticeAcknowledgedAt: u.user_metadata?.kvkk_notice_acknowledged_at ?? null,
      createdAt: u.created_at,
      updatedAt: u.updated_at ?? u.created_at,
    };
  } catch {
    // Session parse edilemedi — client fallback devreye girsin
    return null;
  }
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getInitialUser();
  return (
    <AuthProvider initialUser={initialUser}>
      {children}
      <SessionTimeoutManager />
    </AuthProvider>
  );
}
