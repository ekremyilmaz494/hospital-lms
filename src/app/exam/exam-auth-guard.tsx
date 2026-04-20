'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Sinav sayfasi icin auth guard - giris yapmamis kullanicilari login sayfasina yonlendirir */
export function ExamAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#0a7a47', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {children}
    </div>
  );
}
