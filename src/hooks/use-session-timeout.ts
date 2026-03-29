'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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
  const onWarningRef = useRef(onWarning);
  const onTimeoutRef = useRef(onTimeout);

  // Keep callback refs up to date without triggering effect re-runs
  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // A state-based signal to trigger timer reset from outside the effect
  const [resetSignal, setResetSignal] = useState(0);

  const resetTimers = useCallback(() => {
    setResetSignal(s => s + 1);
  }, []);

  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    /** Clear existing timers */
    function clearTimers() {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    }

    /** Handle session timeout logout */
    async function handleLogout() {
      clearTimers();
      onTimeoutRef.current?.();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/auth/login?reason=timeout');
    }

    /** Set up warning and logout timers */
    function startTimers() {
      lastActivityRef.current = Date.now();
      clearTimers();

      const timeoutMs = timeoutMinutes * 60_000;

      // Warning timer
      if (timeoutMs > WARNING_BEFORE_MS && onWarningRef.current) {
        warningTimerRef.current = setTimeout(() => {
          onWarningRef.current?.(Math.round(WARNING_BEFORE_MS / 1000));
        }, timeoutMs - WARNING_BEFORE_MS);
      }

      // Logout timer
      timerRef.current = setTimeout(handleLogout, timeoutMs);
    }

    startTimers();

    const handleActivity = () => {
      // Throttle: only reset if at least 30s since last reset
      if (Date.now() - lastActivityRef.current > 30_000) {
        startTimers();
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
  }, [enabled, timeoutMinutes, router, resetSignal]);

  return { resetTimers };
}
