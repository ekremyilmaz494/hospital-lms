'use client';

import { useCallback } from 'react';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/components/shared/toast';

/**
 * Oturum zaman aşımı yöneticisi — kurum ayarındaki `sessionTimeout` (dakika) kadar
 * hareketsiz kalındığında oturumu güvenlik için otomatik kapatır.
 *
 * Değer `auth-provider` tarafından `/api/auth/me`'den okunup `auth-store.sessionTimeout`'a
 * yazılır; burada o değer tüketilir. `useSessionTimeout` hook'u aktivite dinleyicilerini,
 * uyarıyı ve `signOut`+login yönlendirmesini yönetir. Yalnızca kullanıcı giriş yapmışken
 * etkindir (`enabled: isAuthenticated`) — public/login sayfalarında atıl durur.
 *
 * Kök layout'ta `ToastProvider` içinde mount edilir (uyarı toast'ı için); zustand store
 * global olduğundan AuthProvider'a context bağımlılığı yoktur.
 */
export function SessionTimeoutManager() {
  const sessionTimeout = useAuthStore((s) => s.sessionTimeout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { toast } = useToast();

  const handleWarning = useCallback(
    (remainingSeconds: number) => {
      toast(
        `Hareketsizlik nedeniyle ${remainingSeconds} saniye içinde oturumunuz kapatılacak. Devam etmek için ekrana dokunun.`,
        'warning',
      );
    },
    [toast],
  );

  useSessionTimeout({
    timeoutMinutes: sessionTimeout,
    enabled: isAuthenticated,
    onWarning: handleWarning,
  });

  return null;
}
