'use client';

export function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="c-chip">
      <span className="c-chip-icon">{icon}</span>
      <span className="c-chip-label">{label}</span>
      <span className="c-chip-value">{value}</span>
      <style jsx>{`
        .c-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid #ebe7df;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #6b6a63;
        }
        .c-chip-icon { display: inline-flex; color: #8a8578; }
        .c-chip-label { color: #8a8578; }
        .c-chip-value { color: #0a0a0a; font-weight: 600; font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}
