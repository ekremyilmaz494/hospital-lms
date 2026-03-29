'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StaffCertificatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'var(--color-error-bg)' }}
        >
          <AlertTriangle className="h-7 w-7" style={{ color: 'var(--color-error)' }} />
        </div>
        <h2 className="mb-2 text-lg font-bold">Bir hata oluştu</h2>
        <p className="mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {error.message || 'Sayfa yüklenirken beklenmeyen bir hata oluştu.'}
        </p>
        <Button
          onClick={reset}
          className="gap-2 rounded-xl"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          <RefreshCw className="h-4 w-4" />
          Tekrar Dene
        </Button>
      </div>
    </div>
  );
}
