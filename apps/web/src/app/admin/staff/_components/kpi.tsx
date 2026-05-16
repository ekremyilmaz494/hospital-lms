'use client';

export function Kpi({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number; suffix?: string }) {
  return (
    <div className="k-kpi">
      <div className="k-kpi-top">
        <div>
          <div className="k-kpi-label">{label}</div>
          <div className="k-kpi-value">
            {value.toLocaleString('tr-TR')}
            {suffix && <span className="text-base font-medium ml-1" style={{ color: 'var(--k-text-muted)' }}>{suffix}</span>}
          </div>
        </div>
        <div className="k-kpi-icon">{icon}</div>
      </div>
    </div>
  );
}
