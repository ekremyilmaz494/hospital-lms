'use client';

/**
 * Erişilebilir aç/kapat anahtarı — admin/staff/[id]/edit sayfasındaki
 * role="switch" deseninin tema değişkenli (var(--k-*)) kopyası.
 */
export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Ekran okuyucular için zorunlu etiket. */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        width: 44,
        height: 26,
        borderRadius: 999,
        background: checked ? 'var(--k-primary)' : 'var(--k-border)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
        position: 'relative',
        transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
          transition: 'left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </button>
  );
}
