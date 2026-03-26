'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { Clock, LogOut, MousePointerClick } from 'lucide-react';

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [warning, setWarning] = useState<number | null>(null);

  // Fetch org session timeout
  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        const timeout = data?.user?.organization?.sessionTimeout;
        if (typeof timeout === 'number' && timeout > 0) {
          setSessionTimeout(timeout);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleWarning = useCallback((remainingSeconds: number) => {
    setWarning(remainingSeconds);
  }, []);

  const handleTimeout = useCallback(() => {
    setWarning(null);
  }, []);

  const { resetTimers } = useSessionTimeout({
    timeoutMinutes: sessionTimeout,
    onWarning: handleWarning,
    onTimeout: handleTimeout,
    enabled: !!user,
  });

  const dismissWarning = useCallback(() => {
    setWarning(null);
    resetTimers();
  }, [resetTimers]);

  // Countdown effect
  useEffect(() => {
    if (warning === null || warning <= 0) return;
    const interval = setInterval(() => {
      setWarning(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [warning]);

  return (
    <>
      {children}

      {/* Timeout Warning Banner */}
      {warning !== null && warning > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div
            className="flex items-center gap-4 rounded-2xl px-6 py-4 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #991b1b)',
              boxShadow: '0 8px 32px rgba(220, 38, 38, 0.35)',
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Oturum süreniz dolmak üzere
              </p>
              <p className="text-xs text-white/70">
                <span className="font-mono font-bold text-white">{warning}</span> saniye içinde otomatik çıkış yapılacak
              </p>
            </div>
            <button
              onClick={dismissWarning}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <MousePointerClick className="h-4 w-4" />
              Devam Et
            </button>
          </div>
        </div>
      )}
    </>
  );
}
