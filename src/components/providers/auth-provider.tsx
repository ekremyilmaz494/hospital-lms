'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { usePresenceTracker } from '@/hooks/use-presence-tracker';

const DB_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 dakika — deaktive kullanıcı penceresi

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserIfChanged, setLoading, setSessionTimeout } = useAuthStore();
  // G3.2 — Track this user's presence in the global active-users channel
  usePresenceTracker();
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
            setUser(null);
            router.push('/auth/login');
            return;
          }

          setUserIfChanged({
            role: data.user.role ?? currentUser.role,
            isActive: data.user.isActive ?? currentUser.isActive,
            department: data.user.department ?? currentUser.department,
            departmentId: data.user.departmentId ?? currentUser.departmentId,
            title: data.user.title ?? currentUser.title,
          });
          if (typeof data.user.sessionTimeout === 'number' && data.user.sessionTimeout > 0) {
            setSessionTimeout(data.user.sessionTimeout);
          }
        }
      }
    } catch {
      // Sessizce devam et — JWT verileri fallback olarak kullanilir
    }
  }, [setUser, setUserIfChanged, setSessionTimeout, router]);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session — use getSession() (local JWT parse, no HTTP round-trip).
    // Middleware already validates the token server-side via getUser().
    // Login sayfası store'u önceden doldurduysa loading gösterme (flash önlenir)
    const hasExistingUser = !!useAuthStore.getState().user;
    if (!hasExistingUser) setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
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
        // JWT hydration sonrası sunucu doğrulaması yap (deaktive kullanıcı tespiti)
        // 3 saniye geciktir — kritik render path'i bloklamadan kontrol et
        setTimeout(refreshFromDB, 3000);
      } else {
        // Supabase session yok — demo mode olabilir, /api/auth/me ile kontrol et
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setUser({
                id: data.user.id,
                email: data.user.email ?? '',
                firstName: data.user.firstName ?? '',
                lastName: data.user.lastName ?? '',
                role: data.user.role ?? 'staff',
                organizationId: data.user.organizationId ?? null,
                tcNo: data.user.tcNo ?? null,
                phone: data.user.phone ?? null,
                departmentId: data.user.departmentId ?? null,
                department: data.user.department ?? null,
                title: data.user.title ?? null,
                avatarUrl: data.user.avatarUrl ?? null,
                isActive: data.user.isActive !== false,
                kvkkConsent: data.user.kvkkConsent ?? false,
                kvkkConsentDate: data.user.kvkkConsentDate ?? null,
                createdAt: data.user.createdAt ?? new Date().toISOString(),
                updatedAt: data.user.updatedAt ?? new Date().toISOString(),
              });
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      }
    }).finally(() => {
      setLoading(false);
    });

    // Periyodik DB kontrolu (deaktive edilmis kullaniciyi yakala)
    const interval = setInterval(refreshFromDB, DB_REFRESH_INTERVAL);

    // Listen for auth state changes — sadece SIGNED_OUT ve SIGNED_IN'e tepki ver.
    // TOKEN_REFRESHED event'ini YOKSAY: her ~60s'de tetiklenir ve setUser() çağırmak
    // tüm sayfayı gereksiz re-render eder (useFetch re-trigger → dashboard reload döngüsü).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/auth/login');
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) {
          const u = session.user;
          // setUserIfChanged: sadece gerçekten değişen alanlar varsa store güncellenir.
          // Aynı veriyle setUser() çağırmak yeni object → gereksiz re-render tetikler.
          const currentUser = useAuthStore.getState().user;
          if (!currentUser) {
            // İlk kez set ediliyor
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
          } else {
            // Mevcut user var — sadece değişen alanları güncelle
            setUserIfChanged({
              role: u.user_metadata?.role ?? currentUser.role,
              isActive: u.user_metadata?.is_active !== false,
              avatarUrl: u.user_metadata?.avatar_url ?? currentUser.avatarUrl,
            });
          }
        }
      }
      // TOKEN_REFRESHED: session cookie yenilenir ama store'a dokunmaya gerek yok
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [setUser, setLoading, router, refreshFromDB]);

  return <>{children}</>;
}
