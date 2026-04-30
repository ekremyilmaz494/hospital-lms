'use client';

import { Label } from '@/components/ui/label';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <Label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
             style={{ color: 'var(--k-text-muted)' }}>{label}</Label>
      {children}
      {error && <p className="mt-1.5 text-[11px] font-medium" style={{ color: 'var(--k-error)' }}>{error}</p>}
      {hint && !error && <p className="mt-1.5 text-[11px] italic" style={{ color: 'var(--k-text-muted)' }}>{hint}</p>}
    </div>
  );
}
