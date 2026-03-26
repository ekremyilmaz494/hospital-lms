'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
const WARNING_BEFORE_MS = 60_000; // Show warning 1 minute before logout

interface UseSessionTimeoutOptions {
  timeoutMinutes: number;
  onWarning?: (remainingSeconds: number) => void;
  onTimeout?: () => void;
  enabled?: boolean;
}

export function useSessionTimeout({
  timeoutMinutes,
  onWarning,
  onTimeout,
  enabled = true,
}: UseSessionTimeoutOptions) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    onTimeout?.();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login?reason=timeout');
  }, [clearTimers, onTimeout, router]);

  const resetTimers = useCallback(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    lastActivityRef.current = Date.now();
    clearTimers();

    const timeoutMs = timeoutMinutes * 60_000;

    // Warning timer
    if (timeoutMs > WARNING_BEFORE_MS && onWarning) {
      warningTimerRef.current = setTimeout(() => {
        onWarning(Math.round(WARNING_BEFORE_MS / 1000));
      }, timeoutMs - WARNING_BEFORE_MS);
    }

    // Logout timer
    timerRef.current = setTimeout(handleLogout, timeoutMs);
  }, [enabled, timeoutMinutes, clearTimers, handleLogout, onWarning]);

  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    resetTimers();

    const handleActivity = () => {
      // Throttle: only reset if at least 30s since last reset
      if (Date.now() - lastActivityRef.current > 30_000) {
        resetTimers();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
    };
  }, [enabled, timeoutMinutes, resetTimers, clearTimers]);

  return { resetTimers };
}
