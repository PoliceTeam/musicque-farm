'use client';

export function Meter({ label, value }: { label: string; value: number }) {
  const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className="ui-meter">
      <div className="ui-meter-label">
        <span>{label}</span>
        <strong>{Math.round(percent)}%</strong>
      </div>
      <progress aria-label={label} max={100} value={percent} />
    </div>
  );
}
