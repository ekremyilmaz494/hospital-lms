'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, hasSupabaseCredentials } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { clearAllFetchCache } from '@/hooks/use-fetch';

const DB_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 dakika

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, logout } = useAuthStore();
  const router = useRouter();

  // DB'den guncel role/isActive verisi al (JWT stale olabilir)
  const refreshFromDB = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const currentUser = useAuthStore.getState().user;
        if (data.user && currentUser) {
          // Deaktive edilmis kullaniciyi zorla cikis yap
          if (data.user.isActive === false) {
            const supabase = createClient();
            await supabase.auth.signOut();
            clearAllFetchCache();
            logout();
            router.push('/auth/login');
            return;
          }

          setUser({
            ...currentUser,
            role: data.user.role ?? currentUser.role,
            isActive: data.user.isActive ?? currentUser.isActive,
            department: data.user.department ?? currentUser.department,
            departmentId: data.user.departmentId ?? currentUser.departmentId,
            title: data.user.title ?? currentUser.title,
          });
        }
      }
    } catch {
      // Sessizce devam et — JWT verileri fallback olarak kullanilir
    }
  }, [setUser, router]);

  useEffect(() => {
    // Supabase credentials yoksa demo modda calis
    if (!hasSupabaseCredentials) {
      setUser(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Get initial session
    setLoading(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
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
          kvkkConsent: user.user_metadata?.kvkk_consent ?? false,
          kvkkConsentDate: user.user_metadata?.kvkk_consent_date ?? null,
          createdAt: user.created_at,
          updatedAt: user.updated_at ?? user.created_at,
        });
        // DB'den guncel veri al — loading, refreshFromDB bitene kadar true kalir
        await refreshFromDB();
      } else {
        setUser(null);
      }
    }).finally(() => {
      setLoading(false);
    });

    // Periyodik DB kontrolu (deaktive edilmis kullaniciyi yakala)
    const interval = setInterval(refreshFromDB, DB_REFRESH_INTERVAL);

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearAllFetchCache(); // Stale multi-tenant veriyi temizle
        logout();
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
          kvkkConsent: u.user_metadata?.kvkk_consent ?? false,
          kvkkConsentDate: u.user_metadata?.kvkk_consent_date ?? null,
          createdAt: u.created_at,
          updatedAt: u.updated_at ?? u.created_at,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [setUser, setLoading, router, refreshFromDB]);

  return <>{children}</>;
}
