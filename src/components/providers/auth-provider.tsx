'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    setLoading(true);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          id: user.id,
          email: user.email ?? '',
          firstName: user.user_metadata?.first_name ?? '',
          lastName: user.user_metadata?.last_name ?? '',
          role: user.user_metadata?.role ?? 'staff',
          organizationId: user.user_metadata?.organization_id ?? null,
          tcNo: user.user_metadata?.tc_no ?? null,
          phone: user.user_metadata?.phone ?? null,
          departmentId: user.user_metadata?.department_id ?? null,
          department: user.user_metadata?.department ?? null,
          title: user.user_metadata?.title ?? null,
          avatarUrl: user.user_metadata?.avatar_url ?? null,
          isActive: user.user_metadata?.is_active !== false,
          createdAt: user.created_at,
          updatedAt: user.updated_at ?? user.created_at,
        });
      } else {
        setUser(null);
      }
    }).finally(() => {
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/auth/login');
      } else if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email ?? '',
          firstName: u.user_metadata?.first_name ?? '',
          lastName: u.user_metadata?.last_name ?? '',
          role: u.user_metadata?.role ?? 'staff',
          organizationId: u.user_metadata?.organization_id ?? null,
          tcNo: u.user_metadata?.tc_no ?? null,
          phone: u.user_metadata?.phone ?? null,
          departmentId: u.user_metadata?.department_id ?? null,
          department: u.user_metadata?.department ?? null,
          title: u.user_metadata?.title ?? null,
          avatarUrl: u.user_metadata?.avatar_url ?? null,
          isActive: u.user_metadata?.is_active !== false,
          createdAt: u.created_at,
          updatedAt: u.updated_at ?? u.created_at,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, router]);

  return <>{children}</>;
}
