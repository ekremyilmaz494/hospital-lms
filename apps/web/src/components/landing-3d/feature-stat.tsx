type FeatureStatProps = {
  /** Üst etiket — mono font, uppercase eyebrow stili. */
  label: string;
  /** Büyük sayı değeri (örn. "12.480"). */
  value: string;
  /** Değerin yanındaki birim/ek (örn. "+", "%"). */
  unit?: string;
};

/** Kanıt section'ında kullanılan sayı + etiket istatistik bloğu. */
export function FeatureStat({ label, value, unit }: FeatureStatProps) {
  return (
    <div className="l3d-stat">
      <span className="l3d-stat-label">{label}</span>
      <span className="l3d-stat-value">
        {value}
        {unit ? <span className="l3d-stat-unit">{unit}</span> : null}
      </span>
    </div>
  );
}
