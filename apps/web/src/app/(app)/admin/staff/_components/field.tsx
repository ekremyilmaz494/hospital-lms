'use client';

import { cloneElement, isValidElement, useId, type ReactElement } from 'react';
import { Label } from '@/components/ui/label';

type ControlProps = {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

/**
 * Etiketli form alanı. Erişilebilirlik:
 *  - <label htmlFor> tek child kontrole id ile bağlanır (useId).
 *  - Hata varsa kontrol aria-invalid + aria-describedby ile mesaja işaret eder.
 *  - Hata mesajı role="alert" ile ekran okuyucuya duyurulur.
 */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  const autoId = useId();
  const childEl = isValidElement(children) ? (children as ReactElement<ControlProps>) : null;
  const controlId = childEl?.props.id ?? autoId;
  const errorId = `${autoId}-error`;
  const hintId = `${autoId}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  const control = childEl
    ? cloneElement(childEl, {
        id: controlId,
        'aria-invalid': error ? true : childEl.props['aria-invalid'],
        'aria-describedby': describedBy ?? childEl.props['aria-describedby'],
      })
    : children;

  return (
    <div className="flex flex-col">
      <Label
        htmlFor={controlId}
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--k-text-muted)' }}
      >
        {label}
      </Label>
      {control}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[11px] font-medium" style={{ color: 'var(--k-error)' }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[11px] italic" style={{ color: 'var(--k-text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
